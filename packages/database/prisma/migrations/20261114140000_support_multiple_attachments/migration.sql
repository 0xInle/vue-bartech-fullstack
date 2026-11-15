DROP INDEX "support_attachments_request_key";

CREATE INDEX "support_attachments_request_idx" ON "support_attachments"("requestId");
