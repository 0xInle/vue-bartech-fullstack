import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsIn } from "class-validator";
import { permissionCatalog, venueRoles, type PermissionCode } from "@bartech/backend-organizations";

const permissionCodes = Object.keys(permissionCatalog);

export class UpdateTeamMemberDto {
  @ApiProperty({ enum: venueRoles })
  @IsIn([...venueRoles])
  role!: (typeof venueRoles)[number];

  @ApiProperty({ enum: permissionCodes, isArray: true })
  @IsArray()
  @ArrayMaxSize(permissionCodes.length)
  @ArrayUnique()
  @IsIn(permissionCodes, { each: true })
  permissions!: PermissionCode[];
}

export class TeamMemberUpdateResponseDto {
  @ApiProperty({ enum: [true] })
  accepted!: true;
}

export class EndTeamMemberDto {
  @ApiProperty({ format: "date", example: "2026-10-19", description: "Первый нерабочий день" })
  @IsDateString({ strict: true })
  terminationDate!: string;
}
