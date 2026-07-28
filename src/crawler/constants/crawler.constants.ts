import { PlatformType } from '@prisma/client';

export const CRAWLER_QUEUE_NAME = 'creator-crawler';
export const CRAWLER_DISCOVERY_JOB = 'crawler.discovery';
export const CRAWLER_REFRESH_JOB = 'crawler.refresh';
export const CRAWLER_WORKER_TOKEN = 'CRAWLER_WORKERS';

export const REFRESH_TIERS = {
  LARGE: 'large',
  MEDIUM: 'medium',
  SMALL: 'small',
} as const;

export type RefreshTier = (typeof REFRESH_TIERS)[keyof typeof REFRESH_TIERS];

export const REFRESH_TIER_THRESHOLDS: Record<RefreshTier, { min: number; max?: number }> = {
  [REFRESH_TIERS.LARGE]: { min: 100_000 },
  [REFRESH_TIERS.MEDIUM]: { min: 10_000, max: 99_999 },
  [REFRESH_TIERS.SMALL]: { min: 0, max: 9_999 },
};

export const SUPPORTED_CRAWLER_PLATFORMS: PlatformType[] = [
  PlatformType.INSTAGRAM,
  PlatformType.TIKTOK,
  PlatformType.YOUTUBE,
  PlatformType.X,
];
