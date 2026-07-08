const fs = require('fs');
const path = require('path');
const { PrismaClient, PlatformType } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    apply: false,
    mode: 'strict',
    file: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') {
      args.apply = true;
      continue;
    }

    if (value.startsWith('--mode=')) {
      args.mode = value.slice('--mode='.length).trim().toLowerCase();
      continue;
    }

    if (value === '--mode') {
      args.mode = (argv[index + 1] ?? '').trim().toLowerCase();
      index += 1;
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

  if (!['strict', 'lenient'].includes(args.mode)) {
    throw new Error(`Unsupported mode "${args.mode}". Use "strict" or "lenient".`);
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

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;
  return body
    .filter((columns) => columns.some((column) => column.trim() !== ''))
    .map((columns) => {
      const record = {};
      header.forEach((column, index) => {
        record[column] = (columns[index] ?? '').trim();
      });
      return record;
    });
}

function normalizeText(value) {
  const trimmed = (value ?? '').trim();
  return trimmed || undefined;
}

function normalizeCountry(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'nigeria' || lower === 'nigeria ') {
    return 'Nigeria';
  }
  if (lower === 'america' || lower === 'usa' || lower === 'united states') {
    return 'United States';
  }

  return normalized;
}

function splitList(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === '-' || normalized === '- ') {
    return [];
  }

  return [...new Set(
    normalized
      .split(/[|,;/]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function parseFollowers(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 0;
  }

  const compact = normalized.replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  const match = compact.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) {
    return 0;
  }

  const amount = Number.parseFloat(match[1]);
  const suffix = match[2];

  if (!suffix) {
    return Math.round(amount);
  }

  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1_000_000_000;
  return Math.round(amount * multiplier);
}

function cleanHandle(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/^@/, '');
}

