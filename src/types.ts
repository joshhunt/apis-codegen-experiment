import { OpenAPIV3 } from "openapi-types";
import ts from "typescript";

export interface OpenAPIOperation extends OpenAPIV3.OperationObject {
  "x-kubernetes-action"?: string;
  "x-kubernetes-group-version-kind"?: GroupVersionKind;
}

export interface OperationDef {
  method: string;
  path: string;
  operation: OpenAPIOperation;
  pathParameters?: OpenAPIV3.ParameterObject[];
}

/** @deprecated */
export interface ReturnTypeSummary {
  name: string;
  action: string;
  groupVersionKind: GroupVersionKind;
}

/** @deprecated */
export interface ParamsTypeSummary extends ReturnTypeSummary {
  paramSchemas: OpenAPIV3.ParameterObject[];
}

export interface EndpointDef {
  endpointName: string;
  builderCall: ts.CallExpression;
  returnType: ReturnTypeSummary;
  paramsType: ParamsTypeSummary;
  usedStringifySelector: boolean;
}

export interface GroupVersionKind {
  group: string;
  kind: string;
  version: string;
}
