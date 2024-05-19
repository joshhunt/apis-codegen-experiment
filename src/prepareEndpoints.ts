import ApiGenerator, { getOperationName } from "oazapfts/generate";
import { OpenAPIV3 } from "openapi-types";
import { GroupVersionKind, OpenAPIOperation, OperationDef } from "./types.js";
import { capitalize } from "./utils.js";
import { printNode } from "./tsUtils.js";
import { getReturnSchema } from "./openapiUtils.js";

const VALID_METHODS = ["get", "post", "put", "delete", "patch"];

function isOperationObject(
  obj: OpenAPIV3.PathItemObject[keyof OpenAPIV3.PathItemObject]
): obj is OpenAPIV3.OperationObject {
  return typeof obj === "object" && "responses" in obj;
}

export function getAllOperations(
  apiGen: ApiGenerator,
  spec: OpenAPIV3.Document
): OperationDef[] {
  const operations = Object.entries(spec.paths).flatMap(
    ([path, operationsForPath]) => {
      if (!operationsForPath) return [];

      const pathParameters = operationsForPath.parameters?.map(apiGen.resolve);

      return Object.entries(operationsForPath)
        .filter(
          (arg): arg is [string, OpenAPIV3.OperationObject] =>
            VALID_METHODS.includes(arg[0]) && isOperationObject(arg[1])
        )
        .map(([method, operation]) => {
          if (typeof operation === "string") {
            throw new Error("expected operation to be an object");
          }

          const def: OperationDef = {
            method,
            path,
            operation,
            pathParameters: pathParameters,
          };

          return def;
        });
    }
  );

  return operations;
}

interface CommonLibType {
  typeType: "commonlib";

  // export type ${typeAliasName} = ${libTypeName}<${specTypeName}, ${k8sGroup}>
  typeAliasName: string;
  libTypeName: string;

  kindTypeName: string;
  kindSchema: OpenAPIV3.SchemaObject;

  k8sGroup: string;
}

interface BasicType {
  typeType: "basic";

  // export type ${typeAliasName} = ${...specType}
  typeAliasName: string;
  schema: OpenAPIV3.SchemaObject;
}

type TypeDef = CommonLibType | BasicType;

/**
 * Describes a method for calling the API, independent of the specific generation.
 * It can describe types as OpenAPI specs/JSON Schema.
 * It can describe Typescript types, but not use any TypeScript types.
 */
interface EndpointDef {
  path: string;
  method: string;
  argsType: TypeDef; // ??
  returnType: TypeDef;
}

function getFallbackReturnType(
  apiGen: ApiGenerator,
  operationDef: OperationDef,
  typeAliasName: string
): TypeDef {
  const { operation } = operationDef;
  const returnSchema = getReturnSchema(apiGen, operation);

  if (!returnSchema) {
    throw new Error("Unable to get return schema");
  }

  return {
    typeType: "basic" as const,

    typeAliasName,
    schema: returnSchema,
  };
}

const VALID_K8S_ACTIONS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "deletecollection",
  "list",
];

function getReturnType(
  apiGen: ApiGenerator,
  operationDef: OperationDef
): TypeDef {
  const { operation } = operationDef;
  const endpointName = getEndpointName(operationDef);
  const typeAliasName = capitalize(endpointName) + "ApiResponse";

  const k8Action = operation["x-kubernetes-action"];
  const k8GroupVersionKind = operation["x-kubernetes-group-version-kind"];

  if (
    !k8Action ||
    !k8GroupVersionKind ||
    !VALID_K8S_ACTIONS.includes(k8Action)
  ) {
    return getFallbackReturnType(apiGen, operationDef, typeAliasName);
  }

  const kindTypeName = capitalize(k8GroupVersionKind.kind);

  const containingSchema = findSchemaForGroupVersionKind(
    apiGen,
    k8GroupVersionKind
  );
  const kindSchema =
    containingSchema && getSpecSchema(apiGen, containingSchema);

  if (!kindSchema) {
    return getFallbackReturnType(apiGen, operationDef, typeAliasName);
  }

  let libTypeName = "";

  if (
    k8Action === "get" ||
    k8Action === "post" ||
    k8Action === "put" ||
    k8Action === "patch"
  ) {
    libTypeName = "Resource";
  } else if (k8Action === "list") {
    libTypeName = "ResourceList";
  } else if (k8Action === "delete" || k8Action === "deletecollection") {
    libTypeName = "MetaStatus";
  } else {
    throw new Error("Unhandled k8s action: " + k8Action);
  }

  return {
    typeType: "commonlib",

    typeAliasName,

    libTypeName,

    kindTypeName,
    kindSchema,

    k8sGroup: k8GroupVersionKind.group,
  };
}

export async function prepareEndpoint(
  apiGen: ApiGenerator,
  operationDef: OperationDef
) {
  const { operation, path, method } = operationDef;

  console.log("\n===", method.toUpperCase(), operation.operationId, "===");
  console.log(path);

  const k8Action = operation["x-kubernetes-action"];
  const k8GroupVersionKind = operation["x-kubernetes-group-version-kind"];

  console.log("k8Action:", k8Action);
  console.log(
    "k8GroupVersionKind:",
    k8GroupVersionKind?.group,
    k8GroupVersionKind?.version,
    k8GroupVersionKind?.kind
  );

  const { typeType, ...returnType } = getReturnType(apiGen, operationDef);

  if ("schema" in returnType) {
    const { schema, typeAliasName } = returnType;
    console.log("returns", typeType, `type ${typeAliasName} = `);

    const schemaTsType = apiGen.getTypeFromSchema(returnType.schema);
    await printNode(schemaTsType, false);
  } else {
    console.log(
      "returns",
      typeType,
      `type ${returnType.typeAliasName} = ${returnType.libTypeName}<${returnType.kindTypeName}, ${returnType.k8sGroup}>`
    );

    const schemaTsType = apiGen.getTypeFromSchema(returnType.kindSchema);
    await printNode(schemaTsType, false);
  }
}

function findSchemaForGroupVersionKind(
  apiGen: ApiGenerator,
  gvk: GroupVersionKind
) {
  const schemas = (apiGen.spec as OpenAPIV3.Document).components?.schemas;

  if (!schemas) {
    throw new Error("no schemas found in spec");
  }

  for (const schema of Object.values(schemas)) {
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
  apiGen: ApiGenerator,
  schema: OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject
) {
  const specProperty = schema?.properties?.spec;
  const specSchema = specProperty && apiGen.resolve(specProperty);

  const allOfValue = specSchema?.allOf?.[0];

  return apiGen.resolve(allOfValue);
}

function getEndpointName(operationDef: OperationDef) {
  const { method, path, operation, pathParameters } = operationDef;
  const op = operation as OpenAPIOperation;

  const k8sAction = op["x-kubernetes-action"];
  const k8sGroupVersionKind = op["x-kubernetes-group-version-kind"];

  const specOperationName = getOperationName(method, path, op.operationId);
  const isNamespaced = Boolean(
    pathParameters?.some((v) => v.name === "namespace")
  );

  const suffix = k8sAction && !isNamespaced ? "ForAllNamespaces" : "";

  const endpointName =
    k8sAction && k8sGroupVersionKind
      ? k8sAction + capitalize(k8sGroupVersionKind.kind) + suffix
      : specOperationName;

  return endpointName;
}