function inferNameFromHandles(row) {
  const rawHandle =
    cleanHandle(row['Instagram Handle']) ??
    cleanHandle(row['TikTok Handle']) ??
    cleanHandle(row['YouTube Handle']) ??
    cleanHandle(row['X (Twitter) Handle']);

  if (!rawHandle) {
    return undefined;
  }

  const prettified = rawHandle
    .replace(/[._]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!prettified) {
    return rawHandle;
  }

  return prettified
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildPlatform(platform, handle, followers, profileBaseUrl) {
  const normalizedHandle = cleanHandle(handle);
  if (!normalizedHandle) {
    return undefined;
  }

  return {
    platform,
    handle: normalizedHandle,
    followers: parseFollowers(followers),
    verified: false,
    profileUrl: `${profileBaseUrl}${normalizedHandle}`,
  };
}

function buildSearchTags(payload) {
  const tags = new Set();
  const add = (value) => {
    const normalized = normalizeText(value);
    if (normalized) {
      tags.add(normalized);
    }
  };

  add(payload.primaryNiche);
  payload.secondaryNiches.forEach(add);
  add(payload.country);
  add(payload.state);
  payload.platforms.forEach((platform) => add(platform.handle));

  return [...tags];
}

function buildCreatorPayload(row, mode) {
  const explicitName = normalizeText(row.Name);
  const inferredName = inferNameFromHandles(row);
  const name = explicitName ?? (mode === 'lenient' ? inferredName : undefined);
  const primaryNiche =
    normalizeText(row['Primary Niche']) ?? (mode === 'lenient' ? 'Unspecified' : undefined);

  if (!name || !primaryNiche) {
    return {
      status: 'skipped',
      reason: !name && !primaryNiche ? 'missing_name_and_primary_niche' : !name ? 'missing_name' : 'missing_primary_niche',
    };
  }

  const platforms = [
    buildPlatform(
      PlatformType.INSTAGRAM,
      row['Instagram Handle'],
      row['Instagram Followers'],
      'https://instagram.com/',
    ),
    buildPlatform(
      PlatformType.TIKTOK,
      row['TikTok Handle'],
      row['TikTok Followers'],
      'https://www.tiktok.com/@',
    ),
    buildPlatform(
      PlatformType.YOUTUBE,
      row['YouTube Handle'],
      row['YouTube Followers'],
      'https://www.youtube.com/@',
    ),
    buildPlatform(
      PlatformType.X,
      row['X (Twitter) Handle'],
      row['X (Twitter) Followers'],
      'https://x.com/',
    ),
  ].filter(Boolean);

  const payload = {
    name,
    gender: normalizeText(row.Gender),
    country: normalizeCountry(row.Country),
    state: normalizeText(row.State),
    primaryNiche,
    secondaryNiches: splitList(row['Secondary Niches']),
    businessEmail: (() => {
      const email = normalizeText(row['Contact Information']);
      return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : undefined;
    })(),
    profileImage: undefined,
    platforms,
  };

  return {
    status: 'ready',
    inferredName: !explicitName && Boolean(inferredName),
    inferredPrimaryNiche: !normalizeText(row['Primary Niche']),
    payload: {
      ...payload,
      searchTags: buildSearchTags(payload),
    },
  };
}

function buildDuplicateWhere(payload) {
  const or = [];

  if (payload.businessEmail) {
    or.push({
      businessEmail: {
        equals: payload.businessEmail,
        mode: 'insensitive',
      },
    });
  }

  for (const platform of payload.platforms) {
    or.push({
      platforms: {
        some: {
          platform: platform.platform,
          handle: {
            equals: platform.handle,
            mode: 'insensitive',
          },
        },
      },
    });
  }

  return or.length ? { OR: or } : undefined;
}

function buildIdentityRecord(id, payload) {
  return {
    id,
    name: payload.name,
    businessEmail: payload.businessEmail ?? null,
    platforms: payload.platforms.map((platform) => ({
      platform: platform.platform,
      handle: platform.handle,
    })),
  };
}

function buildExistingIdentityIndex(creators) {
  const emailMap = new Map();
  const handleMap = new Map();

  for (const creator of creators) {
    if (creator.businessEmail) {
      emailMap.set(creator.businessEmail.toLowerCase(), creator);
    }

    for (const platform of creator.platforms) {
      handleMap.set(
        `${platform.platform}:${platform.handle.toLowerCase()}`,
        creator,
      );
    }
  }

  return { emailMap, handleMap };
}

function findDuplicateFromIndex(payload, existingIndex) {
  if (payload.businessEmail) {
    const emailMatch = existingIndex.emailMap.get(payload.businessEmail.toLowerCase());
    if (emailMatch) {
      return emailMatch;
    }
  }

  for (const platform of payload.platforms) {
    const platformMatch = existingIndex.handleMap.get(
      `${platform.platform}:${platform.handle.toLowerCase()}`,
    );
    if (platformMatch) {
      return platformMatch;
    }
  }

  return null;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  loadEnv(path.join(repoRoot, '.env'));

  const args = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(args.file);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvContent);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    }),
  });

  const summary = {
    totalRows: rows.length,
    ready: 0,
    inserted: 0,
    duplicates: 0,
    skipped: 0,
    inferredNames: 0,
    inferredPrimaryNiches: 0,
  };

  const duplicateSamples = [];
  const skippedSamples = [];
  const readySamples = [];

  try {
    await prisma.$connect();
    const existingCreators = await prisma.creator.findMany({
      select: {
        id: true,
        name: true,
        businessEmail: true,
        platforms: {
          select: {
            platform: true,
            handle: true,
          },
        },
      },
    });
    const existingIndex = buildExistingIdentityIndex(existingCreators);

    for (const row of rows) {
      const result = buildCreatorPayload(row, args.mode);

      if (result.status !== 'ready') {
        summary.skipped += 1;
        if (skippedSamples.length < 10) {
          skippedSamples.push({
            handle:
              cleanHandle(row['Instagram Handle']) ??
              cleanHandle(row['TikTok Handle']) ??
              cleanHandle(row['YouTube Handle']) ??
              cleanHandle(row['X (Twitter) Handle']) ??
              '(no handle)',
            reason: result.reason,
          });
        }
        continue;
      }

      summary.ready += 1;
      if (result.inferredName) {
        summary.inferredNames += 1;
      }
      if (result.inferredPrimaryNiche) {
        summary.inferredPrimaryNiches += 1;
      }

      const duplicate = findDuplicateFromIndex(result.payload, existingIndex);

      if (duplicate) {
        summary.duplicates += 1;
        if (duplicateSamples.length < 10) {
          duplicateSamples.push({
            incomingName: result.payload.name,
            existingId: duplicate.id,
            existingName: duplicate.name,
          });
        }
        continue;
      }

      if (readySamples.length < 5) {
        readySamples.push({
          name: result.payload.name,
          primaryNiche: result.payload.primaryNiche,
          platforms: result.payload.platforms.map((platform) => `${platform.platform}:${platform.handle}`),
        });
      }

      const createdIdentity = buildIdentityRecord(
        args.apply ? `pending-db:${summary.inserted + 1}` : `dry-run:${summary.ready}`,
        result.payload,
      );

      if (createdIdentity.businessEmail) {
        existingIndex.emailMap.set(
          createdIdentity.businessEmail.toLowerCase(),
          createdIdentity,
        );
      }
      for (const platform of createdIdentity.platforms) {
        existingIndex.handleMap.set(
          `${platform.platform}:${platform.handle.toLowerCase()}`,
          createdIdentity,
        );
      }

      if (!args.apply) {
        continue;
      }

      await prisma.creator.create({
        data: {
          name: result.payload.name,
          gender: result.payload.gender,
          country: result.payload.country,
          state: result.payload.state,
          primaryNiche: result.payload.primaryNiche,
          secondaryNiches: result.payload.secondaryNiches,
          businessEmail: result.payload.businessEmail,
          profileImage: result.payload.profileImage,
          platforms: result.payload.platforms.length
            ? {
                create: result.payload.platforms,
              }
            : undefined,
          searchTags: result.payload.searchTags.length
            ? {
                create: result.payload.searchTags.map((tag) => ({ tag })),
              }
            : undefined,
        },
      });

      summary.inserted += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: args.mode,
          apply: args.apply,
          file: csvPath,
          summary,
          readySamples,
          duplicateSamples,
          skippedSamples,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
