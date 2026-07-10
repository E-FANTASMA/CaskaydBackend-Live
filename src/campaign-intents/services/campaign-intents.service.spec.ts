import { BadRequestException } from '@nestjs/common';
import { CampaignIntentsService } from './campaign-intents.service';

describe('CampaignIntentsService', () => {
  let service: CampaignIntentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        count: jest.fn(),
      },
      campaignIntent: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new CampaignIntentsService(prisma);
  });

  it('rejects campaign intents with invalid categories', async () => {
    prisma.category.count.mockResolvedValue(1);

    await expect(
      service.create({
        name: 'Apartment Showcase',
        categoryIds: ['cat-1', 'cat-2'],
        tags: ['apartment'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates and serializes campaign intents', async () => {
    prisma.category.count.mockResolvedValue(2);
    prisma.campaignIntent.findFirst.mockResolvedValue(null);
    prisma.campaignIntent.create.mockResolvedValue({
      id: 'intent-1',
      name: 'Apartment Showcase',
      slug: 'apartment-showcase',
      description: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      categories: [
        { category: { id: 'cat-1', name: 'Real Estate', slug: 'real-estate' } },
        { category: { id: 'cat-2', name: 'Apartment Tours', slug: 'apartment-tours' } },
      ],
      tags: [{ tag: 'apartment' }, { tag: 'property' }],
    });

    await expect(
      service.create({
        name: 'Apartment Showcase',
        categoryIds: ['cat-1', 'cat-2'],
        tags: ['Apartment', 'property', 'property'],
      }),
    ).resolves.toMatchObject({
      id: 'intent-1',
      categoryIds: ['cat-1', 'cat-2'],
      tags: ['apartment', 'property'],
      categories: [
        { id: 'cat-1', name: 'Real Estate', slug: 'real-estate' },
        { id: 'cat-2', name: 'Apartment Tours', slug: 'apartment-tours' },
      ],
    });
  });
});
