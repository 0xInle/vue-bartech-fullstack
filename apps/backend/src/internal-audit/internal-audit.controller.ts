import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { InternalSessionGuard } from "@bartech/backend-identity";
import { InternalAuditPermissionGuard } from "./internal-audit-permission.guard.js";
import {
  InternalAuditEventDto,
  InternalAuditPageDto,
  InternalAuditQueryDto,
} from "./internal-audit.dto.js";
import { InternalAuditService } from "./internal-audit.service.js";

@ApiTags("internal-audit")
@Controller("internal/audit-events")
@UseGuards(InternalSessionGuard, InternalAuditPermissionGuard)
export class InternalAuditController {
  constructor(private readonly audit: InternalAuditService) {}

  @Get()
  @ApiOperation({ summary: "Получить страницу внутреннего журнала действий" })
  @ApiBadRequestResponse({ description: "Некорректный размер страницы или курсор" })
  @ApiForbiddenResponse({ description: "Нет разрешения internal_audit" })
  @ApiOkResponse({ type: InternalAuditPageDto })
  list(@Query() query: InternalAuditQueryDto): Promise<{
    items: InternalAuditEventDto[];
    nextCursor: string | null;
  }> {
    return this.audit.list(query);
  }
}
