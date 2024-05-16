import { generateEndpoints } from "@rtk-query/codegen-openapi";
import fs from "fs";

const api = await generateEndpoints({
  apiFile: "./emptyApi.ts",
  schemaFile: "../grafana/pkg/tests/apis/playlist/testdata/openapi.json",
  hooks: true,
  filterEndpoints: ["readNamespacedPlaylist"],
});

console.log(api);
