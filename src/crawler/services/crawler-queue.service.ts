import { Injectable } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { JobsOptions } from 'bullmq';
import {
  CRAWLER_DISCOVERY_JOB,
  CRAWLER_QUEUE_NAME,
  CRAWLER_REFRESH_JOB,
} from '../constants/crawler.constants';
import { QueueService } from '../../common/services/queue.service';

@Injectable()
export class CrawlerQueueService {
  constructor(private readonly queueService: QueueService) {}

  async enqueueDiscovery(
    platform: PlatformType,
    keywords?: string[],
    limit = 25,
    options?: JobsOptions,
  ) {
    return this.queueService.getQueue(CRAWLER_QUEUE_NAME).add(
      CRAWLER_DISCOVERY_JOB,
      {
        platform,
        keywords,
        limit,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
        ...options,
      },
    );
  }

  async enqueueRefresh(creatorId: string, platform: PlatformType, options?: JobsOptions) {
    return this.queueService.getQueue(CRAWLER_QUEUE_NAME).add(
      CRAWLER_REFRESH_JOB,
      {
        creatorId,
        platform,
      },
      {
        jobId: `${platform}:${creatorId}`,
        removeOnComplete: 100,
        removeOnFail: 100,
        ...options,
      },
    );
  }
}
