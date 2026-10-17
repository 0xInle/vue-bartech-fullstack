import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

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

export class CreateVenueManagerInvitationDto {
  @ApiProperty({ example: "manager@example.ru" })
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

  @ApiPropertyOptional({ example: "Бар на Петровке", maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  venueName?: string;
}

export class CompleteExistingInvitationDto {
  @ApiPropertyOptional({ example: "Бар на Петровке", maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  venueName?: string;
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

  @ApiProperty({ enum: VENUE_INVITE_ROLES, isArray: true })
  availableRoles!: (typeof VENUE_INVITE_ROLES)[number][];

  @ApiProperty({ type: String, isArray: true })
  availableDelegatedPermissions!: string[];

  @ApiProperty()
  canManageDelegatedPermissions!: boolean;

  @ApiProperty()
  isCurrentUser!: boolean;
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
  @ApiProperty({
    enum: ["JOIN_EXISTING_VENUE", "JOIN_COMPANY_AS_CHEF", "CREATE_VENUE_AS_BAR_MANAGER"],
  })
  purpose!: "JOIN_EXISTING_VENUE" | "JOIN_COMPANY_AS_CHEF" | "CREATE_VENUE_AS_BAR_MANAGER";

  @ApiProperty()
  companyName!: string;

  @ApiProperty({ type: String, nullable: true })
  venueName!: string | null;

  @ApiProperty({ type: String, enum: VENUE_INVITE_ROLES, nullable: true })
  role!: (typeof VENUE_INVITE_ROLES)[number] | null;

  @ApiProperty()
  roleLabel!: string;

  @ApiProperty({ type: String, nullable: true })
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

export class CompanyVenueInvitationDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ["CREATE_VENUE_AS_BAR_MANAGER"] })
  purpose!: "CREATE_VENUE_AS_BAR_MANAGER";

  @ApiProperty({ enum: ["BAR_MANAGER"] })
  role!: "BAR_MANAGER";

  @ApiProperty({ enum: ["ACTIVE", "IN_PROGRESS"] })
  status!: "ACTIVE" | "IN_PROGRESS";

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  expiresAt!: Date;

  @ApiProperty()
  canRevoke!: boolean;
}

export class CompanyVenueInvitationsResponseDto {
  @ApiProperty({ type: [CompanyVenueInvitationDto] })
  invitations!: CompanyVenueInvitationDto[];
}

export class InvitationAcceptanceStateDto {
  @ApiProperty({ type: PublicInvitationDto })
  invitation!: PublicInvitationDto;

  @ApiProperty()
  registrationStarted!: boolean;
}
