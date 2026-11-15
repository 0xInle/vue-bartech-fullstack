import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
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
  CreateSupportMessageDto,
  CreateInternalSupportMessageDto,
  MarkSupportMessagesReadDto,
  SupportMessageResponseDto,
  SupportUnreadCountDto,
  SupportQueueQueryDto,
  SupportRequestQueuePageDto,
  SupportRequestQueueItemDto,
  SupportRequestResponseDto,
  SupportInternalUserResponseDto,
  UpdateSupportRequestDto,
} from "@bartech/backend-support";
import {
  SUPPORT_FILE_MAX_BYTES,
  SUPPORT_FILE_MAX_COUNT,
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
    FilesInterceptor("files", SUPPORT_FILE_MAX_COUNT, {
      limits: {
        fileSize: SUPPORT_FILE_MAX_BYTES,
        files: SUPPORT_FILE_MAX_COUNT,
        fields: 6,
        parts: 11,
        fieldSize: 8192,
      },
      defParamCharset: "utf8",
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason", "message"],
      properties: {
        reason: { type: "string", enum: ["data_migration", "error", "other"] },
        message: { type: "string", maxLength: 1000 },
        companyId: { type: "string", format: "uuid" },
        venueId: { type: "string", format: "uuid" },
        browser: { type: "string", maxLength: 200 },
        errorId: { type: "string", maxLength: 128 },
        files: {
          type: "array",
          maxItems: SUPPORT_FILE_MAX_COUNT,
          items: { type: "string", format: "binary" },
        },
      },
    },
  })
  @ApiOperation({ summary: "Создать обращение в поддержку" })
  @ApiCreatedResponse({ type: SupportRequestResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateSupportRequestDto,
    @UploadedFiles() files?: SupportUploadFile[],
  ) {
    return this.support.create(user.id, input, files);
  }

  @Get()
  @ApiOperation({ summary: "Получить собственные обращения" })
  @ApiOkResponse({ type: [SupportRequestResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user.id);
  }

  @Get("unread-count")
  @ApiOkResponse({ type: SupportUnreadCountDto })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.support.getUnreadCount({ userId: user.id });
  }

  @Get(":requestId/messages")
  @ApiOkResponse({ type: [SupportMessageResponseDto] })
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ) {
    return this.support.getMessages(requestId, { userId: user.id });
  }

  @Post(":requestId/messages/read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() input: MarkSupportMessagesReadDto,
  ) {
    return this.support.markMessagesRead(requestId, input.throughMessageId, { userId: user.id });
  }

  @Post(":requestId/messages")
  @UseInterceptors(
    FilesInterceptor("files", SUPPORT_FILE_MAX_COUNT, {
      limits: {
        fileSize: SUPPORT_FILE_MAX_BYTES,
        files: SUPPORT_FILE_MAX_COUNT,
        fields: 1,
        parts: 7,
      },
      defParamCharset: "utf8",
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        message: { type: "string", maxLength: 1000 },
        files: {
          type: "array",
          maxItems: SUPPORT_FILE_MAX_COUNT,
          items: { type: "string", format: "binary" },
        },
      },
    },
  })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() input: CreateSupportMessageDto,
    @UploadedFiles() files?: SupportUploadFile[],
  ) {
    return this.support.createCustomerMessage(user.id, requestId, input, files);
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

  @Get(":requestId/attachments/:attachmentId/download")
  @ApiOperation({ summary: "Получить временную ссылку на прошедшее проверку вложение" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiParam({ name: "attachmentId", format: "uuid" })
  @ApiOkResponse({
    schema: {
      properties: { url: { type: "string", format: "uri" }, expiresInSeconds: { type: "number" } },
    },
  })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.support.createDownloadUrl(requestId, attachmentId, { userId: user.id });
  }
}

@ApiTags("internal-support")
@Controller("internal/support")
@UseGuards(InternalSessionGuard, InternalSupportPermissionGuard)
export class InternalSupportController {
  constructor(private readonly support: SupportService) {}

  @Get("requests/unread-count")
  unreadCount() {
    return this.support.getUnreadCount({ internal: true });
  }

  @Get("requests/:requestId/messages")
  messages(@Param("requestId", new ParseUUIDPipe()) requestId: string) {
    return this.support.getMessages(requestId, { internal: true });
  }

  @Post("requests/:requestId/messages/read")
  markRead(
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() input: MarkSupportMessagesReadDto,
  ) {
    return this.support.markMessagesRead(requestId, input.throughMessageId, { internal: true });
  }

  @Post("requests/:requestId/messages")
  sendMessage(
    @CurrentInternalIdentity() identity: { user: { id: string } },
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Body() input: CreateInternalSupportMessageDto,
  ) {
    return this.support.createInternalMessage(identity.user.id, requestId, input);
  }

  @Post("requests/:requestId/access-grants/:grantId/revoke")
  @ApiOperation({ summary: "Отозвать временный доступ из очереди поддержки" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiParam({ name: "grantId", format: "uuid" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        active: { type: "boolean" },
        revokedAt: { type: "string", format: "date-time", nullable: true },
        expiresAt: { type: "string", format: "date-time" },
      },
    },
  })
  revokeAccess(
    @CurrentInternalIdentity() identity: { user: { id: string } },
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Param("grantId", new ParseUUIDPipe()) grantId: string,
  ) {
    return this.support.revokeAccessBySupport(identity.user.id, requestId, grantId);
  }

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

  @Get("requests/:requestId/attachments/:attachmentId/download")
  @ApiOperation({ summary: "Получить временную ссылку на проверенное вложение" })
  @ApiParam({ name: "requestId", format: "uuid" })
  @ApiParam({ name: "attachmentId", format: "uuid" })
  @ApiOkResponse({
    schema: {
      properties: { url: { type: "string", format: "uri" }, expiresInSeconds: { type: "number" } },
    },
  })
  download(
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.support.createDownloadUrl(requestId, attachmentId, { internal: true });
  }
}
