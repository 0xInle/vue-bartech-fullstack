UPDATE "reference_values"
SET "label" = 'Бокал Маргарита'
WHERE "venueId" IS NULL
  AND "type" = 'GLASS'::"ReferenceValueType"
  AND "code" = 'бокал-маргарита';
