import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import { CompanySummaryDto, VenueSummaryDto } from "@bartech/backend-identity";
import { OrganizationsService, WorkspaceSummaryDto } from "@bartech/backend-organizations";
import {
  CurrentWorkspace,
  RequirePermissions,
  WorkspacePermissionGuard,
} from "./workspace-permission.guard.js";
import type { WorkspaceSummary } from "@bartech/backend-organizations";

class CreateCompanyDto {
  @ApiProperty({ example: "ООО Рога и Копыта", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ example: "Гадкий Шпрот", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  venueName!: string;
}

class CreateCompanyResponseDto {
  @ApiProperty({ type: CompanySummaryDto })
  company!: CompanySummaryDto;

  @ApiProperty({ type: VenueSummaryDto })
  venue!: VenueSummaryDto;

  @ApiProperty()
  redirectTo!: string;
}

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get("companies/:companyId/venues/:venueId")
  @UseGuards(SessionGuard, WorkspacePermissionGuard)
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить доступный рабочий контекст заведения" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiOkResponse({
    description: "Контекст и эффективные разрешения пользователя",
    type: WorkspaceSummaryDto,
  })
  @ApiNotFoundResponse({ description: "Рабочее пространство не найдено или недоступно" })
  getWorkspace(@CurrentWorkspace() workspace: WorkspaceSummary) {
    return workspace;
  }

  @Post()
  @ApiOperation({ summary: "Создать компанию и первое заведение для существующего пользователя" })
  @ApiOkResponse({
    description: "Компания, заведение и роль бар-менеджера созданы атомарно",
    type: CreateCompanyResponseDto,
  })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCompanyDto) {
    const result = await this.organizations.createForUser(user.id, {
      companyName: body.companyName,
      venueName: body.venueName,
    });
    return {
      company: { id: result.company.id, name: result.company.name },
      venue: { id: result.venue.id, name: result.venue.name },
      redirectTo: `/app/companies/${result.company.id}/venues/${result.venue.id}`,
    };
  }
}
