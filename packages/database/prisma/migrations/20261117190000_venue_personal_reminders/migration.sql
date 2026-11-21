-- CreateTable
CREATE TABLE "venue_personal_reminders" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "venue_personal_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_personal_reminders_owner_venue_idx" ON "venue_personal_reminders"("userId", "companyId", "venueId", "completedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "venue_personal_reminders" ADD CONSTRAINT "venue_personal_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_personal_reminders" ADD CONSTRAINT "venue_personal_reminders_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
