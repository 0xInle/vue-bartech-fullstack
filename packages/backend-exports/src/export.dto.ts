import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID } from "class-validator";

export type ExportKind =
  | "SINGLE_PDF"
  | "BATCH_PDF_ZIP"
  | "VENUE_BACKUP_ZIP"
  | "COMPANY_CLOSURE_BACKUP_ZIP"
  | "COMPANY_CLOSURE_PDF_ZIP";
export type ClosureExportKind = "SINGLE_PDF" | "BATCH_PDF_ZIP" | "COMPANY_CLOSURE_PDF_ZIP";
export type ExportState = "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED";
export type ExportParameters = {
  productIds?: string[];
  includeArchived?: boolean;
  venueIds?: string[];
};

export class CreateProductExportDto {
  @ApiProperty({ type: String, format: "uuid", isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("all", { each: true })
  productIds!: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}

export class ProductExportResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["QUEUED", "PROCESSING", "READY", "FAILED", "EXPIRED"] })
  status!: ExportState;

  @ApiProperty({
    enum: [
      "SINGLE_PDF",
      "BATCH_PDF_ZIP",
      "VENUE_BACKUP_ZIP",
      "COMPANY_CLOSURE_BACKUP_ZIP",
      "COMPANY_CLOSURE_PDF_ZIP",
    ],
  })
  type!: ExportKind;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorCode!: string | null;
}

export class ProductExportDownloadResponseDto {
  @ApiProperty({ format: "uri" })
  url!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}
