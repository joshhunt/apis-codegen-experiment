import { OpenAPIV3 } from "openapi-types";

export function preprocessSpec(spec: OpenAPIV3.Document) {
  const jason = JSON.stringify(spec, (key, value) => {
    return key === "description" ? undefined : value;
  });
  const parsed = JSON.parse(jason);

  return parsed;
}
