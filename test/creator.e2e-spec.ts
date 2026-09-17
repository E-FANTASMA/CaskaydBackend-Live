import { INestApplication } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import request from 'supertest';
import {
  cleanDatabase,
  createTestApp,
  createTestUser,
  seedCreator,
} from './setup';
import { PrismaService } from '../src/database/prisma.service';

describe('Creators API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    prisma = context.prisma;
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    userToken = await createTestUser(app, prisma, 'USER');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  async function seedCreators() {
    await Promise.all([
      seedCreator(prisma, {
        name: 'Creator A',
        username: 'creatorA',
        platform: PlatformType.INSTAGRAM,
        followers: 1000,
        state: 'Lagos',
      }),
      seedCreator(prisma, {
        name: 'Creator B',
        username: 'creatorB',
        platform: PlatformType.TIKTOK,
        followers: 2000,
        state: 'Abuja',
      }),
      seedCreator(prisma, {
        name: 'Creator C',
        username: 'creatorC',
        platform: PlatformType.INSTAGRAM,
        followers: 1500,
        state: 'lagos',
      }),
    ]);
  }

  it('filters creators by state case-insensitively', async () => {
    await seedCreators();

    const response = await request(app.getHttpServer())
      .get('/api/creators')
      .query({ state: 'Lagos' })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.map((creator: { name: string }) => creator.name).sort()).toEqual([
      'Creator A',
      'Creator C',
    ]);
  });

  it('returns an empty array when state filter has no match', async () => {
    await seedCreators();

    const response = await request(app.getHttpServer())
      .get('/api/creators')
      .query({ state: 'Kano' })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('combines state and platform filters from frontend query params', async () => {
    await seedCreators();

    const response = await request(app.getHttpServer())
      .get('/api/creators')
      .query({ state: 'Lagos', platform: 'Instagram' })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(
      response.body.every(
        (creator: { state: string; platforms: { platform: string }[] }) =>
          creator.state.toLowerCase() === 'lagos' &&
          creator.platforms.some((platform) => platform.platform === 'INSTAGRAM'),
      ),
    ).toBe(true);
  });
});
