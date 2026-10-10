import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { Logger } from "nestjs-pino";
import { redactInvitationTokenFromPath } from "./redact-invitation-token.js";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
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

    if (status >= 500) {
      this.logger.error(
        {
          requestId: request.id,
          path: redactInvitationTokenFromPath(request.path),
          errorType: exception instanceof Error ? exception.constructor.name : "UnknownError",
        },
        "Необработанная ошибка HTTP API",
      );
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
      });
  }
}
