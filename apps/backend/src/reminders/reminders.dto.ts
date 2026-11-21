import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString, MaxLength } from "class-validator";

export class CreateReminderDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  text!: string;
}

export class SetReminderCompletedDto {
  @ApiProperty()
  @IsBoolean()
  completed!: boolean;
}

export class VenueReminderDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ maxLength: 500 })
  text!: string;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  completedAt!: Date | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt!: Date;
}
