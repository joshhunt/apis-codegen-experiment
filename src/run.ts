import fs from "node:fs/promises";
import type { OpenAPIV3 } from "openapi-types";
import * as prettier from "prettier";
import ts from "typescript";
import ApiGenerator, {
  createQuestionToken,
  isValidIdentifier,
} from "oazapfts/generate";
import { preprocessSpec } from "./preProcess.js";
import { EndpointDef, GroupVersionKind, OperationDef } from "./types.js";
import { generateEndpoint } from "./generateEndpoint.js";
import { createObject, printNode } from "./tsUtils.js";
import * as emphasize from "emphasize";
import {
  Resource as CommonLibResource,
  ResourceList as CommonLibResourceList,
  CommonLibName,
} from "./commonLib.js";
import { getAllOperations, prepareEndpoint } from "./prepareEndpoints.js";

const SPEC_PATH = "./specs/scopes.json";
const OUTPUT_PATH = "./output/playlist.gen.ts";

const RESOURCE_TYPE_NAME = "Resource";
const RESOURCE_LIST_TYPE_NAME = "ResourceList";

const gvkTypes: Array<[gvk: GroupVersionKind, type: ts.TypeAliasDeclaration]> =
  [];

const tsResultFile = ts.createSourceFile(
  "someFileName.ts",
  "",
  ts.ScriptTarget.Latest,
  /*setParentNodes*/ false,
  ts.ScriptKind.TS
);
const tsPrinter = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

const usedCommonLibImports = new Set<CommonLibName>();
function useCommonLibImport(arg: CommonLibName) {
  usedCommonLibImports.add(arg);
  return arg;
}

const interfaces: Record<
  string,
  ts.InterfaceDeclaration | ts.TypeAliasDeclaration
> = {};
function registerInterface(
  declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration
) {
  const name = declaration.name.escapedText.toString();
  if (name in interfaces) {
    throw new Error(`interface/type alias ${name} already registered`);
  }
  interfaces[name] = declaration;
  return declaration;
}

const specContent = await fs.readFile(SPEC_PATH, "utf-8");
const spec: OpenAPIV3.Document = preprocessSpec(JSON.parse(specContent));

const apiGen = new ApiGenerator(spec, {
  unionUndefined: false,
  useEnumType: false,
  mergeReadWriteOnly: false,
});

const VALID_METHODS = ["get", "post", "put", "delete", "patch"];

const operations = getAllOperations(apiGen, spec);

for (const operation of operations) {
  await prepareEndpoint(apiGen, operation);
}

process.exit(0);

// ###
// ## New gen
// ###

const endpoints: EndpointDef[] = [];

for (const operation of operations) {
  const endpointDef = await generateEndpoint(operation);

  if (endpointDef) {
    endpoints.push(endpointDef);
  }
}

const endpointBuilder = ts.factory.createIdentifier("build");

const endpointsObject = ts.factory.createObjectLiteralExpression(
  endpoints.map((endpoint) => {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(endpoint.endpointName),
      endpoint.builderCall
    );
  })
);

console.log("\n++++++\n");

for (const endpoint of endpoints) {
  console.log(endpoint.returnType.name);
  //
  // Return type
  {
    const { groupVersionKind, action, name } = endpoint.returnType;

    const kindSchema = findSchemaForGroupVersionKind(groupVersionKind);
    const specSchema = kindSchema && getSpecSchema(kindSchema);

    if (!specSchema) {
      throw new Error("Unable to find specSchema");
    }

    const kindTsName = createAndRegisterKindInterface(
      groupVersionKind,
      specSchema
    );

    let returnType: ts.TypeNode | undefined = undefined;

    if (
      action === "get" ||
      action === "post" ||
      action === "put" ||
      action === "patch"
    ) {
      returnType = createLibTypeReference(
        useCommonLibImport(CommonLibResource),
        kindTsName,
        groupVersionKind.group
      );
    } else if (action === "list") {
      returnType = createLibTypeReference(
        useCommonLibImport(CommonLibResourceList),
        kindTsName,
        groupVersionKind.group
      );
    } else if (action === "delete" || action === "deletecollection") {
      returnType = ts.factory.createTypeReferenceNode(
        useCommonLibImport(CommonLibMetaStatus)
      );
    }

    if (returnType) {
      const exportedResponseType = ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        `${capitalize(endpoint.endpointName)}Response`,
        [],
        returnType
      );

      registerInterface(exportedResponseType);
    }
  }

  //
  // Params type
  const { paramSchemas, groupVersionKind, action, name } = endpoint.paramsType;

  const paramTypes: ts.PropertySignature[] = [];

  for (const param of paramSchemas) {
    const paramType = apiGen.getTypeFromSchema(
      param.schema,
      undefined,
      "writeOnly"
    );

    const name = isValidIdentifier(param.name)
      ? param.name
      : ts.factory.createComputedPropertyName(
          ts.factory.createStringLiteral(param.name)
        );

    const propSig = ts.factory.createPropertySignature(
      undefined,
      name,
      createQuestionToken(!param.required),
      paramType
    );
    paramTypes.push(propSig);
  }

  const paramsType = ts.factory.createTypeLiteralNode(paramTypes);

  const paramsTypeAlias = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    name,
    undefined,
    paramsType
  );

  registerInterface(paramsTypeAlias);
}

