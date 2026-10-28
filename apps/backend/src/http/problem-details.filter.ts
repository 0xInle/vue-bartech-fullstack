import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { Logger } from "nestjs-pino";
import { redactInvitationTokenFromPath } from "./redact-invitation-token.js";
import { readArchiveProblem } from "../products/archive-problem-details.js";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<
      Request & {
        id?: string;
        log?: { error: (context: Record<string, unknown>, message: string) => void };
      }
    >();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const safeDetail =
      status < 500 &&
      typeof exceptionBody === "object" &&
      exceptionBody !== null &&
      "message" in exceptionBody
        ? exceptionBody.message
        : undefined;
    const detail = Array.isArray(safeDetail)
      ? safeDetail.join("; ")
      : typeof safeDetail === "string"
        ? safeDetail
        : status < 500 && exception instanceof Error
          ? exception.message
          : undefined;
    const preparationImpact =
      status === HttpStatus.CONFLICT ? readPreparationImpact(exceptionBody) : null;
    const garnishImpact = status === HttpStatus.CONFLICT ? readGarnishImpact(exceptionBody) : null;
    const catalogCandidateProblem =
      status === HttpStatus.CONFLICT ? readCatalogCandidateProblem(exceptionBody) : null;

    if (status >= 500) {
      const stackTrace =
        exception instanceof Error ? exception.stack?.split("\n").slice(1).join("\n") : undefined;
      const errorContext = {
        requestId: request.id,
        path: redactInvitationTokenFromPath(request.path),
        errorType: exception instanceof Error ? exception.constructor.name : "UnknownError",
        ...(stackTrace ? { stackTrace } : {}),
      };

      if (request.log) {
        request.log.error(errorContext, "Необработанная ошибка HTTP API");
      } else {
        this.logger.error(errorContext, "Необработанная ошибка HTTP API");
      }
    }

    const titles: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: "Неверный запрос",
      [HttpStatus.UNAUTHORIZED]: "Требуется авторизация",
      [HttpStatus.FORBIDDEN]: "Недостаточно прав",
      [HttpStatus.NOT_FOUND]: "Не найдено",
      [HttpStatus.CONFLICT]: "Конфликт данных",
      [HttpStatus.UNPROCESSABLE_ENTITY]: "Данные не прошли проверку",
      [HttpStatus.TOO_MANY_REQUESTS]: "Слишком много запросов",
      [HttpStatus.SERVICE_UNAVAILABLE]: "Сервис временно недоступен",
    };

    response
      .status(status)
      .type("application/problem+json")
      .json({
        type: `https://httpstatuses.com/${status}`,
        title: status >= 500 ? "Внутренняя ошибка сервера" : (titles[status] ?? "Ошибка запроса"),
        status,
        ...(detail ? { detail } : {}),
        instance: redactInvitationTokenFromPath(request.originalUrl),
        ...(request.id ? { requestId: request.id } : {}),
        ...(preparationImpact ?? {}),
        ...(garnishImpact ?? {}),
        ...(catalogCandidateProblem ?? {}),
        ...(status === HttpStatus.CONFLICT ? (readArchiveProblem(exceptionBody) ?? {}) : {}),
      });
  }
}

function readCatalogCandidateProblem(
  value: unknown,
): { code: "CATALOG_CANDIDATE_UNAVAILABLE" } | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Record<string, unknown>;
  return response.code === "CATALOG_CANDIDATE_UNAVAILABLE"
    ? { code: "CATALOG_CANDIDATE_UNAVAILABLE" }
    : null;
}

function readGarnishImpact(value: unknown): {
  code: "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED";
  affectedProducts: Array<{ id: string; type: "COCKTAIL"; name: string }>;
  confirmationFingerprint: string;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Record<string, unknown>;
  if (response.code !== "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED") return null;
  if (
    !Array.isArray(response.affectedProducts) ||
    !response.affectedProducts.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        (item as Record<string, unknown>).type === "COCKTAIL",
    ) ||
    typeof response.confirmationFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(response.confirmationFingerprint)
  ) {
    return null;
  }
  return {
    code: response.code,
    affectedProducts: response.affectedProducts.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      type: "COCKTAIL",
      name: item.name as string,
    })),
    confirmationFingerprint: response.confirmationFingerprint,
  };
}

function readPreparationImpact(value: unknown): {
  code: "PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED";
  affectedProducts: Array<{
    id: string;
    type: "PREPARATION" | "GARNISH" | "COCKTAIL";
    name: string;
  }>;
  confirmationFingerprint: string;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Record<string, unknown>;
  if (response.code !== "PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED") return null;
  if (
    !Array.isArray(response.affectedProducts) ||
    !response.affectedProducts.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        ["PREPARATION", "GARNISH", "COCKTAIL"].includes(
          String((item as Record<string, unknown>).type),
        ),
    ) ||
    typeof response.confirmationFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(response.confirmationFingerprint)
  ) {
    return null;
  }
  return {
    code: response.code,
    affectedProducts: response.affectedProducts,
    confirmationFingerprint: response.confirmationFingerprint,
  };
}
