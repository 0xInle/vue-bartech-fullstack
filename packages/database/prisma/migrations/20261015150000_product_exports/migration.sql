CREATE TYPE "ProductExportType" AS ENUM ('SINGLE_PDF', 'BATCH_PDF_ZIP', 'VENUE_BACKUP_ZIP');
CREATE TYPE "ProductExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "product_export_requests" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "type" "ProductExportType" NOT NULL,
  "parameters" JSONB NOT NULL,
  "status" "ProductExportStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMPTZ(6),
  "leaseUntil" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "objectKey" TEXT,
  "fileName" TEXT,
  "contentType" TEXT,
  "fileSizeBytes" BIGINT,
  "errorCode" TEXT,
  CONSTRAINT "product_export_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_export_requests_attempt_count_check" CHECK ("attemptCount" >= 0 AND "attemptCount" <= 10),
  CONSTRAINT "product_export_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_export_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_export_requests_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "product_export_outbox" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_export_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_export_outbox_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "product_export_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "product_export_outbox_request_key" ON "product_export_outbox"("requestId");
CREATE INDEX "product_export_requests_user_created_idx" ON "product_export_requests"("userId", "createdAt");
CREATE INDEX "product_export_requests_status_created_idx" ON "product_export_requests"("status", "createdAt");
CREATE INDEX "product_export_requests_expiry_idx" ON "product_export_requests"("expiresAt");
CREATE INDEX "product_export_outbox_pending_idx" ON "product_export_outbox"("deliveredAt", "nextAttemptAt");
