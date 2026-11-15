ALTER TYPE "SupportRequestStatus" ADD VALUE 'WAITING_ON_CUSTOMER';

CREATE TYPE "SupportMessageAuthorType" AS ENUM ('CUSTOMER', 'INTERNAL');
CREATE TYPE "SupportMessageKind" AS ENUM ('TEXT', 'ACCESS_REQUEST');

ALTER TABLE "support_requests"
  ADD COLUMN "customerReadAt" TIMESTAMPTZ(6),
  ADD COLUMN "supportReadAt" TIMESTAMPTZ(6);

CREATE TABLE "support_messages" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "authorType" "SupportMessageAuthorType" NOT NULL,
  "authorUserId" UUID,
  "authorInternalUserId" UUID,
  "kind" "SupportMessageKind" NOT NULL DEFAULT 'TEXT',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_messages_authorInternalUserId_fkey" FOREIGN KEY ("authorInternalUserId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_messages_author_side_check" CHECK (
    ("authorType" = 'CUSTOMER' AND "authorInternalUserId" IS NULL) OR
    ("authorType" = 'INTERNAL' AND "authorUserId" IS NULL)
  )
);

CREATE INDEX "support_messages_request_created_idx" ON "support_messages"("requestId", "createdAt");
CREATE INDEX "support_messages_request_kind_idx" ON "support_messages"("requestId", "kind");

INSERT INTO "support_messages" ("id", "requestId", "authorType", "authorUserId", "kind", "body", "createdAt")
SELECT gen_random_uuid(), "id", 'CUSTOMER', "authorUserId", 'TEXT', "message", "createdAt"
FROM "support_requests";

ALTER TABLE "support_attachments"
  ADD COLUMN "messageId" UUID,
  ADD CONSTRAINT "support_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "support_attachments" AS attachment
SET "messageId" = message."id"
FROM "support_messages" AS message
WHERE message."requestId" = attachment."requestId"
  AND message."kind" = 'TEXT';

ALTER TABLE "support_access_grants"
  ADD COLUMN "accessRequestMessageId" UUID,
  ADD CONSTRAINT "support_access_grants_accessRequestMessageId_fkey" FOREIGN KEY ("accessRequestMessageId") REFERENCES "support_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "support_access_grants_access_request_message_key"
  ON "support_access_grants"("accessRequestMessageId");
