import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
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
import { CreateSupportAccessGrantDto, SupportAccessService } from "@bartech/backend-support";
import type { Request } from "express";

type InternalRequest = Request & {
  internalIdentity?: { user: { id: string; permissions: string[] } };
};

@Injectable()
export class ServiceAccessPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    if (!request.internalIdentity?.user.permissions.includes("service_access")) {
      throw new ForbiddenException("Нет разрешения на служебный доступ");
    }
    return true;
  }
}

@ApiTags("support-access")
@Controller("support/access-grants")
@UseGuards(SessionGuard)
export class SupportAccessGrantController {
  constructor(private readonly access: SupportAccessService) {}

  @Post()
  @ApiOperation({ summary: "Выдать временный доступ к продукции" })
  @ApiCreatedResponse()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSupportAccessGrantDto) {
    return this.access.createGrant(user.id, input);
  }

  @Get()
  @ApiOperation({ summary: "Получить выданные временные доступы" })
  @ApiOkResponse()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.access.listMine(user.id);
  }

  @Post(":grantId/revoke")
  @ApiOperation({ summary: "Отозвать временный доступ" })
  @ApiParam({ name: "grantId", format: "uuid" })
  @ApiOkResponse()
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("grantId", new ParseUUIDPipe()) grantId: string,
  ) {
    return this.access.revokeGrant(user.id, grantId);
  }
}

@ApiTags("internal-service-access")
@Controller("internal/service-access")
@UseGuards(InternalSessionGuard, ServiceAccessPermissionGuard)
export class InternalServiceAccessController {
  constructor(private readonly access: SupportAccessService) {}

  @Get("grants")
  @ApiOperation({ summary: "Получить действующие grants для служебной работы" })
  @ApiOkResponse()
  list(@CurrentInternalIdentity() identity: { user: { id: string; sessionId: string } }) {
    return this.access.listAvailableGrants(identity.user.id, identity.user.sessionId);
  }

  @Post("grants/:grantId/sessions")
  @ApiOperation({ summary: "Начать ограниченную служебную сессию" })
  @ApiParam({ name: "grantId", format: "uuid" })
  @ApiCreatedResponse()
  start(
    @CurrentInternalIdentity() identity: { user: { id: string; sessionId: string } },
    @Param("grantId", new ParseUUIDPipe()) grantId: string,
  ) {
    return this.access.startSession(identity.user.id, identity.user.sessionId, grantId);
  }

  @Post("sessions/:sessionId/end")
  @ApiOperation({ summary: "Завершить служебную сессию" })
  @ApiParam({ name: "sessionId", format: "uuid" })
  @ApiOkResponse()
  end(
    @CurrentInternalIdentity() identity: { user: { id: string; sessionId: string } },
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.access.endSession(identity.user.id, identity.user.sessionId, sessionId);
  }
}
