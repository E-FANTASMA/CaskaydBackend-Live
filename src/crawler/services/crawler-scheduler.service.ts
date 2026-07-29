import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly queueEnabled: boolean;
  private readonly crawlerEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crawlerQueue: CrawlerQueueService,
  ) {
    this.crawlerEnabled = this.configService.get<boolean>('CRAWLER_ENABLED') !== false;
    this.queueEnabled = this.crawlerQueue['queueService'].isEnabled();
  }

  @Cron('0 0 2 * * *')
  async scheduleDailyDiscovery() {
    if (!this.crawlerEnabled || !this.queueEnabled) {
      return;
    }

    await Promise.all(
      SUPPORTED_CRAWLER_PLATFORMS.map((platform) =>
        this.crawlerQueue.enqueueDiscovery(platform, [], 10),
      ),
    );
  }

  @Cron('0 0 3 * * *')
  async scheduleLargeCreatorRefresh() {
    if (!this.crawlerEnabled || !this.queueEnabled) {
      return;
    }

    await this.enqueueRefreshByTier(REFRESH_TIERS.LARGE);
  }

  @Cron('0 0 4 * * 1')
  async scheduleMediumCreatorRefresh() {
    if (!this.crawlerEnabled || !this.queueEnabled) {
      return;
    }

    await this.enqueueRefreshByTier(REFRESH_TIERS.MEDIUM);
  }

  @Cron('0 0 5 1 * *')
  async scheduleSmallCreatorRefresh() {
    if (!this.crawlerEnabled || !this.queueEnabled) {
      return;
    }

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
