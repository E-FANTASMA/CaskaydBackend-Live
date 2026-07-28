import { PlatformType } from '@prisma/client';
import { CrawlerNormalizerService } from './crawler-normalizer.service';

describe('CrawlerNormalizerService', () => {
  let service: CrawlerNormalizerService;

  beforeEach(() => {
    service = new CrawlerNormalizerService();
  });

  it('normalizes a raw creator record into the shared profile shape', () => {
    const profile = service.normalize({
      platform: 'instagram',
      platformCreatorId: 'abc123',
      displayName: 'Ada Foodie',
      username: '@ada.foodie',
      followers: '12.5k',
      verified: 'yes',
      externalUrl: 'https://instagram.com/ada.foodie',
      keywords: 'food, reviews',
    });

    expect(profile.platform).toBe(PlatformType.INSTAGRAM);
    expect(profile.username).toBe('ada.foodie');
    expect(profile.followers).toBe(12_500);
    expect(profile.verified).toBe(true);
    expect(profile.keywords).toEqual(
      expect.arrayContaining(['food', 'reviews', 'ada foodie']),
    );
  });
});
