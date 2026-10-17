ALTER TYPE "ProductExportType" ADD VALUE 'COMPANY_CLOSURE_BACKUP_ZIP';

CREATE TYPE "ProductExportClosureType" AS ENUM ('VENUE', 'COMPANY');
CREATE TYPE "ProductExportClosureStatus" AS ENUM ('PREPARING', 'PENDING_CLOSURE', 'CLOSED', 'CANCELLED');

CREATE TABLE "product_export_closure_operations" (
  "id" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "type" "ProductExportClosureType" NOT NULL,
  "status" "ProductExportClosureStatus" NOT NULL DEFAULT 'PREPARING',
  "companyId" UUID,
  "venueId" UUID,
  "originalCompanyId" UUID NOT NULL,
  "originalVenueId" UUID,
  "originalCompanyName" TEXT NOT NULL,
  "originalVenueName" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  CONSTRAINT "product_export_closure_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_export_closure_operations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_export_closure_operations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_export_closure_operations_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "product_export_closures_company_status_idx"
  ON "product_export_closure_operations"("originalCompanyId", "type", "status");
CREATE INDEX "product_export_closures_author_created_idx"
  ON "product_export_closure_operations"("createdByUserId", "createdAt");

ALTER TABLE "product_export_requests"
  ALTER COLUMN "companyId" DROP NOT NULL,
  ALTER COLUMN "venueId" DROP NOT NULL;

ALTER TABLE "product_export_requests"
  DROP CONSTRAINT "product_export_requests_companyId_fkey",
  DROP CONSTRAINT "product_export_requests_venueId_companyId_fkey";

ALTER TABLE "product_export_requests"
  ADD CONSTRAINT "product_export_requests_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "product_export_requests_venueId_companyId_fkey"
    FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN "closureOperationId" UUID,
  ADD CONSTRAINT "product_export_requests_closureOperationId_fkey"
    FOREIGN KEY ("closureOperationId") REFERENCES "product_export_closure_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "product_export_requests_closure_operation_key"
  ON "product_export_requests"("closureOperationId");
