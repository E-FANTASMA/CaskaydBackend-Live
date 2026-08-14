require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? '',
  }),
});

const CONSOLIDATIONS = [
  {
    from: 'creator-marketing',
    to: 'business',
    note: 'Creator marketing fits under Business.',
  },
  {
    from: 'fashion-beauty',
    to: 'fashion',
    note: 'Fashion & beauty is consolidated under Fashion.',
  },
  {
    from: 'fashion-lifestyle',
    to: 'fashion',
    note: 'Fashion-led mixed niche consolidated under Fashion.',
  },
  {
    from: 'financial-growth',
    to: 'finance',
    note: 'Financial growth fits under Finance.',
  },
  {
    from: 'hair',
    to: 'beauty',
    note: 'Hair content belongs under Beauty.',
  },
  {
    from: 'hair-lifestyle',
    to: 'beauty',
    note: 'Hair & lifestyle is consolidated under Beauty.',
  },
  {
    from: 'hosting',
    to: 'hospitality',
    note: 'Hosting overlaps with Hospitality.',
  },
  {
    from: 'lifestyle-beauty',
    to: 'lifestyle',
    note: 'Lifestyle & beauty is consolidated under Lifestyle.',
  },
  {
    from: 'lifestyle-medicine',
    to: 'fitness-and-health',
    note: 'Lifestyle & medicine fits best under Fitness & Health.',
  },
  {
    from: 'marketing-coach',
    to: 'business',
    note: 'Marketing coaching belongs under Business.',
  },
  {
    from: 'nursing',
    to: 'fitness-and-health',
    note: 'Nursing overlaps with Fitness & Health.',
  },
  {
    from: 'pharmacuticals',
    to: 'fitness-and-health',
    note: 'Pharmaceutical content overlaps with Fitness & Health.',
  },
  {
    from: 'politics',
    to: 'news-and-politics',
    note: 'Politics is consolidated into News & Politics.',
  },
  {
    from: 'travel-lifestyle',
    to: 'travel',
    note: 'Travel & lifestyle is consolidated under Travel.',
  },
];

const DELETE_UNUSED = [
  'general',
  'she-is-the-niche',
  'unspecified',
];

async function getCategoryBySlug(slug) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      children: {
        select: { id: true, slug: true },
      },
    },
  });
}

async function migrateCategory(fromSlug, toSlug) {
  const [source, target] = await Promise.all([
    getCategoryBySlug(fromSlug),
    getCategoryBySlug(toSlug),
  ]);

  if (!source) {
    return { fromSlug, toSlug, status: 'skipped', reason: 'source-missing' };
  }

  if (!target) {
    throw new Error(`Missing target category "${toSlug}"`);
  }

  if (source.id === target.id) {
    return { fromSlug, toSlug, status: 'skipped', reason: 'same-category' };
  }

  return prisma.$transaction(async (tx) => {
    const summary = {
      fromSlug,
      toSlug,
      primaryCreatorsMoved: 0,
      secondaryLinksMoved: 0,
      campaignIntentLinksMoved: 0,
      childrenReparented: 0,
      deleted: false,
    };

    const movedPrimary = await tx.creator.updateMany({
      where: { primaryCategoryId: source.id },
      data: { primaryCategoryId: target.id },
    });
    summary.primaryCreatorsMoved = movedPrimary.count;

    const sourceSecondary = await tx.creatorSecondaryCategory.findMany({
      where: { categoryId: source.id },
      select: { creatorId: true },
    });

    for (const { creatorId } of sourceSecondary) {
      await tx.creatorSecondaryCategory.upsert({
        where: {
          creatorId_categoryId: {
            creatorId,
            categoryId: target.id,
          },
        },
        update: {},
        create: {
          creatorId,
          categoryId: target.id,
        },
      });
    }

    if (sourceSecondary.length) {
      const deletedSecondary = await tx.creatorSecondaryCategory.deleteMany({
        where: { categoryId: source.id },
      });
      summary.secondaryLinksMoved = deletedSecondary.count;
    }

    const sourceIntentLinks = await tx.campaignIntentCategory.findMany({
      where: { categoryId: source.id },
      select: { campaignIntentId: true },
    });

    for (const { campaignIntentId } of sourceIntentLinks) {
      await tx.campaignIntentCategory.upsert({
        where: {
          campaignIntentId_categoryId: {
            campaignIntentId,
            categoryId: target.id,
          },
        },
        update: {},
        create: {
          campaignIntentId,
          categoryId: target.id,
        },
      });
    }

    if (sourceIntentLinks.length) {
      const deletedIntentLinks = await tx.campaignIntentCategory.deleteMany({
        where: { categoryId: source.id },
      });
      summary.campaignIntentLinksMoved = deletedIntentLinks.count;
    }

    if (source.children.length) {
      const movedChildren = await tx.category.updateMany({
        where: { parentId: source.id },
        data: { parentId: target.id, level: target.level + 1 },
      });
      summary.childrenReparented = movedChildren.count;
    }

    await tx.category.delete({
      where: { id: source.id },
    });
    summary.deleted = true;

    return summary;
  });
}

async function deleteUnusedCategory(slug) {
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return { slug, status: 'skipped', reason: 'missing' };
  }

  const [primaryCount, secondaryCount, intentCount] = await Promise.all([
    prisma.creator.count({ where: { primaryCategoryId: category.id } }),
    prisma.creatorSecondaryCategory.count({ where: { categoryId: category.id } }),
    prisma.campaignIntentCategory.count({ where: { categoryId: category.id } }),
  ]);

  if (
    primaryCount > 0 ||
    secondaryCount > 0 ||
    intentCount > 0 ||
    category.children.length > 0
  ) {
    return {
      slug,
      status: 'skipped',
      reason: 'still-in-use',
      primaryCount,
      secondaryCount,
      intentCount,
      childCount: category.children.length,
    };
  }

  await prisma.category.delete({
    where: { id: category.id },
  });

  return { slug, status: 'deleted' };
}

async function main() {
  const migrationResults = [];
  for (const item of CONSOLIDATIONS) {
    migrationResults.push(await migrateCategory(item.from, item.to));
  }

  const deleteResults = [];
  for (const slug of DELETE_UNUSED) {
    deleteResults.push(await deleteUnusedCategory(slug));
  }

  console.log(
    JSON.stringify(
      {
        consolidations: migrationResults,
        deletedUnused: deleteResults,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
