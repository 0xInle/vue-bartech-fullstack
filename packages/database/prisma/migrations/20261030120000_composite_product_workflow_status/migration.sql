ALTER TYPE "CocktailWorkflowStatus" RENAME TO "WorkflowStatus";

ALTER TABLE "products"
ADD COLUMN "workflowStatus" "WorkflowStatus";

UPDATE "products" AS product
SET "workflowStatus" = COALESCE(cocktail."workflowStatus", 'ACTIVE'::"WorkflowStatus")
FROM "cocktail_details" AS cocktail
WHERE cocktail."productId" = product."id";

UPDATE "products"
SET "workflowStatus" = 'ACTIVE'::"WorkflowStatus"
WHERE "type" IN ('PREPARATION', 'GARNISH');

ALTER TABLE "cocktail_details"
DROP COLUMN "workflowStatus";
