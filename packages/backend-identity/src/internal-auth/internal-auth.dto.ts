import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class InternalLoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  password!: string;
}

export class InternalChallengeCodeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  challenge!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class InternalSetupStartDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  setupToken!: string;
}

export class InternalSetupCompleteDto extends InternalChallengeCodeDto {
  @ApiProperty({ minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class InternalRecoveryStartDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  password!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  recoveryCode!: string;
}

export class InternalChallengeResponseDto {
  @ApiProperty()
  challenge!: string;

  @ApiProperty({ required: false, type: String, format: "date-time" })
  expiresAt?: Date;
}

export class InternalEnrollmentResponseDto extends InternalChallengeResponseDto {
  @ApiProperty()
  secret!: string;

  @ApiProperty()
  otpAuthUrl!: string;

  @ApiProperty({ description: "QR-код TOTP в формате data URL" })
  qrCodeDataUrl!: string;
}

export class InternalRecoveryCodesResponseDto {
  @ApiProperty({ type: [String], minItems: 10, maxItems: 10 })
  recoveryCodes!: string[];
}

export class InternalSessionUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class InternalSessionResponseDto {
  @ApiProperty()
  user!: InternalSessionUserDto;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: Date;
}

export class InternalAcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted!: true;
}

export class InternalAuthenticatedResponseDto {
  @ApiProperty({ example: true })
  authenticated!: true;
}
