import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsNotEmpty, IsString, Length, MaxLength } from "class-validator";

export const VENUE_INVITE_ROLES = ["BARTENDER", "SENIOR_BARTENDER", "BAR_MANAGER"] as const;

export class CreateVenueInvitationDto {
  @ApiProperty({ example: "bartender@example.ru" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: VENUE_INVITE_ROLES })
  @IsIn(VENUE_INVITE_ROLES)
  role!: (typeof VENUE_INVITE_ROLES)[number];
}

export class CreateChefInvitationDto {
  @ApiProperty({ example: "chef@example.ru" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class InviteTokenDto {
  @ApiProperty({ minLength: 20, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}

export class StartInvitationRegistrationDto {
  @ApiProperty({ example: "Иван Иванов", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ minLength: 8, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  password!: string;
}

export class CompleteInvitationRegistrationDto {
  @ApiProperty({ example: "123456", minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RevokeInvitationDto {
  @ApiProperty({ format: "uuid" })
  @IsString()
  @IsNotEmpty()
  invitationId!: string;
}

export class VenueTeamMemberDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: VENUE_INVITE_ROLES })
  role!: (typeof VENUE_INVITE_ROLES)[number];

  @ApiProperty({ type: [String] })
  delegatedPermissions!: string[];
}

export class VenueInvitationDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: VENUE_INVITE_ROLES })
  role!: (typeof VENUE_INVITE_ROLES)[number];

  @ApiProperty({ enum: ["ACTIVE", "IN_PROGRESS"] })
  status!: "ACTIVE" | "IN_PROGRESS";

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;

  @ApiProperty()
  canRevoke!: boolean;
}

export class VenueTeamResponseDto {
  @ApiProperty({ type: [VenueTeamMemberDto] })
  members!: VenueTeamMemberDto[];

  @ApiProperty({ type: [VenueInvitationDto] })
  invitations!: VenueInvitationDto[];
}

export class PublicInvitationDto {
  @ApiProperty({ enum: ["JOIN_EXISTING_VENUE", "JOIN_COMPANY_AS_CHEF"] })
  purpose!: "JOIN_EXISTING_VENUE" | "JOIN_COMPANY_AS_CHEF";

  @ApiProperty()
  companyName!: string;

  @ApiProperty({ nullable: true })
  venueName!: string | null;

  @ApiProperty({ enum: VENUE_INVITE_ROLES, nullable: true })
  role!: (typeof VENUE_INVITE_ROLES)[number] | null;

  @ApiProperty()
  roleLabel!: string;

  @ApiProperty({ nullable: true })
  accessDescription!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}

export class CompanyChefMemberDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;
}

export class CompanyChefInvitationDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ["ACTIVE", "IN_PROGRESS"] })
  status!: "ACTIVE" | "IN_PROGRESS";

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}

export class CompanyChefTeamResponseDto {
  @ApiProperty({ type: [CompanyChefMemberDto] })
  members!: CompanyChefMemberDto[];

  @ApiProperty({ type: [CompanyChefInvitationDto] })
  invitations!: CompanyChefInvitationDto[];
}

export class InvitationAcceptanceStateDto {
  @ApiProperty({ type: PublicInvitationDto })
  invitation!: PublicInvitationDto;

  @ApiProperty()
  registrationStarted!: boolean;
}
