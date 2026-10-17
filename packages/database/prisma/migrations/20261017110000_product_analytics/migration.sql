CREATE TYPE "ProductAnalyticsEventType" AS ENUM (
  'SEARCH_USED',
  'SEARCH_EMPTY',
  'PRODUCT_OPENED',
  'PRODUCT_CREATE_STARTED',
  'PRODUCT_CREATE_COMPLETED',
  'PRODUCT_ARCHIVED',
  'PRODUCT_RESTORED',
  'TECHNICAL_ERROR'
);

CREATE TYPE "AnalyticsDeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');
CREATE TYPE "AnalyticsProductType" AS ENUM ('INGREDIENT', 'PREPARATION', 'GARNISH', 'COCKTAIL');
CREATE TYPE "AnalyticsErrorCategory" AS ENUM ('NETWORK', 'API', 'VALIDATION', 'UNKNOWN');
CREATE TYPE "AnalyticsEventResult" AS ENUM ('FAILURE');

CREATE TABLE "product_analytics_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "eventType" "ProductAnalyticsEventType" NOT NULL,
  "deviceType" "AnalyticsDeviceType" NOT NULL,
  "productType" "AnalyticsProductType",
  "errorCategory" "AnalyticsErrorCategory",
  "result" "AnalyticsEventResult",
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_analytics_events_event_id_key"
  ON "product_analytics_events"("eventId");
CREATE INDEX "product_analytics_events_created_type_idx"
  ON "product_analytics_events"("createdAt", "eventType");
CREATE INDEX "product_analytics_events_created_error_idx"
  ON "product_analytics_events"("createdAt", "errorCategory");
