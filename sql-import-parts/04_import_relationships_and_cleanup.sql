-- Run this fourth: imports secondary categories/search tags, then removes staging tables.
DELETE FROM "CreatorSecondaryCategory"
WHERE "creatorId" IN (SELECT id::text FROM _creator_import);

WITH secondary_names AS (
  SELECT
    i.id AS creator_id,
    value AS category_name,
    lower(regexp_replace(trim(value), '[^a-zA-Z0-9]+', '-', 'g')) AS raw_slug
  FROM _creator_import i
  CROSS JOIN LATERAL jsonb_array_elements_text(i.secondary_niches) AS value
), secondary_resolved AS (
  SELECT DISTINCT
    s.creator_id,
    c."id" AS category_id
  FROM secondary_names s
  JOIN "Category" c
    ON lower(c."name") = lower(s.category_name)
    OR c."slug" = trim(both '-' from s.raw_slug)
    OR c."slug" = trim(both '-' from lower(regexp_replace(replace(s.category_name, '&', 'and'), '[^a-zA-Z0-9]+', '-', 'g')))
  JOIN "Creator" creator ON creator."id" = s.creator_id
  WHERE c."id" <> creator."primaryCategoryId"::text
)
INSERT INTO "CreatorSecondaryCategory" ("creatorId", "categoryId", "createdAt")
SELECT creator_id::text, category_id, CURRENT_TIMESTAMP
FROM secondary_resolved
ON CONFLICT ("creatorId", "categoryId") DO NOTHING;

DELETE FROM "SearchTag"
WHERE "creatorId" IN (SELECT id::text FROM _creator_import);

WITH import_tags AS (
  SELECT id::text AS creator_id, primary_niche AS tag FROM _creator_import WHERE primary_niche IS NOT NULL
  UNION
  SELECT i.id::text, jsonb_array_elements_text(i.secondary_niches) FROM _creator_import i
  UNION
  SELECT id::text, country FROM _creator_import WHERE country IS NOT NULL
  UNION
  SELECT id::text, state FROM _creator_import WHERE state IS NOT NULL
  UNION
  SELECT creator_id::text, handle FROM _creator_platform_import
), clean_tags AS (
  SELECT DISTINCT creator_id, trim(tag) AS tag
  FROM import_tags
  WHERE trim(COALESCE(tag, '')) <> ''
)
INSERT INTO "SearchTag" ("id", "creatorId", "tag", "createdAt")
SELECT gen_random_uuid(), creator_id, tag, CURRENT_TIMESTAMP
FROM clean_tags;

DROP TABLE IF EXISTS _creator_platform_import;
DROP TABLE IF EXISTS _creator_import;
