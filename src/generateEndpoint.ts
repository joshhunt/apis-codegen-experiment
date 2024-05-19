import { getOperationName, isValidIdentifier } from "oazapfts/generate";
import { GroupVersionKind, OpenAPIOperation, OperationDef } from "./types.js";
import { capitalize } from "./utils.js";
import ts from "typescript";
import { accessProperty, createObject, printNode } from "./tsUtils.js";

const parametersForAction: Record<string, string[]> = {
  list: ["namespace", "continue", "labelSelector", "fieldSelector", "limit"],
  post: ["namespace"],
  delete: ["namespace", "name"],
  deletecollection: ["namespace"],
  get: ["namespace", "name"],
  patch: ["namespace", "name"],
  put: ["namespace", "name"],
};

const BUILD_DOT_QUERY = ts.factory.createPropertyAccessExpression(
  ts.factory.createIdentifier("build"),
  "query"
);

const BUILD_DOT_MUTATION = ts.factory.createPropertyAccessExpression(
  ts.factory.createIdentifier("build"),
  "mutation"
);

export async function generateEndpoint(operationDef: OperationDef) {
  console.log("------");
  const { method, path, operation } = operationDef;
  const op = operation as OpenAPIOperation;

  const endpointName = getEndpointName(operationDef);

  // if (endpointName !== "listPlaylist") {
  //   return;
  // }

  console.log(method.toUpperCase(), endpointName, path);

  const k8sAction = op["x-kubernetes-action"];
  const k8sGroupVersionKind = op["x-kubernetes-group-version-kind"];
  console.log("k8sAction:", k8sAction);
  console.log("k8sGroupVersionKind:", k8sGroupVersionKind);

  if (k8sAction === "watchlist") {
    return;
  }

  if (!k8sAction || !k8sGroupVersionKind) {
    // TODO: Implement generation for non-K8s endpoints
    return;
  }

  const isMutation = method !== "get";
  const { queryFn, usedParams, usedStringifySelector } = await generateQueryFn(
    operationDef,
    k8sAction
  );

  const returnType = {
    name: capitalize(endpointName) + "Response",
    action: k8sAction,
    groupVersionKind: k8sGroupVersionKind,
  };

  const paramsType = {
    name: capitalize(endpointName) + "Params",
    paramSchemas: usedParams,
    action: k8sAction,
    groupVersionKind: k8sGroupVersionKind,
  };

  const returnTypeTypeArg = ts.factory.createTypeReferenceNode(returnType.name);
  const paramsTypeTypeArg = ts.factory.createTypeReferenceNode(paramsType.name);

  const builderCall = ts.factory.createCallExpression(
    isMutation ? BUILD_DOT_MUTATION : BUILD_DOT_QUERY,
    [returnTypeTypeArg, paramsTypeTypeArg],
    [
      createObject({
        query: queryFn,
      }),
    ]
  );

  await printNode(builderCall);

  return {
    endpointName,
    builderCall,
    returnType,
    paramsType,
    usedStringifySelector,
  };
}

function getEndpointName(operationDef: OperationDef) {
  const { method, path, operation, pathParameters } = operationDef;
  const op = operation;

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

async function generateQueryFn(operationDef: OperationDef, k8sAction: string) {
  const { path, pathParameters } = operationDef;
  // console.log(
  //   "operationDef.operation.parameters",
  //   operationDef.operation.parameters
  // );
  // console.log("pathParameters", pathParameters);

  const k8sAllowedParams = parametersForAction[k8sAction];
  let usedStringifySelector = false;

  const allParams = [
    ...(pathParameters ?? []),
    ...(operationDef.operation.parameters ?? []),
  ].filter((param) => {
    return k8sAllowedParams?.includes(param.name) ?? true;
  });

  const queryArg = ts.factory.createIdentifier("queryArg");

  const replaceParam = (propName: string) => {
    if (propName === "namespace") {
      return accessProperty("config", "namespace");
    }
  };
  const pathExpression = generatePathExpression(
    path,
    allParams,
    queryArg,
    false,
    replaceParam
  );

  const queryParams = allParams.filter((p) => p.in === "query");

  const queryObj: {
    url: ts.Expression;
    params?: ts.ObjectLiteralExpression;
  } = {
    url: pathExpression,
  };

  if (Object.keys(queryParams).length > 0) {
    const paramsObject = ts.factory.createObjectLiteralExpression(
      queryParams.map((param) => {
        let propertyValue:
          | ts.CallExpression
          | ts.PropertyAccessExpression
          | ts.ElementAccessExpression = accessProperty(queryArg, param.name);

        if (param.name === "labelSelector" || param.name === "fieldSelector") {
          usedStringifySelector = true;
          propertyValue = ts.factory.createCallExpression(
            ts.factory.createIdentifier("stringifySelector"),
            undefined,
            [propertyValue]
          );
        }

        return ts.factory.createPropertyAssignment(param.name, propertyValue);
      })
    );

    queryObj.params = paramsObject;
  }

  const queryObject = createObject(queryObj);

  const queryFn = ts.factory.createArrowFunction(
    undefined,
    undefined,
    [ts.factory.createParameterDeclaration(undefined, undefined, queryArg)],
    undefined,
    undefined,
    ts.factory.createParenthesizedExpression(queryObject)
  );

  // await printNode(queryFn);

  const usedParams = allParams.filter(
    (p) => (p.in === "path" || p.in === "query") && p.name !== "namespace"
  );

  return { queryFn, usedStringifySelector, usedParams };
}

// TODO: attribute to rtk query codegen
// packages/rtk-query-codegen-openapi/src/generate.ts
function generatePathExpression(
  path: string,
  pathParameters: OperationDef["pathParameters"],
  rootObject: ts.Identifier,
  isFlatArg: boolean,
  replaceParam?: (propName: string) => ts.Expression | undefined
) {
  pathParameters = pathParameters ?? [];

  const expressions: Array<[string, string]> = [];

  const head = path.replace(
    /\{(.*?)}(.*?)(?=\{|$)/g,
    (_, expression, literal) => {
      const param = pathParameters.find((p) => p.name === expression);

      if (!param) {
        throw new Error(
          `path parameter ${expression} does not seem to be defined in '${path}'!`
        );
      }

      expressions.push([param.name, literal]);
      return "";
    }
  );

  return expressions.length
    ? ts.factory.createTemplateExpression(
        ts.factory.createTemplateHead(head),
        expressions.map(([prop, literal], index) => {
          const replacedParam = replaceParam?.(prop);

          const templateValue = replacedParam
            ? replacedParam
            : isFlatArg
              ? rootObject
              : accessProperty(rootObject, prop);

          return ts.factory.createTemplateSpan(
            templateValue,

            index === expressions.length - 1
              ? ts.factory.createTemplateTail(literal)
              : ts.factory.createTemplateMiddle(literal)
          );
        })
      )
    : ts.factory.createNoSubstitutionTemplateLiteral(head);
}
