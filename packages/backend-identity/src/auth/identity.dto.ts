import { ApiProperty } from "@nestjs/swagger";
import { WorkspaceSummaryDto } from "@bartech/backend-organizations";
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength, MinLength } from "class-validator";

export class RegistrationStartDto {
  @ApiProperty({ example: "bar.manager@example.ru" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ example: "Иван Иванов", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

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

export class VerifyEmailDto {
  @ApiProperty({ example: "123456", minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class LoginDto {
  @ApiProperty({ example: "bar.manager@example.ru" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  password!: string;
}

export class PasswordRecoveryRequestDto {
  @ApiProperty({ example: "bar.manager@example.ru" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class PasswordRecoveryCompleteDto extends PasswordRecoveryRequestDto {
  @ApiProperty({ example: "123456", minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 256 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  newPassword!: string;
}

export class AcceptedDto {
  @ApiProperty({ example: true })
  accepted!: true;
}

export class CsrfTokenResponseDto {
  @ApiProperty()
  token!: string;
}

export class PublicUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;
}

export class CompanySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class VenueSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class RegistrationCompleteResponseDto {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({ type: CompanySummaryDto })
  company!: CompanySummaryDto;

  @ApiProperty({ type: VenueSummaryDto })
  venue!: VenueSummaryDto;

  @ApiProperty()
  redirectTo!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}

export class CurrentIdentityResponseDto extends PublicUserDto {
  @ApiProperty({ type: [WorkspaceSummaryDto] })
  workplaces!: WorkspaceSummaryDto[];

  @ApiProperty({ type: [CompanySummaryDto] })
  companies!: CompanySummaryDto[];
}
