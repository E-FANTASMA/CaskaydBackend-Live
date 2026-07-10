CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_level_idx" ON "Category"("level");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH legacy_categories AS (
    SELECT trim("primaryNiche") AS name
    FROM "Creator"
    WHERE trim(COALESCE("primaryNiche", '')) <> ''
    UNION
    SELECT trim(value) AS name
    FROM "Creator", unnest("secondaryNiches") AS value
    WHERE trim(COALESCE(value, '')) <> ''
),
normalized_categories AS (
    SELECT DISTINCT
        name,
        trim(BOTH '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) AS slug
    FROM legacy_categories
)
INSERT INTO "Category" ("id", "name", "slug", "level", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, name, slug, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM normalized_categories
WHERE slug <> ''
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "description", "level", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'General',
    'general',
    'Fallback category for legacy creators that do not map to a seeded taxonomy item.',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "Creator" ADD COLUMN "primaryCategoryId" TEXT;

UPDATE "Creator" AS c
SET "primaryCategoryId" = category."id"
FROM "Category" AS category
WHERE category."slug" = trim(BOTH '-' FROM regexp_replace(lower(c."primaryNiche"), '[^a-z0-9]+', '-', 'g'));

UPDATE "Creator"
SET "primaryCategoryId" = (
    SELECT "id" FROM "Category" WHERE "slug" = 'general'
)
WHERE "primaryCategoryId" IS NULL;

CREATE TABLE "CreatorSecondaryCategory" (
    "creatorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorSecondaryCategory_pkey" PRIMARY KEY ("creatorId","categoryId")
);

CREATE INDEX "CreatorSecondaryCategory_categoryId_idx" ON "CreatorSecondaryCategory"("categoryId");

ALTER TABLE "CreatorSecondaryCategory"
ADD CONSTRAINT "CreatorSecondaryCategory_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreatorSecondaryCategory"
ADD CONSTRAINT "CreatorSecondaryCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CreatorSecondaryCategory" ("creatorId", "categoryId", "createdAt")
SELECT DISTINCT c."id", category."id", CURRENT_TIMESTAMP
FROM "Creator" AS c
CROSS JOIN LATERAL unnest(c."secondaryNiches") AS value
JOIN "Category" AS category
  ON category."slug" = trim(BOTH '-' FROM regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g'))
WHERE trim(COALESCE(value, '')) <> ''
  AND category."id" <> c."primaryCategoryId"
ON CONFLICT ("creatorId", "categoryId") DO NOTHING;

ALTER TABLE "SearchTag" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Creator" ALTER COLUMN "primaryCategoryId" SET NOT NULL;

CREATE INDEX "Creator_primaryCategoryId_idx" ON "Creator"("primaryCategoryId");

ALTER TABLE "Creator"
ADD CONSTRAINT "Creator_primaryCategoryId_fkey"
FOREIGN KEY ("primaryCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CampaignIntent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignIntent_slug_key" ON "CampaignIntent"("slug");

CREATE TABLE "CampaignIntentCategory" (
    "campaignIntentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CampaignIntentCategory_pkey" PRIMARY KEY ("campaignIntentId","categoryId")
);

CREATE INDEX "CampaignIntentCategory_categoryId_idx" ON "CampaignIntentCategory"("categoryId");

ALTER TABLE "CampaignIntentCategory"
ADD CONSTRAINT "CampaignIntentCategory_campaignIntentId_fkey"
FOREIGN KEY ("campaignIntentId") REFERENCES "CampaignIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignIntentCategory"
ADD CONSTRAINT "CampaignIntentCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignIntentTag" (
    "campaignIntentId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "CampaignIntentTag_pkey" PRIMARY KEY ("campaignIntentId","tag")
);

CREATE INDEX "CampaignIntentTag_tag_idx" ON "CampaignIntentTag"("tag");

ALTER TABLE "CampaignIntentTag"
ADD CONSTRAINT "CampaignIntentTag_campaignIntentId_fkey"
FOREIGN KEY ("campaignIntentId") REFERENCES "CampaignIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Creator" DROP COLUMN "primaryNiche";
ALTER TABLE "Creator" DROP COLUMN "secondaryNiches";
