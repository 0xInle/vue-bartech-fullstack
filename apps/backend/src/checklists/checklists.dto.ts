import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from "class-validator";

export class SaveVenueChecklistDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 50, maxLength: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  steps!: string[];
}

export class VenueChecklistDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ maxLength: 100 })
  title!: string;

  @ApiProperty({ type: [String], maxItems: 50 })
  steps!: string[];

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt!: Date;
}
