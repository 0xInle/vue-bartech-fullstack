-- CreateTable
CREATE TABLE "venue_checklists" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "authorUserId" UUID,
    "title" VARCHAR(100) NOT NULL,
    "steps" TEXT[] NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "venue_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_checklists_workspace_created_idx" ON "venue_checklists"("companyId", "venueId", "createdAt");

-- AddForeignKey
ALTER TABLE "venue_checklists" ADD CONSTRAINT "venue_checklists_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_checklists" ADD CONSTRAINT "venue_checklists_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
