const fs = require('fs');
const path = require('path');

require('ts-node/register');
require('tsconfig-paths/register');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { PrismaService } = require('../src/database/prisma.service');
const { CrawlerPipelineService } = require('../src/crawler/services/crawler-pipeline.service');

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

function buildKeywords(row) {
  return [
    row.primaryNiche,
    ...safeJsonArray(row.secondaryNiches),
    row.gender,
    row.state,
    row.country,
  ].filter(Boolean);
}

function buildRecord(row, platform) {
  const lower = platform.toLowerCase();
  const handleKey = `${lower}Handle`;
  const followersKey = `${lower}Followers`;
  const handle = (row[handleKey] ?? '').replace(/^@/, '').trim();

  if (!handle) {
    return null;
  }

  return {
    platform,
    platformCreatorId: handle,
    username: handle,
    name: row.name || handle,
    displayName: row.name || handle,
    followers: row[followersKey] || '0',
    businessEmail: row.email || undefined,
    location: [row.state, row.country].filter(Boolean).join(', ') || undefined,
    keywords: buildKeywords(row),
  };
}

function transformRows(rows) {
  const records = [];

  for (const row of rows) {
    for (const platform of ['INSTAGRAM', 'TIKTOK']) {
      const record = buildRecord(row, platform);
      if (record) {
        records.push(record);
      }
    }
  }

  return records;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(args.file);
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const records = transformRows(rows);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const pipeline = app.get(CrawlerPipelineService);

    const beforeCount = await prisma.creator.count();
    const categoryCount = await prisma.category.count();

    const summary = {
      csvRows: rows.length,
      importRecords: records.length,
      creatorsBefore: beforeCount,
      categoriesAvailable: categoryCount,
      deletedCreators: 0,
      importedRecords: 0,
      failedRecords: 0,
      creatorsAfter: beforeCount,
      apply: args.apply,
      errors: [],
    };

    if (!args.apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (!categoryCount) {
      throw new Error('No categories found in the database. Seed categories before importing creators.');
    }

    const deleted = await prisma.creator.deleteMany();
    summary.deletedCreators = deleted.count;

    for (const [index, record] of records.entries()) {
      try {
        await pipeline.ingest(record);
        summary.importedRecords += 1;
      } catch (error) {
        summary.failedRecords += 1;
        summary.errors.push(
          `Record ${index + 1} (${record.platform}:${record.username}): ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    summary.creatorsAfter = await prisma.creator.count();

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
