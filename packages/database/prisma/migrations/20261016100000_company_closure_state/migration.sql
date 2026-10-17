CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'PENDING_CLOSURE');

ALTER TABLE "companies"
  ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "closureDeadline" TIMESTAMPTZ(6);

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_closure_state_check"
  CHECK (
    ("status" = 'ACTIVE' AND "closureDeadline" IS NULL)
    OR ("status" = 'PENDING_CLOSURE' AND "closureDeadline" IS NOT NULL)
  );

CREATE INDEX "companies_status_closure_deadline_idx"
  ON "companies"("status", "closureDeadline");
