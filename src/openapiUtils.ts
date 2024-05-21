import ApiGenerator from "oazapfts/generate";
import { OpenAPIOperation } from "./types.js";
import { OpenAPIV3 } from "openapi-types";

export function getReturnSchema(
  apiGen: ApiGenerator,
  operation: OpenAPIOperation
): OpenAPIV3.SchemaObject | undefined {
  const response200 = apiGen.resolve(operation.responses["200"]);
  return getSchemaFromContent(apiGen, response200.content);
}

const VALID_CONTENT_TYPES = ["application/json", "*/*"];

export function getSchemaFromContent(
  apiGen: ApiGenerator,
  content: OpenAPIV3.RequestBodyObject["content"] | undefined
): OpenAPIV3.SchemaObject | undefined {
  for (const contentType of VALID_CONTENT_TYPES) {
    if (content?.[contentType]?.schema) {
      return apiGen.resolve(content[contentType].schema);
    }
  }

  return undefined;
}
