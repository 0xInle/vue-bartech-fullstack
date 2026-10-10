import "reflect-metadata";
import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";
import { ProblemDetailsFilter } from "./http/problem-details.filter.js";
import { readCookie } from "@bartech/backend-identity";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(Logger)));

  const config = app.get(ConfigService);
  const expectedOrigin = config.getOrThrow<string>("APP_ORIGIN");
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path.startsWith("/api/v1/invitations/")) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
    }
    next();
  });
  app.use((request: Request, _response: Response, next: NextFunction) => {
    if (
      !request.path.startsWith("/api/v1/") ||
      ["GET", "HEAD", "OPTIONS"].includes(request.method)
    ) {
      next();
      return;
    }

    const origin = request.headers.origin;
    const cookieToken = readCookie(request, "bartech_csrf");
    const headerToken = request.headers["x-csrf-token"];
    if (
      origin !== expectedOrigin ||
      !cookieToken ||
      typeof headerToken !== "string" ||
      Buffer.byteLength(cookieToken) !== Buffer.byteLength(headerToken) ||
      !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
    ) {
      next(new ForbiddenException("Проверка безопасности запроса не пройдена"));
      return;
    }
    next();
  });

  if (config.get("NODE_ENV") !== "production") {
    const options = new DocumentBuilder()
      .setTitle("IndieBar API")
      .setDescription("Служебный контракт API IndieBar")
      .setVersion("1.0.0")
      .addServer("/")
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, options));
  }

  const port = config.get<number>("PORT", 3001);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