// last bit
const injectEndpointsObjectLiteralExpression = createObject({
  endpoints: ts.factory.createArrowFunction(
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        endpointBuilder,
        undefined,
        undefined,
        undefined
      ),
    ],
    undefined,
    undefined,
    ts.factory.createParenthesizedExpression(endpointsObject)
  ),
});

const injectedRtkApiNode = ts.factory.createVariableStatement(
  undefined,
  ts.factory.createVariableDeclarationList([
    ts.factory.createVariableDeclaration(
      ts.factory.createIdentifier("injectedRtkApi"),
      undefined,
      undefined,
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier("api"),
          ts.factory.createIdentifier("injectEndpoints")
        ),
        undefined,
        [injectEndpointsObjectLiteralExpression]
      )
    ),
  ])
);

function findSchemaForGroupVersionKind(gvk: GroupVersionKind) {
  for (const schema of Object.values(spec.components?.schemas ?? {})) {
    const resolvedSchema = apiGen.resolve(schema);

    if ("x-kubernetes-group-version-kind" in resolvedSchema) {
      const schemaGVKs = resolvedSchema[
        "x-kubernetes-group-version-kind"
      ] as GroupVersionKind[];

      for (const schemaGVK of schemaGVKs) {
        if (
          schemaGVK.group === gvk.group &&
          schemaGVK.version === gvk.version &&
          schemaGVK.kind === gvk.kind
        ) {
          return resolvedSchema;
        }
      }
    }
  }
}

function getSpecSchema(
  schema: OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject
) {
  const specProperty = schema?.properties?.spec;
  const specSchema = specProperty && apiGen.resolve(specProperty);

  const allOfValue = specSchema?.allOf?.[0];

  if (!allOfValue) {
    throw new Error("spec schema does not have allOf property");
  }

  return apiGen.resolve(allOfValue);
}

function gvkMatches(gvka: GroupVersionKind, gvkb: GroupVersionKind) {
  return (
    gvka.group === gvkb.group &&
    gvka.version === gvkb.version &&
    gvka.kind === gvkb.kind
  );
}

function registerGKVType(gvk: GroupVersionKind, type: ts.TypeAliasDeclaration) {
  const alreadyExists = gkvTypeExists(gvk);
  if (!alreadyExists) {
    gvkTypes.push([gvk, type]);
  }
}

function gkvTypeExists(gvk: GroupVersionKind) {
  return gvkTypes.find(([existingGvk]) => gvkMatches(existingGvk, gvk));
}

function createAndRegisterKindInterface(
  groupVersionKind: GroupVersionKind,
  specSchema: OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject
) {
  const tsName = capitalize(groupVersionKind.kind);

  if (gkvTypeExists(groupVersionKind)) {
    return tsName;
  }

  const kindTsTypeDecl = apiGen.getTypeFromSchema(specSchema, "readOnly");

  const kindTsTypeAlias = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    tsName,
    [],
    kindTsTypeDecl
  );

  const typeDeclWithComment = ts.addSyntheticLeadingComment(
    kindTsTypeAlias,
    ts.SyntaxKind.SingleLineCommentTrivia,
    ` ${JSON.stringify(groupVersionKind)} `,
    true
  );

  registerGKVType(groupVersionKind, typeDeclWithComment);

  return tsName;
}

function createLibTypeReference(
  typeName: string,
  resourceTypeName: string,
  group: string
) {
  return ts.factory.createExpressionWithTypeArguments(
    ts.factory.createIdentifier(typeName),
    [
      ts.factory.createTypeReferenceNode(resourceTypeName),
      ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(group)),
    ]
  );
}

console.log("\n+++\n");

// make imports
const commonLibImportMembers = Array.from(usedCommonLibImports).map((name) =>
  ts.factory.createImportSpecifier(
    true,
    undefined,
    ts.factory.createIdentifier(name)
  )
);
const commonLibImport = ts.factory.createImportDeclaration(
  [],
  ts.factory.createImportClause(
    false,
    undefined,
    ts.factory.createNamedImports(commonLibImportMembers)
  ),
  ts.factory.createStringLiteral("./commonLib")
);

const sourceFile = ts.factory.createSourceFile(
  [
    commonLibImport,
    injectedRtkApiNode,
    ...apiGen.aliases,
    ...gvkTypes.map((v) => v[1]),
    ...Object.values(interfaces),
  ],
  ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
  ts.NodeFlags.None
);

const printedSourceFile = tsPrinter.printNode(
  ts.EmitHint.Unspecified,
  sourceFile,
  tsResultFile
);

const prettySourceFile = await prettier.format(printedSourceFile, {
  parser: "typescript",
});

const emph = emphasize.createEmphasize(emphasize.common);
const coloredSourceFile = emph.highlight("ts", prettySourceFile).value;
console.log(coloredSourceFile);

await fs.writeFile(OUTPUT_PATH, prettySourceFile);

function capitalize(str: string) {
  return str.replace(str[0], str[0].toUpperCase());
}
