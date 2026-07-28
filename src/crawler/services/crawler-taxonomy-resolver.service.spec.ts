import { CrawlerTaxonomyResolverService } from './crawler-taxonomy-resolver.service';

describe('CrawlerTaxonomyResolverService', () => {
  let service: CrawlerTaxonomyResolverService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'food-root',
            name: 'Food',
            slug: 'food',
            description: 'Food creators',
            parentId: null,
            level: 1,
          },
          {
            id: 'restaurant',
            name: 'Restaurants',
            slug: 'restaurants',
            description: 'Restaurant reviews',
            parentId: 'food-root',
            level: 2,
          },
          {
            id: 'coffee',
            name: 'Coffee',
            slug: 'coffee',
            description: 'Coffee shops and cafes',
            parentId: 'food-root',
            level: 2,
          },
          {
            id: 'tech-root',
            name: 'Technology',
            slug: 'technology',
            description: 'Technology creators',
            parentId: null,
            level: 1,
          },
        ]),
      },
    };
    service = new CrawlerTaxonomyResolverService(prisma);
  });

  it('resolves a primary root category and scoped secondary categories', async () => {
    const resolution = await service.resolve({
      platform: 'INSTAGRAM' as any,
      platformCreatorId: 'lagosfoodie',
      name: 'Lagos Foodie',
      displayName: 'Lagos Foodie',
      username: 'lagosfoodie',
      bio: 'Lagos food blogger exploring restaurants and hidden cafes',
      followers: 1000,
      verified: false,
      lastSeen: new Date(),
      keywords: ['food', 'restaurants', 'coffee'],
    });

    expect(resolution.primaryCategoryId).toBe('food-root');
    expect(resolution.secondaryCategoryIds).toEqual(
      expect.arrayContaining(['restaurant', 'coffee']),
    );
  });
});
