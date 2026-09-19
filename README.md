# Caskayd Backend

NestJS backend for the Caskayd MVP.

## Stack

- Node.js
- NestJS
- PostgreSQL
- Prisma
- Redis
- BullMQ

## Prerequisites

Install these before running the project:

- Node.js 20+
- npm
- PostgreSQL
- Redis

## First-Time Setup

Clone the repo, install dependencies, and create your environment file:

```bash
npm install
copy .env.example .env
```

Update `.env` with real values:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_ACCESS_EXPIRES_IN=30d
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
JWT_REFRESH_EXPIRES_IN=30d
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com/v3
FLUTTERWAVE_REDIRECT_URL=
KEEP_ALIVE_ENABLED=false
KEEP_ALIVE_URL=
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

Required values:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Optional keep-alive values:

- `KEEP_ALIVE_ENABLED=true` enables a cron that pings your backend every 10 minutes
- `KEEP_ALIVE_URL=https://your-backend-host/api/health` sets the public health URL to ping

If `KEEP_ALIVE_URL` is empty and your host exposes `RENDER_EXTERNAL_URL`, the app will fall back to `RENDER_EXTERNAL_URL/api/health`.

Then prepare Prisma:

```bash
npx prisma generate
npx prisma migrate deploy
```

`prisma migrate deploy` is safe to run during deployment: Prisma records applied
migrations in the database and runs each migration only once. Do not use
`prisma db push`, `prisma migrate reset`, or `prisma migrate dev` against the
production database.

Start the API in development mode:

```bash
npm run start:dev
```

## Local URLs

- API base: `http://localhost:3000/api`
- Swagger docs: `http://localhost:3000/docs`
- Transaction guide: `./TRANSACTION_GUIDE.md`

## Useful Scripts

```bash
npm run start
npm run start:dev
npm run build
npm run start:prod
npm run test
npm run test:e2e
```

## Import Creators From CSV

Dry run:

```bash
npm run import:creators -- --file=path/to/creators.csv
```

Insert into the database:

```bash
npm run import:creators -- --file=path/to/creators.csv --apply
```

Optional mode:

```bash
npm run import:creators -- --file=path/to/creators.csv --mode=lenient
```

## Pull One Instagram Profile Picture

This repo now uses a very simple Instaloader script for testing one profile picture at a time.

Run the default creator:

```bash
npm run sync:creator-avatars
```

Run a different creator:

```bash
npm run sync:creator-avatars -- official_gegeh
```

The script prints the profile picture URL and downloads the profile image locally.

## Batch Save Instagram Profile URLs

If you want to automate saving profile picture URLs into `Creator.profileImage` for creators who do not already have one, run:

```bash
npm run sync:creator-avatars:batch
```

Default batch size is `5`. To run a different size:

```bash
npm run sync:creator-avatars:batch -- --limit=10
```

To run for **all** creators in the database without profile pictures:

```bash
npm run sync:creator-avatars:batch -- --all
```

*(Optional) You can customize the delay between Instagram requests (default is 1000ms) using `--delay=<milliseconds>` to avoid rate limits:*

```bash
npm run sync:creator-avatars:batch -- --all --delay=1500
```

This batch script:

- only selects creators whose `profileImage` is empty
- uses the first Instagram handle on each creator
- fetches the profile picture URL
- stores that URL in the database
- skips creators that already have a `profileImage`


## Redis

This project already includes:

- a shared Redis client in `src/common/services/redis.service.ts`
- a BullMQ queue factory in `src/common/services/queue.service.ts`

Right now, those services are registered but I do not see feature modules actively using them yet. So Redis appears to be infrastructure that was added for background jobs, caching, or rate/async work, but not yet fully used by the app logic.

What Redis would typically be used for here:

- background jobs with BullMQ
- caching expensive lookups
- storing short-lived async state
- decoupling tasks like notifications, imports, or payment follow-ups

If you are only running the current code and nothing calls the queue or Redis client yet, Redis may not be doing meaningful work at runtime. It is still safest to keep it available because the app is already configured around it and future features may depend on it immediately.

## Notes For Teammates

- Use `.env.example` as the template for local setup.
- Do not commit your real `.env`.
- If Prisma schema changes, rerun:

```bash
npx prisma generate
npx prisma migrate deploy
```

---

## Core Services & Automated Workers

### 1. On-the-Spin Real-Time HD Avatar Sync (`CreatorAvatarSyncService`)
When any creator is registered (`POST /api/creators`), the backend immediately fires an asynchronous background task to fetch their True HD avatar with a multi-tier waterfall:
- **Tier 1 (Instagram True HD)**: Scrapes mobile profile metadata to obtain the raw uncompressed `og:image`.
- **Tier 2 (TikTok 1080x1080 True HD)**: Scrapes uncompressed `avatarLarger` (1080x1080) from public profile JSON.
- **Tier 3 (Cross-Handle Fallback)**: Checks TikTok for the same handle if only Instagram was provided.
- Uploads directly to Supabase Storage (`profile-picture/{creatorId}.jpg`) and updates `Creator.profileImage`.
- **On-Demand Endpoint**: `POST /api/creators/:id/sync-avatar` allows triggering an avatar refresh for any creator manually.

### 2. Follower-Tiered Metrics Sync Scheduler (`CreatorMetricsSyncSchedulerService`)
Automated NestJS `@Cron` workers to refresh follower counts and verification checkmark badges:
- **Tier 1 (Mega >500k followers)**: Runs twice a week (Mondays & Thursdays at 2:00 AM).
- **Tier 2 (Mid 100k–500k followers)**: Runs once a week (Tuesdays at 3:00 AM).
- **Tier 3 (Micro <100k followers)**: Runs bi-weekly (1st & 15th of each month at 4:00 AM).

### 3. Relevancy-First Search Ranking (`RankingService`)
Prioritizes exact and substring matches for names and handles at the top of search results:
- Exact full name match: +1000 points
- Substring name match: +500 points
- Exact `@handle` match: +1000 points
- Substring handle match: +500 points
