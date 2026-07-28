import { PlatformType } from '@prisma/client';

export interface DiscoveryJobPayload {
  platform: PlatformType;
  keywords?: string[];
  limit?: number;
}

export interface RefreshJobPayload {
  creatorId: string;
  platform: PlatformType;
}
