import { PlatformType } from '@prisma/client';

export interface NormalizedCreatorProfile {
  platform: PlatformType;
  platformCreatorId: string;
  name: string;
  displayName?: string;
  username: string;
  bio?: string;
  profileImage?: string;
  followers: number;
  following?: number;
  posts?: number;
  website?: string;
  businessEmail?: string;
  verified: boolean;
  location?: string;
  externalUrl?: string;
  lastSeen: Date;
  keywords: string[];
}
