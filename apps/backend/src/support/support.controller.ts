import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentInternalIdentity,
  CurrentUser,
  InternalSessionGuard,
  SessionGuard,
  type AuthenticatedUser,
} from "@bartech/backend-identity";
import {
  CreateSupportRequestDto,
  SupportQueueQueryDto,
  SupportRequestQueuePageDto,
  SupportRequestQueueItemDto,
  SupportRequestResponseDto,
  SupportInternalUserResponseDto,
  UpdateSupportRequestDto,
} from "@bartech/backend-support";
import {
  SUPPORT_FILE_MAX_BYTES,
  SupportService,
  type SupportUploadFile,
} from "@bartech/backend-support";
import { InternalSupportPermissionGuard } from "./internal-support-permission.guard.js";

@ApiTags("support")
@Controller("support/requests")
@UseGuards(SessionGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: SUPPORT_FILE_MAX_BYTES, files: 1, fields: 6, parts: 7, fieldSize: 8192 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason", "message"],
      properties: {
        reason: { type: "string", enum: ["data_migration", "error", "other"] },
        message: { type: "string", maxLength: 5000 },
        companyId: { type: "string", format: "uuid" },
        venueId: { type: "string", format: "uuid" },
        browser: { type: "string", maxLength: 200 },
        errorId: { type: "string", maxLength: 128 },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiOperation({ summary: "Создать обращение в поддержку" })
  @ApiCreatedResponse({ type: SupportRequestResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateSupportRequestDto,
    @UploadedFile() file?: SupportUploadFile,
  ) {
    return this.support.create(user.id, input, file);
  }

  @Get()
  @ApiOperation({ summary: "Получить собственные обращения" })
  @ApiOkResponse({ type: [SupportRequestResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user.id);
  }

  @Get(":requestId")
  @ApiOperation({ summary: "Получить собственное обращение" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiOkResponse({ type: SupportRequestResponseDto })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ) {
    return this.support.getMine(user.id, requestId);
  }

  @Get(":requestId/attachment/download")
  @ApiOperation({ summary: "Получить временную ссылку на прошедшее проверку вложение" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiOkResponse({
    schema: {
      properties: { url: { type: "string", format: "uri" }, expiresInSeconds: { type: "number" } },
    },
  })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ) {
    return this.support.createDownloadUrl(requestId, { userId: user.id });
  }
}

@ApiTags("internal-support")
@Controller("internal/support")
@UseGuards(InternalSessionGuard, InternalSupportPermissionGuard)
export class InternalSupportController {
  constructor(private readonly support: SupportService) {}

  @Get("requests")
  @ApiOperation({ summary: "Получить очередь обращений поддержки" })
  @ApiOkResponse({ type: SupportRequestQueuePageDto })
  list(@Query() query: SupportQueueQueryDto) {
    return this.support.listQueue(query);
  }

  @Get("requests/:requestId")
  @ApiOperation({ summary: "Получить обращение из внутренней очереди" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiOkResponse({ type: SupportRequestQueueItemDto })
  get(@Param("requestId", new ParseUUIDPipe()) requestId: string) {
    return this.support.getQueueItem(requestId);
  }

  @Get("users")
  @ApiOperation({ summary: "Получить активных внутренних сотрудников для назначения" })
  @ApiOkResponse({ type: [SupportInternalUserResponseDto] })
  listInternalUsers() {
    return this.support.listInternalUsers();
  }

  @Patch("requests/:requestId")
  @ApiOperation({ summary: "Изменить статус или назначить ответственного" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiOkResponse({ type: SupportRequestResponseDto })
  update(
    @CurrentInternalIdentity() identity: { user: { id: string } },
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() input: UpdateSupportRequestDto,
  ) {
    return this.support.update(identity.user.id, requestId, input);
  }

  @Get("requests/:requestId/attachment/download")
  @ApiOperation({ summary: "Получить временную ссылку на проверенное вложение" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiOkResponse({
    schema: {
      properties: { url: { type: "string", format: "uri" }, expiresInSeconds: { type: "number" } },
    },
  })
  download(@Param("requestId", new ParseUUIDPipe()) requestId: string) {
    return this.support.createDownloadUrl(requestId, { internal: true });
  }
}
