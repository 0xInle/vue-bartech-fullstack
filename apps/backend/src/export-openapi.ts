import "reflect-metadata";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function exportOpenApi(): Promise<void> {
  dotenv.config({ path: resolve(process.cwd(), "../../.env.local") });
  dotenv.config({ path: resolve(process.cwd(), "../../.env.example") });
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix("api/v1");
    await app.init();
    const configuration = new DocumentBuilder()
      .setTitle("IndieBar API")
      .setDescription("Служебный контракт API IndieBar")
      .setVersion("1.0.0")
      .build();
    const document = SwaggerModule.createDocument(app, configuration);
    const outputPath = resolve(process.cwd(), "../../packages/api-client/openapi.json");
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  } finally {
    await app.close();
  }
}

exportOpenApi().catch((error: unknown) => {
  console.error("Не удалось экспортировать OpenAPI:", error);
  process.exitCode = 1;
});
