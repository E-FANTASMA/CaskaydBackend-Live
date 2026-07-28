const path = require('path');
require('ts-node/register');
require('tsconfig-paths/register');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { CrawlerImporterService } = require('../src/crawler/services/crawler-importer.service');

function parseArgs(argv) {
  const args = {
    file: '',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--dry-run') {
      args.dryRun = true;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const importer = app.get(CrawlerImporterService);
    const summary = await importer.importJson(path.resolve(args.file), {
      source: 'json',
      dryRun: args.dryRun,
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
