import { OpenAPIV3 } from "openapi-types";
import ts from "typescript";

export interface OperationDef {
  method: string;
  path: string;
  operation: OpenAPIV3.OperationObject & {
    parameters?: OpenAPIV3.ParameterObject[];
  };
  pathParameters?: OpenAPIV3.ParameterObject[];
}

export interface ReturnTypeSummary {
  name: string;
  action: string;
  groupVersionKind: GroupVersionKind;
}

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

export interface K8sOperation extends OpenAPIV3.OperationObject {
  "x-kubernetes-action"?: string;
  "x-kubernetes-group-version-kind"?: GroupVersionKind;
}
