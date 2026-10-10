import { defineConfig } from "orval";

export default defineConfig({
  bartech: {
    input: "./openapi.json",
    output: {
      target: "./src/generated/index.ts",
      schemas: "./src/generated/models",
      client: "vue-query",
      mode: "tags-split",
      clean: true,
      override: {
        fetch: {
          useRuntimeFetcher: true,
        },
        query: {
          signal: true,
        },
      },
    },
  },
});
