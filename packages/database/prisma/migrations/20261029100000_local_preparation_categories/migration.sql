ALTER TABLE "preparation_categories"
  ADD COLUMN "venueId" UUID,
  ADD COLUMN "createdByUserId" UUID;

ALTER TABLE "preparation_categories"
  ADD CONSTRAINT "preparation_categories_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "preparation_categories_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "preparation_categories_sort_idx";
CREATE INDEX "preparation_categories_venue_sort_idx"
  ON "preparation_categories"("venueId", "sortOrder");
