import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class SaveVenueAnnouncementDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  body!: string;
}

export class VenueAnnouncementDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ maxLength: 100 })
  title!: string;

  @ApiProperty({ maxLength: 1000 })
  body!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt!: Date;
}
