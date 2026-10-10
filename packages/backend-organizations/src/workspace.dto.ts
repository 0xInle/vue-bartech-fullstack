import { ApiProperty } from "@nestjs/swagger";

export class WorkspaceCompanyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class WorkspaceVenueDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class WorkspaceSummaryDto {
  @ApiProperty({ type: WorkspaceCompanyDto })
  company!: WorkspaceCompanyDto;

  @ApiProperty({ type: WorkspaceVenueDto })
  venue!: WorkspaceVenueDto;

  @ApiProperty({ enum: ["bartender", "senior_bartender", "bar_manager", "chef_bartender"] })
  role!: string;

  @ApiProperty()
  roleLabel!: string;

  @ApiProperty({ enum: ["company", "venue"] })
  scope!: string;

  @ApiProperty({
    type: [String],
    example: ["view_products", "view_archive", "manage_products"],
  })
  permissions!: string[];
}
