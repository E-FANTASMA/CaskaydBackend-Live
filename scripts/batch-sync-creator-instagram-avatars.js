require('dotenv').config();

const { spawn } = require('child_process');

const { PrismaClient, PlatformType } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function parseArgs(argv) {
  const args = {
    limit: 5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value.startsWith('--limit=')) {
      args.limit = Number.parseInt(value.slice('--limit='.length), 10) || 5;
      continue;
    }

    if (value === '--limit') {
      args.limit = Number.parseInt(argv[index + 1] ?? '5', 10) || 5;
      index += 1;
    }
  }

  return args;
}

function runPythonFetch(handle) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'py',
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

    child.on('error', (error) => reject(error));

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

    const creators = await prisma.creator.findMany({
      where: {
        OR: [{ profileImage: null }, { profileImage: '' }],
        platforms: {
          some: {
            platform: PlatformType.INSTAGRAM,
          },
        },
      },
      select: {
        id: true,
        name: true,
        platforms: {
          where: {
            platform: PlatformType.INSTAGRAM,
          },
          select: {
            handle: true,
          },
          take: 1,
        },
      },
      take: args.limit,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${creators.length} creator(s) without profile images.`);

    let updated = 0;
    let failed = 0;

    for (const [index, creator] of creators.entries()) {
      const handle = creator.platforms[0]?.handle?.replace(/^@/, '');

      if (!handle) {
        failed += 1;
        console.log(`[${index + 1}/${creators.length}] Skipped ${creator.name}: no Instagram handle.`);
        continue;
      }

      try {
        console.log(`[${index + 1}/${creators.length}] Fetching @${handle} for ${creator.name}...`);
        const result = await runPythonFetch(handle);

        await prisma.creator.update({
          where: { id: creator.id },
          data: {
            profileImage: result.profile_pic_url,
          },
        });

        updated += 1;
        console.log(`Saved profile image for ${creator.name}.`);
      } catch (error) {
        failed += 1;
        console.log(
          `Failed for ${creator.name} (@${handle}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
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
