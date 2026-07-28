import { CrawlerSearchTagGeneratorService } from './crawler-search-tag-generator.service';

describe('CrawlerSearchTagGeneratorService', () => {
  let service: CrawlerSearchTagGeneratorService;

  beforeEach(() => {
    service = new CrawlerSearchTagGeneratorService();
  });

  it('builds searchable tags from the normalized profile and taxonomy', () => {
    const tags = service.generate(
      {
        platform: 'INSTAGRAM' as any,
        platformCreatorId: 'creator-1',
        name: 'Tech With Ada',
        displayName: 'Tech With Ada',
        username: 'techwithada',
        bio: 'Tech reviewer sharing AI and programming tips',
        followers: 0,
        verified: false,
        website: 'https://techwithada.example.com',
        location: 'Lagos, Nigeria',
        lastSeen: new Date(),
        keywords: ['ai', 'programming'],
      },
      {
        primaryCategoryId: 'tech',
        primaryCategory: {
          id: 'tech',
          name: 'Technology',
          slug: 'technology',
          description: null,
          parentId: null,
          level: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        secondaryCategoryIds: ['programming'],
        secondaryCategories: [
          {
            id: 'programming',
            name: 'Programming',
            slug: 'programming',
            description: null,
            parentId: 'tech',
            level: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    );

    expect(tags).toEqual(
      expect.arrayContaining([
        'technology',
        'programming',
        'techwithada',
        'lagos, nigeria',
        'reviewer',
      ]),
    );
  });
});
