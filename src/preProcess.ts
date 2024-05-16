import ApiGenerator from "oazapfts/generate";
import { OpenAPIV3 } from "openapi-types";

export function preprocessSpec(spec: OpenAPIV3.Document) {
  const apiGen = new ApiGenerator(spec, {});

  for (const [path, operations] of Object.entries(spec.paths)) {
    if (!operations) continue;
    deleteDescription(operations);

    for (const [method, operation] of Object.entries(operations)) {
      if (typeof operation != "object") continue;
      deleteDescription(operation);

      if ("parameters" in operation) {
        operation.parameters?.forEach((_param) => {
          const param = apiGen.resolve(_param);
          deleteDescription(param);
        });
      }
    }
  }

  for (const _schema of Object.values(spec.components?.schemas ?? {})) {
    const schema = apiGen.resolve(_schema);
    deleteDescription(schema);

    for (const property of Object.values(schema.properties ?? {})) {
      const prop = apiGen.resolve(property);
      deleteDescription(prop);
    }
  }
}

function deleteDescription(obj: any) {
  if (obj.description) {
    delete obj.description;
  }
}
