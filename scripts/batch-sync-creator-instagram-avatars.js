require('dotenv').config();

const { spawn } = require('child_process');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function parseArgs(argv) {
  const args = {
    limit: 5,
    all: false,
    delay: 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--all' || value === '--limit=all' || value === '--limit=ALL') {
      args.all = true;
      args.limit = null;
      continue;
    }

    if (value.startsWith('--limit=')) {
      args.limit = Number.parseInt(value.slice('--limit='.length), 10) || 5;
      continue;
    }

    if (value === '--limit') {
      args.limit = Number.parseInt(argv[index + 1] ?? '5', 10) || 5;
      index += 1;
      continue;
    }

    if (value.startsWith('--delay=')) {
      args.delay = Number.parseInt(value.slice('--delay='.length), 10) || 1000;
      continue;
    }

    if (value === '--delay') {
      args.delay = Number.parseInt(argv[index + 1] ?? '1000', 10) || 1000;
      index += 1;
      continue;
    }
  }

  return args;
}

function getPythonCommand() {
  return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3');
}

function runPythonFetch(handle) {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonCommand();
    const child = spawn(
      pythonCmd,
      ['scripts/sync-creator-instagram-avatars.py', handle, '--json', '--skip-download'],
      {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `Python executable "${pythonCmd}" not found. Ensure Python 3 is installed or set PYTHON_BIN in .env`,
          ),
        );
      } else {
        reject(error);
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Python exited with code ${code}`));
        return;
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const jsonLine = [...lines].reverse().find((line) => line.startsWith('{'));

      if (!jsonLine) {
        reject(new Error(`No JSON response returned for @${handle}. Output: ${stdout}`));
        return;
      }

      try {
        const parsed = JSON.parse(jsonLine);
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }

        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Could not parse JSON response for @${handle}: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
          ),
        );
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    }),
  });

  try {
    await prisma.$connect();

    const creators = args.all
      ? await prisma.$queryRaw`
          SELECT c.id::text AS id, c.name, cp.handle
          FROM "Creator" c
          JOIN "CreatorPlatform" cp
            ON cp."creatorId" = c.id::text
          WHERE cp.platform = 'INSTAGRAM'
            AND (c."profileImage" IS NULL OR c."profileImage" = '')
          ORDER BY c."createdAt" DESC
        `
      : await prisma.$queryRaw`
          SELECT c.id::text AS id, c.name, cp.handle
          FROM "Creator" c
          JOIN "CreatorPlatform" cp
            ON cp."creatorId" = c.id::text
          WHERE cp.platform = 'INSTAGRAM'
            AND (c."profileImage" IS NULL OR c."profileImage" = '')
          ORDER BY c."createdAt" DESC
          LIMIT ${args.limit}
        `;

    console.log(`Found ${creators.length} creator(s) without profile images.`);

    let updated = 0;
    let failed = 0;

    for (const [index, creator] of creators.entries()) {
      const handle = creator.handle?.replace(/^@/, '');

      if (!handle) {
        failed += 1;
        console.log(`[${index + 1}/${creators.length}] Skipped ${creator.name}: no Instagram handle.`);
        continue;
      }

      try {
        console.log(`[${index + 1}/${creators.length}] Fetching @${handle} for ${creator.name}...`);
        const result = await runPythonFetch(handle);

        await prisma.$executeRaw`
          UPDATE "Creator"
          SET "profileImage" = ${result.profile_pic_url}
          WHERE id = CAST(${creator.id} AS uuid)
        `;

        updated += 1;
        console.log(`Saved profile image for ${creator.name}.`);
      } catch (error) {
        failed += 1;
        console.log(
          `Failed for ${creator.name} (@${handle}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      if (args.delay > 0 && index < creators.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, args.delay));
      }
    }

    console.log(JSON.stringify({ scanned: creators.length, updated, failed }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
