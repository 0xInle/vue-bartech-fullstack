CREATE TYPE "CocktailWorkflowStatus" AS ENUM ('ACTIVE', 'IN_DEVELOPMENT');

ALTER TABLE "cocktail_details"
ADD COLUMN "workflowStatus" "CocktailWorkflowStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "cocktail_details"
ALTER COLUMN "workflowStatus" SET DEFAULT 'IN_DEVELOPMENT';
