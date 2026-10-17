CREATE TABLE "product_export_cleanups" (
  "requestId" UUID NOT NULL,
  "attemptCount" INTEGER NOT NULL,
  "isScopePurge" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastAttemptAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_export_cleanups_pkey" PRIMARY KEY ("requestId"),
  CONSTRAINT "product_export_cleanups_attempt_count_check" CHECK ("attemptCount" >= 0 AND "attemptCount" <= 10)
);

CREATE INDEX "product_export_cleanups_pending_idx"
  ON "product_export_cleanups"("isScopePurge", "lastAttemptAt");
