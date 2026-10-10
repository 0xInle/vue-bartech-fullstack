import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn } from "class-validator";
import { delegatedPermissionCodes, venueRoles } from "@bartech/backend-organizations";

export class UpdateTeamMemberDto {
  @ApiProperty({ enum: venueRoles })
  @IsIn([...venueRoles])
  role!: (typeof venueRoles)[number];

  @ApiProperty({ enum: delegatedPermissionCodes, isArray: true })
  @IsArray()
  @ArrayMaxSize(delegatedPermissionCodes.length)
  @ArrayUnique()
  @IsIn([...delegatedPermissionCodes], { each: true })
  delegatedPermissions!: (typeof delegatedPermissionCodes)[number][];
}

export class TeamMemberUpdateResponseDto {
  @ApiProperty({ enum: [true] })
  accepted!: true;
}
