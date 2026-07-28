import { PlatformType } from '@prisma/client';
import { NormalizedCreatorProfile } from './normalized-creator-profile.interface';

export interface DiscoverCreatorsInput {
  platform: PlatformType;
  keywords?: string[];
  limit?: number;
}

export interface RefreshCreatorInput {
  creatorId: string;
  platform: PlatformType;
  username: string;
  platformCreatorId?: string;
  externalUrl?: string | null;
}

export interface CrawlerWorker {
  readonly platform: PlatformType;
  discoverCreators(input: DiscoverCreatorsInput): Promise<NormalizedCreatorProfile[]>;
  refreshCreator(input: RefreshCreatorInput): Promise<NormalizedCreatorProfile>;
}
