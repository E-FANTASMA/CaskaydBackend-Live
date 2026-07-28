import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlatformType } from '@prisma/client';
import {
  RefreshTier,
  REFRESH_TIERS,
  REFRESH_TIER_THRESHOLDS,
  SUPPORTED_CRAWLER_PLATFORMS,
} from '../constants/crawler.constants';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerQueueService } from './crawler-queue.service';

@Injectable()
export class CrawlerSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerQueue: CrawlerQueueService,
  ) {}

  @Cron('0 0 2 * * *')
  async scheduleDailyDiscovery() {
    await Promise.all(
      SUPPORTED_CRAWLER_PLATFORMS.map((platform) =>
        this.crawlerQueue.enqueueDiscovery(platform, [], 10),
      ),
    );
  }

  @Cron('0 0 3 * * *')
  async scheduleLargeCreatorRefresh() {
    await this.enqueueRefreshByTier(REFRESH_TIERS.LARGE);
  }

  @Cron('0 0 4 * * 1')
  async scheduleMediumCreatorRefresh() {
    await this.enqueueRefreshByTier(REFRESH_TIERS.MEDIUM);
  }

  @Cron('0 0 5 1 * *')
  async scheduleSmallCreatorRefresh() {
    await this.enqueueRefreshByTier(REFRESH_TIERS.SMALL);
  }

  private async enqueueRefreshByTier(tier: RefreshTier) {
    const { min, max } = REFRESH_TIER_THRESHOLDS[tier];
    const creators = await this.prisma.creatorPlatform.findMany({
      where: {
        platform: {
          in: SUPPORTED_CRAWLER_PLATFORMS,
        },
        followers: {
          gte: min,
          ...(max !== undefined ? { lte: max } : {}),
        },
      },
      select: {
        creatorId: true,
        platform: true,
      },
    });

    await Promise.all(
      creators.map((creator) =>
        this.crawlerQueue.enqueueRefresh(
          creator.creatorId,
          creator.platform as PlatformType,
        ),
      ),
    );
  }
}
