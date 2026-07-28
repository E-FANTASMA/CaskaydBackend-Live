import { PlatformType } from '@prisma/client';
import {
  CrawlerWorker,
  DiscoverCreatorsInput,
  RefreshCreatorInput,
} from '../interfaces/crawler-worker.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';

export abstract class BaseMockCrawlerWorker implements CrawlerWorker {
  abstract readonly platform: PlatformType;

  async discoverCreators(
    input: DiscoverCreatorsInput,
  ): Promise<NormalizedCreatorProfile[]> {
    const limit = input.limit ?? 5;
    const keyword = input.keywords?.[0] ?? this.platform.toLowerCase();

    return Array.from({ length: limit }, (_, index) =>
      this.buildProfile({
        username: `${keyword.replace(/[^a-z0-9]+/gi, '')}_${index + 1}`,
        seed: index + 1,
      }),
    );
  }

  async refreshCreator(input: RefreshCreatorInput): Promise<NormalizedCreatorProfile> {
    return this.buildProfile({
      username: input.username,
      seed: 99,
      platformCreatorId: input.platformCreatorId ?? input.username,
      externalUrl: input.externalUrl ?? undefined,
    });
  }

  protected buildProfile(input: {
    username: string;
    seed: number;
    platformCreatorId?: string;
    externalUrl?: string;
  }): NormalizedCreatorProfile {
    const username = input.username.toLowerCase();
    const displayName = username
      .replace(/[._]+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());

    return {
      platform: this.platform,
      platformCreatorId: input.platformCreatorId ?? username,
      name: displayName,
      displayName,
      username,
      bio: `${displayName} shares food, lifestyle and creator updates`,
      profileImage: `https://cdn.caskayd.test/${this.platform.toLowerCase()}/${username}.jpg`,
      followers: 5_000 + input.seed * 250,
      following: 500 + input.seed * 10,
      posts: 100 + input.seed,
      website: `https://${username}.example.com`,
      businessEmail: `${username}@example.com`,
      verified: input.seed % 2 === 0,
      location: 'Lagos, Nigeria',
      externalUrl:
        input.externalUrl ?? `https://${this.platformProfileHost()}/${username}`,
      lastSeen: new Date(),
      keywords: ['food', 'lifestyle', this.platform.toLowerCase()],
    };
  }

  private platformProfileHost() {
    switch (this.platform) {
      case PlatformType.INSTAGRAM:
        return 'instagram.com';
      case PlatformType.TIKTOK:
        return 'www.tiktok.com/@';
      case PlatformType.YOUTUBE:
        return 'www.youtube.com/@';
      case PlatformType.X:
        return 'x.com';
      default:
        return 'example.com';
    }
  }
}
