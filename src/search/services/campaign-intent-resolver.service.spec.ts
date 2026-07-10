import { CampaignIntentResolverService } from './campaign-intent-resolver.service';

describe('CampaignIntentResolverService', () => {
  let service: CampaignIntentResolverService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      campaignIntent: {
        findMany: jest.fn(),
      },
    };
    service = new CampaignIntentResolverService(prisma);
  });

  it('resolves a strong campaign intent match and expands metadata', async () => {
    prisma.campaignIntent.findMany.mockResolvedValue([
      {
        id: 'intent-1',
        name: 'Apartment Showcase',
        slug: 'apartment-showcase',
        description: null,
        categories: [
          { category: { id: 'cat-1', name: 'Real Estate' } },
          { category: { id: 'cat-2', name: 'Apartment Tours' } },
        ],
        tags: [{ tag: 'apartment' }, { tag: 'property' }],
      },
    ]);

    await expect(
      service.resolve({
        query: 'male creators in lagos for an apartment showcase',
        tokens: ['male', 'creators', 'in', 'lagos', 'for', 'an', 'apartment', 'showcase'],
      }),
    ).resolves.toEqual({
      id: 'intent-1',
      name: 'Apartment Showcase',
      slug: 'apartment-showcase',
      categoryIds: ['cat-1', 'cat-2'],
      categoryNames: ['Real Estate', 'Apartment Tours'],
      tags: ['apartment', 'property'],
    });
  });

  it('returns undefined when no intent crosses the confidence threshold', async () => {
    prisma.campaignIntent.findMany.mockResolvedValue([
      {
        id: 'intent-1',
        name: 'Apartment Showcase',
        slug: 'apartment-showcase',
        description: null,
        categories: [],
        tags: [{ tag: 'property' }],
      },
    ]);

    await expect(
      service.resolve({
        query: 'female creators in lagos',
        tokens: ['female', 'creators', 'in', 'lagos'],
      }),
    ).resolves.toBeUndefined();
  });
});
