import ApiGenerator from "oazapfts/generate";
import { OpenAPIOperation } from "./types.js";
import { OpenAPIV3 } from "openapi-types";

export function getReturnSchema(
  apiGen: ApiGenerator,
  operation: OpenAPIOperation
): OpenAPIV3.SchemaObject | undefined {
  const response200 = apiGen.resolve(operation.responses["200"]);
  const returnSpec = apiGen.resolve(
    response200.content?.["application/json"].schema
  );

  return returnSpec;
}
