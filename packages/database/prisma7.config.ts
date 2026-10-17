import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: resolve(fileURLToPath(new URL("../../.env.local", import.meta.url))) });

export default defineConfig({
  schema: "./prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://bartech:bartech_local@localhost:5432/indiebar?schema=public",
  },
});
