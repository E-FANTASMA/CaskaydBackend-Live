import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PlatformType, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

export type TestRole = 'USER' | 'ADMIN';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestContext> {
  process.env.NODE_ENV = 'test';
  process.env.CRAWLER_ENABLED = 'false';
  process.env.KEEP_ALIVE_ENABLED = 'false';
  process.env.REDIS_HOST = '';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  clearScheduledJobs(app);

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

function clearScheduledJobs(app: INestApplication) {
  const schedulerRegistry = app.get(SchedulerRegistry, { strict: false });
  for (const jobName of schedulerRegistry.getCronJobs().keys()) {
    schedulerRegistry.deleteCronJob(jobName);
  }
}

export async function cleanDatabase(prisma: PrismaService) {
  await withDbRetry(async () => {
    await prisma.campaignCreatorNote.deleteMany();
    await prisma.campaignCreator.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.savedCreator.deleteMany();
    await prisma.creatorSuggestion.deleteMany();
    await prisma.creatorSecondaryCategory.deleteMany();
    await prisma.searchTag.deleteMany();
    await prisma.creatorPlatform.deleteMany();
    await prisma.creator.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.user.deleteMany();
  });
}

export async function createTestUser(
  app: INestApplication,
  prisma: PrismaService,
  role: TestRole,
) {
  const normalizedRole = role === 'ADMIN' ? 'admin' : 'USER';
  const user = await withDbRetry(() =>
    prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
        password: 'hashed-password',
        fullName: `${role} Test User`,
        subscriptions: {
          create: {
            plan: SubscriptionPlan.INDIVIDUAL,
            status: SubscriptionStatus.ACTIVE,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    }),
  );

  return app.get(JwtService).signAsync(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: normalizedRole,
      tokenType: 'access',
    },
    {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '1h',
    },
  );
}

export async function seedCreator(
  prisma: PrismaService,
  data: {
    name: string;
    username: string;
    platform: PlatformType;
    followers: number;
    state?: string | null;
  },
) {
  return withDbRetry(() =>
    prisma.creator.create({
      data: {
        name: data.name,
        state: data.state,
        platforms: {
          create: {
            platform: data.platform,
            handle: data.username,
            followers: data.followers,
            verified: false,
          },
        },
      },
      include: {
        platforms: true,
        primaryCategory: true,
        secondaryCategories: { include: { category: true } },
        searchTags: true,
      },
    }),
  );
}

async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientDbError(error)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  throw lastError;
}

function isTransientDbError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /EAI_AGAIN|Can't reach database server|Connection terminated|timeout/i.test(
    error.message,
  );
}
