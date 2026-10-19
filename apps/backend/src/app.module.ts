import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import pino from "pino";
import { z } from "zod";
import { redactInvitationTokenFromPath } from "./http/redact-invitation-token.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { MetaModule } from "./meta/meta.module.js";
import { IdentityModule, OutboxModule } from "@bartech/backend-identity";
import { OrganizationsApiModule } from "./organizations/organizations-api.module.js";
import { ProductsApiModule } from "./products/products-api.module.js";
import { AuditApiModule } from "./audit/audit-api.module.js";
import { FilesModule } from "./files/files.module.js";
import { ExportsApiModule } from "./exports/exports-api.module.js";
import { SupportApiModule } from "./support/support-api.module.js";
import { InternalAuditApiModule } from "./internal-audit/internal-audit-api.module.js";
import { AnalyticsApiModule } from "./analytics/analytics-api.module.js";
import { SchedulesApiModule } from "./schedules/schedules-api.module.js";

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    APP_ORIGIN: z.string().url(),
    OUTBOX_ENCRYPTION_KEY: z.string().min(40),
    INTERNAL_TOTP_ENCRYPTION_KEY: z.string().min(40),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(3),
    PRODUCT_EXPORT_DEADLINE_MINUTES: z.coerce.number().int().min(1).max(120).default(30),
    PRODUCT_EXPORT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    PRODUCT_EXPORT_FAILURE_RETENTION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    CLAMAV_HOST: z.string().min(1),
    CLAMAV_PORT: z.coerce.number().int().positive().max(65535),
    MAIL_HOST: z.string().min(1),
    MAIL_PORT: z.coerce.number().int().positive().max(65535),
    MAIL_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    MAIL_FROM: z.string().email(),
    MAIL_USER: z.string().optional(),
    MAIL_PASSWORD: z.string().optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === "production" &&
      new URL(environment.S3_ENDPOINT).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "В production endpoint хранилища должен использовать HTTPS",
      });
    }
  });

function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`);
    throw new Error(`Некорректная конфигурация окружения: ${issues.join("; ")}`);
  }
  return parsed.data;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), "../../.env.local"),
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL", "info"),
          serializers: {
            req(request) {
              const serialized = pino.stdSerializers.req(request);
              return { ...serialized, url: redactInvitationTokenFromPath(serialized.url) };
            },
          },
          genReqId: (
            request: { headers: Record<string, string | string[] | undefined> },
            response: { setHeader: (name: string, value: string) => void },
          ) => {
            const incoming = request.headers["x-request-id"];
            const requestId =
              typeof incoming === "string" && /^[\\w-]{1,128}$/.test(incoming)
                ? incoming
                : randomUUID();
            response.setHeader("x-request-id", requestId);
            return requestId;
          },
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers.referer",
              "req.body",
              "*.password",
              "*.token",
              "*.secret",
            ],
            censor: "[REDACTED]",
          },
        },
      }),
    }),
    DatabaseModule,
    HealthModule,
    MetaModule,
    OutboxModule,
    IdentityModule,
    OrganizationsApiModule,
    ProductsApiModule,
    AuditApiModule,
    FilesModule,
    ExportsApiModule,
    SupportApiModule,
    InternalAuditApiModule,
    AnalyticsApiModule,
    SchedulesApiModule,
  ],
})
export class AppModule {}
