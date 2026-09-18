-- Compatibility for Supabase databases that have not yet run the latest Prisma taxonomy migration.
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX IF NOT EXISTS "Category_level_idx" ON "Category"("level");

ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "primaryCategoryId" TEXT;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "businessEmail" TEXT;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "profileImage" TEXT;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "pfpError" TEXT;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CreatorPlatform" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreatorPlatform" ADD COLUMN IF NOT EXISTS "profileUrl" TEXT;
ALTER TABLE "CreatorPlatform" ADD COLUMN IF NOT EXISTS "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SearchTag" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "CreatorSecondaryCategory" (
  "creatorId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorSecondaryCategory_pkey" PRIMARY KEY ("creatorId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "Creator_primaryCategoryId_idx" ON "Creator"("primaryCategoryId");
CREATE INDEX IF NOT EXISTS "CreatorSecondaryCategory_categoryId_idx" ON "CreatorSecondaryCategory"("categoryId");

WITH category_names AS (
  SELECT DISTINCT trim(primary_niche) AS name
  FROM _creator_import
  WHERE trim(COALESCE(primary_niche, '')) <> ''
  UNION
  SELECT DISTINCT trim(value) AS name
  FROM _creator_import i
  CROSS JOIN LATERAL jsonb_array_elements_text(i.secondary_niches) AS value
  WHERE trim(COALESCE(value, '')) <> ''
), category_rows AS (
  SELECT
    name,
    trim(both '-' from lower(regexp_replace(replace(name, '&', 'and'), '[^a-zA-Z0-9]+', '-', 'g'))) AS slug
  FROM category_names
)
INSERT INTO "Category" ("id", "name", "slug", "level", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, name, slug, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM category_rows
ON CONFLICT ("slug") DO NOTHING;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _creator_import i
    LEFT JOIN "Category" c
      ON lower(c."name") = lower(i.primary_niche)
      OR c."slug" = i.primary_slug
      OR c."slug" = trim(both '-' from lower(regexp_replace(replace(i.primary_niche, '&', 'and'), '[^a-zA-Z0-9]+', '-', 'g')))
    WHERE c."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Missing primary categories: %', (
      SELECT string_agg(DISTINCT i.primary_niche, ', ')
      FROM _creator_import i
      LEFT JOIN "Category" c
        ON lower(c."name") = lower(i.primary_niche)
        OR c."slug" = i.primary_slug
      OR c."slug" = trim(both '-' from lower(regexp_replace(replace(i.primary_niche, '&', 'and'), '[^a-zA-Z0-9]+', '-', 'g')))
      WHERE c."id" IS NULL
    );
  END IF;
END $$;

WITH resolved AS (
  SELECT
    i.*,
    c."id" AS primary_category_id
  FROM _creator_import i
  JOIN LATERAL (
    SELECT "id"
    FROM "Category"
    WHERE lower("name") = lower(i.primary_niche)
      OR "slug" = i.primary_slug
      OR "slug" = trim(both '-' from lower(regexp_replace(replace(i.primary_niche, '&', 'and'), '[^a-zA-Z0-9]+', '-', 'g')))
    ORDER BY CASE WHEN lower("name") = lower(i.primary_niche) THEN 0 ELSE 1 END
    LIMIT 1
  ) c ON true
)
INSERT INTO "Creator" (
  "id",
  "name",
  "gender",
  "country",
  "state",
  "primaryCategoryId",
  "businessEmail",
  "profileImage",
  "pfpError",
  "createdAt",
  "updatedAt"
)
SELECT
  id,
  name,
  gender,
  country,
  state,
  CASE WHEN primary_category_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN primary_category_id::uuid ELSE NULL END,
  business_email,
  NULL,
  NULL,
  COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM resolved
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "gender" = EXCLUDED."gender",
  "country" = EXCLUDED."country",
  "state" = EXCLUDED."state",
  "primaryCategoryId" = EXCLUDED."primaryCategoryId",
  "businessEmail" = EXCLUDED."businessEmail",
  "updatedAt" = EXCLUDED."updatedAt";
