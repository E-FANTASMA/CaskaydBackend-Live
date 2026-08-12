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
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
JWT_REFRESH_EXPIRES_IN=7d
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
npx prisma db push
```

Start the API in development mode:

```bash
npm run start:dev
```

## Local URLs

- API base: `http://localhost:3000/api`
- Swagger docs: `http://localhost:3000/docs`

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
npx prisma db push
```
