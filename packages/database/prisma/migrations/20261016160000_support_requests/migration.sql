CREATE TYPE "SupportRequestReason" AS ENUM ('DATA_MIGRATION', 'ERROR', 'OTHER');
CREATE TYPE "SupportRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "SupportAttachmentStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'REJECTED');

CREATE TABLE "support_requests" (
  "id" UUID NOT NULL,
  "authorUserId" UUID,
  "companyId" UUID,
  "venueId" UUID,
  "assignedToId" UUID,
  "reason" "SupportRequestReason" NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'NEW',
  "technicalContext" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_requests_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_requests_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "support_requests_author_created_idx" ON "support_requests"("authorUserId", "createdAt");
CREATE INDEX "support_requests_status_created_idx" ON "support_requests"("status", "createdAt");
CREATE INDEX "support_requests_assignee_status_updated_idx" ON "support_requests"("assignedToId", "status", "updatedAt");

CREATE TABLE "support_attachments" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "uploadedByUserId" UUID,
  "originalName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "status" "SupportAttachmentStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "scanErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scannedAt" TIMESTAMPTZ(6),
  CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_attachments_request_key" ON "support_attachments"("requestId");
CREATE UNIQUE INDEX "support_attachments_object_key" ON "support_attachments"("objectKey");
CREATE INDEX "support_attachments_scan_status_created_idx" ON "support_attachments"("status", "createdAt");

CREATE TABLE "support_attachment_outbox" (
  "id" UUID NOT NULL,
  "attachmentId" UUID NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_attachment_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_attachment_outbox_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "support_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_attachment_outbox_attachment_key" ON "support_attachment_outbox"("attachmentId");
CREATE INDEX "support_attachment_outbox_pending_idx" ON "support_attachment_outbox"("deliveredAt", "nextAttemptAt");
