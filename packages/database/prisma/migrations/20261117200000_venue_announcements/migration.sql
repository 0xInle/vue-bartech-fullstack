-- CreateTable
CREATE TABLE "venue_announcements" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "authorUserId" UUID,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "venue_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_announcements_workspace_created_idx" ON "venue_announcements"("companyId", "venueId", "createdAt");

-- AddForeignKey
ALTER TABLE "venue_announcements" ADD CONSTRAINT "venue_announcements_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_announcements" ADD CONSTRAINT "venue_announcements_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
