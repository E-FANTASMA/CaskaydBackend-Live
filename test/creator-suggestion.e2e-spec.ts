import { INestApplication } from '@nestjs/common';
import { PlatformType, SuggestionStatus } from '@prisma/client';
import request from 'supertest';
import {
  cleanDatabase,
  createTestApp,
  createTestUser,
  seedCreator,
} from './setup';
import { PrismaService } from '../src/database/prisma.service';

const suggestionPayload = {
  name: 'Test Creator',
  username: '@testcreator',
  platform: 'Instagram',
  link: 'https://instagram.com/testcreator',
};

function errorMessage(body: { error?: { message?: string | string[] } }) {
  return body.error?.message;
}

describe('Creator Suggestions API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    prisma = context.prisma;
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    userToken = await createTestUser(app, prisma, 'USER');
    adminToken = await createTestUser(app, prisma, 'ADMIN');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('creates a pending suggestion and normalizes @ usernames', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/creator-suggestions')
      .set('Authorization', `Bearer ${userToken}`)
      .send(suggestionPayload)
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Test Creator',
      username: 'testcreator',
      platform: 'Instagram',
      link: 'https://instagram.com/testcreator',
      status: SuggestionStatus.PENDING,
    });

    const storedSuggestion = await prisma.creatorSuggestion.findUnique({
      where: { id: response.body.id },
    });
    expect(storedSuggestion).toMatchObject({
      username: 'testcreator',
      status: SuggestionStatus.PENDING,
    });
  });

  it('rejects empty required fields with validation errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/creator-suggestions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '', username: '', platform: '' })
      .expect(400);

    expect(errorMessage(response.body)).toEqual(
      expect.arrayContaining([
        'name should not be empty',
        'username should not be empty',
        'platform should not be empty',
      ]),
    );
  });

  it('prevents suggestions for an existing creator username', async () => {
    await seedCreator(prisma, {
      name: 'Existing Creator',
      username: 'testcreator',
      platform: PlatformType.INSTAGRAM,
      followers: 5000,
      state: 'Lagos',
    });

    const response = await request(app.getHttpServer())
      .post('/api/creator-suggestions')
      .set('Authorization', `Bearer ${userToken}`)
      .send(suggestionPayload)
      .expect(400);

    expect(errorMessage(response.body)).toBe('Creator already exists');
  });

  it('prevents duplicate pending suggestions', async () => {
    await request(app.getHttpServer())
      .post('/api/creator-suggestions')
      .set('Authorization', `Bearer ${userToken}`)
      .send(suggestionPayload)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/creator-suggestions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ...suggestionPayload, username: 'TESTCREATOR' })
      .expect(400);

    expect(errorMessage(response.body)).toBe('Creator already suggested');
    expect(await prisma.creatorSuggestion.count()).toBe(1);
  });

  it('lets admins fetch suggestions and filter by status', async () => {
    await prisma.creatorSuggestion.createMany({
      data: [
        {
          name: 'Pending Creator',
          username: 'pendingcreator',
          platform: 'Instagram',
          status: SuggestionStatus.PENDING,
        },
        {
          name: 'Rejected Creator',
          username: 'rejectedcreator',
          platform: 'TikTok',
          status: SuggestionStatus.REJECTED,
        },
      ],
    });

    const allResponse = await request(app.getHttpServer())
      .get('/api/admin/creator-suggestions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(allResponse.body).toHaveLength(2);

    const pendingResponse = await request(app.getHttpServer())
      .get('/api/admin/creator-suggestions')
      .query({ status: 'PENDING' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(pendingResponse.body).toHaveLength(1);
    expect(pendingResponse.body[0]).toMatchObject({
      username: 'pendingcreator',
      status: SuggestionStatus.PENDING,
    });
  });

  it('approves a suggestion atomically and creates a matching creator', async () => {
    const suggestion = await prisma.creatorSuggestion.create({
      data: {
        name: 'Approval Creator',
        username: 'approvalcreator',
        platform: 'Instagram',
        link: 'https://instagram.com/approvalcreator',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/creator-suggestions/${suggestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(response.body.suggestion).toMatchObject({
      id: suggestion.id,
      status: SuggestionStatus.APPROVED,
    });
    expect(response.body.creator).toMatchObject({
      name: 'Approval Creator',
      state: null,
    });
    expect(response.body.creator.platforms[0]).toMatchObject({
      platform: 'INSTAGRAM',
      handle: 'approvalcreator',
      followers: 0,
      profileUrl: 'https://instagram.com/approvalcreator',
    });

    const [storedSuggestion, creators] = await Promise.all([
      prisma.creatorSuggestion.findUnique({ where: { id: suggestion.id } }),
      prisma.creator.findMany({
        where: {
          platforms: {
            some: { handle: 'approvalcreator' },
          },
        },
        include: { platforms: true },
      }),
    ]);

    expect(storedSuggestion?.status).toBe(SuggestionStatus.APPROVED);
    expect(creators).toHaveLength(1);
    expect(creators[0].name).toBe('Approval Creator');
  });

  it('rejects a suggestion without creating a creator', async () => {
    const suggestion = await prisma.creatorSuggestion.create({
      data: {
        name: 'Rejected Creator',
        username: 'rejectme',
        platform: 'TikTok',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/creator-suggestions/${suggestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' })
      .expect(200);

    expect(response.body.suggestion).toMatchObject({
      id: suggestion.id,
      status: SuggestionStatus.REJECTED,
    });
    expect(await prisma.creator.count()).toBe(0);
  });

  it('rejects invalid status updates', async () => {
    const suggestion = await prisma.creatorSuggestion.create({
      data: {
        name: 'Invalid Status Creator',
        username: 'invalidstatus',
        platform: 'Instagram',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/creator-suggestions/${suggestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INVALID' })
      .expect(400);

    expect(errorMessage(response.body)).toEqual(
      expect.arrayContaining([
        'status must be one of the following values: PENDING, APPROVED, REJECTED',
      ]),
    );
  });

  it('prevents approving the same suggestion twice', async () => {
    const suggestion = await prisma.creatorSuggestion.create({
      data: {
        name: 'Single Approval Creator',
        username: 'singleapproval',
        platform: 'Instagram',
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/admin/creator-suggestions/${suggestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/creator-suggestions/${suggestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(400);

    expect(errorMessage(response.body)).toBe(
      'Suggestion has already been approved',
    );
    expect(await prisma.creator.count()).toBe(1);
  });
});
