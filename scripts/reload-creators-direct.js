const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function parseArgs(argv) {
  const args = {
    file: '',
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--apply') {
      args.apply = true;
      continue;
    }

    if (value.startsWith('--file=')) {
      args.file = value.slice('--file='.length).trim();
      continue;
    }

    if (value === '--file') {
      args.file = (argv[index + 1] ?? '').trim();
      index += 1;
    }
  }

  if (!args.file) {
    throw new Error('Missing required --file argument.');
  }

  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [header = [], ...body] = rows;
  return body
    .filter((columns) => columns.some((column) => column.trim()))
    .map((columns) =>
      header.reduce((record, column, index) => {
        record[column.trim()] = (columns[index] ?? '').trim();
        return record;
      }, {}),
    );
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function safeJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((item) => item.replace(/^"+|"+$/g, '').trim())
      .filter(Boolean);
  }
}

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function normalizeHandle(value) {
  const handle = String(value ?? '').trim().replace(/^@/, '');
  return handle || undefined;
}

function normalizeFollowers(value) {
  const digits = String(value ?? '')
    .replace(/,/g, '')
    .trim();
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenize(text) {
  return slugify(text)
    .split('-')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreCategories(categories, text) {
  const lowered = text.toLowerCase();
  const tokens = new Set(tokenize(text));

  return categories.map((category) => {
    const categoryTokens = tokenize(
      [category.name, category.slug, category.description].filter(Boolean).join(' '),
    );
    const phrases = new Set([
      String(category.name ?? '').toLowerCase(),
      String(category.slug ?? '').toLowerCase().replace(/-/g, ' '),
    ]);

    let score = 0;

    for (const phrase of phrases) {
      if (phrase && lowered.includes(phrase)) {
        score += 10;
      }
    }

    for (const token of categoryTokens) {
      if (tokens.has(token)) {
        score += 3;
      }
    }

    return { category, score };
  });
}

function resolvePrimaryCategory(categories, text) {
  const fallbackAliases = new Map([
    ['food-drinks', 'food'],
    ['food-and-drinks', 'food'],
    ['art-creativity', 'entertainment'],
    ['photography-video', 'entertainment'],
    ['religion-faith', 'education'],
    ['comedy', 'entertainment'],
    ['music', 'entertainment'],
  ]);

  const roots = categories.filter((category) => !category.parentId);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const rootForCategory = new Map();

  for (const category of categories) {
    let current = category;
    while (current.parentId && byId.has(current.parentId)) {
      current = byId.get(current.parentId);
    }
    rootForCategory.set(category.id, current);
  }

  const scored = scoreCategories(categories, text);
  const rootScores = new Map();
  for (const item of scored) {
    const root = rootForCategory.get(item.category.id);
    if (!root) {
      continue;
    }
    rootScores.set(root.id, (rootScores.get(root.id) ?? 0) + item.score);
  }

  const ranked = roots
    .map((root) => ({ root, score: rootScores.get(root.id) ?? 0 }))
    .sort((left, right) => right.score - left.score || left.root.name.localeCompare(right.root.name));

  if (ranked[0] && ranked[0].score > 0) {
    return ranked[0].root;
  }

  const alias = fallbackAliases.get(slugify(text));
  if (alias) {
    return roots.find((root) => root.slug === alias) ?? roots[0];
  }

  return roots.find((root) => root.slug === 'entertainment') ?? roots[0];
}

function mergeRows(rows, categories) {
  const creators = new Map();
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const name = String(row.name ?? '').trim();
    const key = email ?? name.toLowerCase();
    if (!key) {
      continue;
    }

    const secondaryNiches = safeJsonArray(row.secondaryNiches);
    const primaryNiche = String(row.primaryNiche ?? '').trim();
    const keywordPool = [
      primaryNiche,
      ...secondaryNiches,
      row.gender,
      row.state,
      row.country,
      name,
    ].filter(Boolean);

    const record =
      creators.get(key) ??
      {
        name: name || email || key,
        gender: String(row.gender ?? '').trim() || undefined,
        country: String(row.country ?? '').trim() || undefined,
        state: String(row.state ?? '').trim() || undefined,
        businessEmail: email,
        keywordPool: new Set(),
        secondaryCategoryIds: new Set(),
        platforms: [],
      };

    for (const keyword of keywordPool) {
      record.keywordPool.add(String(keyword).trim());
    }

    const categoryText = [primaryNiche, ...secondaryNiches].filter(Boolean).join(' ');
    const primaryCategory = resolvePrimaryCategory(categories, categoryText || name);
    record.primaryCategoryId = record.primaryCategoryId ?? primaryCategory.id;

    for (const niche of secondaryNiches) {
      const category = categoriesBySlug.get(slugify(niche));
      if (category && category.parentId && category.parentId === record.primaryCategoryId) {
        record.secondaryCategoryIds.add(category.id);
      }
    }

    const instagramHandle = normalizeHandle(row.instagramHandle);
    if (instagramHandle) {
      record.platforms.push({
        platform: 'INSTAGRAM',
        handle: instagramHandle,
        followers: normalizeFollowers(row.instagramFollowers),
        verified: false,
        profileUrl: `https://instagram.com/${instagramHandle}`,
      });
      record.keywordPool.add(instagramHandle);
    }

    const tiktokHandle = normalizeHandle(row.tiktokHandle);
    if (tiktokHandle) {
      record.platforms.push({
        platform: 'TIKTOK',
        handle: tiktokHandle,
        followers: normalizeFollowers(row.tiktokFollowers),
        verified: false,
        profileUrl: `https://www.tiktok.com/@${tiktokHandle}`,
      });
      record.keywordPool.add(tiktokHandle);
    }

    creators.set(key, record);
  }

  return [...creators.values()].map((record) => ({
    ...record,
    id: randomUUID(),
    searchTags: [...record.keywordPool]
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => value.length >= 2),
    secondaryCategoryIds: [...record.secondaryCategoryIds],
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(args.file);
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    }),
  });

  try {
    await prisma.$connect();

    const [beforeCount, categories] = await Promise.all([
      prisma.creator.count(),
      prisma.category.findMany({
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const creators = mergeRows(rows, categories);
    const summary = {
      csvRows: rows.length,
      creatorsPrepared: creators.length,
      creatorsBefore: beforeCount,
      categoriesAvailable: categories.length,
      deletedCreators: 0,
      importedCreators: 0,
      failedCreators: 0,
      creatorsAfter: beforeCount,
      apply: args.apply,
      errors: [],
    };

    if (!args.apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const deleted = await prisma.creator.deleteMany();
    summary.deletedCreators = deleted.count;

    const creatorRows = creators.map((creator) => ({
      id: creator.id,
      name: creator.name,
      gender: creator.gender,
      country: creator.country,
      state: creator.state,
      businessEmail: creator.businessEmail,
      primaryCategoryId: creator.primaryCategoryId,
    }));

    const platformRows = creators.flatMap((creator) =>
      creator.platforms.map((platform) => ({
        id: randomUUID(),
        creatorId: creator.id,
        platform: platform.platform,
        handle: platform.handle,
        followers: platform.followers,
        verified: platform.verified,
        profileUrl: platform.profileUrl,
      })),
    );

    const searchTagRows = creators.flatMap((creator) =>
      creator.searchTags.map((tag) => ({
        id: randomUUID(),
        creatorId: creator.id,
        tag,
      })),
    );

    const secondaryCategoryRows = creators.flatMap((creator) =>
      creator.secondaryCategoryIds.map((categoryId) => ({
        creatorId: creator.id,
        categoryId,
      })),
    );

    try {
      await prisma.$transaction([
        prisma.creator.createMany({ data: creatorRows }),
        prisma.creatorPlatform.createMany({ data: platformRows }),
        prisma.searchTag.createMany({ data: searchTagRows }),
        prisma.creatorSecondaryCategory.createMany({ data: secondaryCategoryRows }),
      ]);
      summary.importedCreators = creators.length;
    } catch (error) {
      summary.failedCreators = creators.length;
      summary.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    summary.creatorsAfter = await prisma.creator.count();
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
