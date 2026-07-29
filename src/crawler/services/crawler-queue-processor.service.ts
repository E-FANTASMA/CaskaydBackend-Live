import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  CRAWLER_DISCOVERY_JOB,
  CRAWLER_QUEUE_NAME,
  CRAWLER_REFRESH_JOB,
} from '../constants/crawler.constants';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerDiscoveryService } from './crawler-discovery.service';
import { CrawlerPipelineService } from './crawler-pipeline.service';
import { CrawlerPlatformRegistryService } from './crawler-platform-registry.service';
import { DiscoveryJobPayload, RefreshJobPayload } from '../interfaces/crawler-queue-job.interface';

@Injectable()
export class CrawlerQueueProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlerQueueProcessorService.name);
  private worker?: Worker;
  private readonly redisEnabled: boolean;
  private readonly crawlerEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly discoveryService: CrawlerDiscoveryService,
    private readonly platformRegistry: CrawlerPlatformRegistryService,
    private readonly pipeline: CrawlerPipelineService,
  ) {
    this.crawlerEnabled =
      this.configService.get<boolean>('CRAWLER_ENABLED') !== false;
    this.redisEnabled = Boolean(
      this.configService.get<string>('REDIS_HOST')?.trim(),
    );
  }

  onModuleInit() {
    if (!this.crawlerEnabled) {
      this.logger.log('Crawler queue processor is disabled because CRAWLER_ENABLED is false');
      return;
    }

    if (!this.redisEnabled) {
      this.logger.log('Crawler queue processor is disabled because REDIS_HOST is not configured');
      return;
    }

    this.worker = new Worker(
      CRAWLER_QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: {
          host: this.configService.getOrThrow<string>('REDIS_HOST'),
          port: this.configService.getOrThrow<number>('REDIS_PORT'),
          password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
          db: this.configService.getOrThrow<number>('REDIS_DB'),
        },
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Crawler job ${job?.name ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processJob(job: Job) {
    if (job.name === CRAWLER_DISCOVERY_JOB) {
      const payload = job.data as DiscoveryJobPayload;
      const profiles = await this.discoveryService.discoverCreators(
        payload.platform,
        payload.keywords,
        payload.limit,
      );

      for (const profile of profiles) {
        await this.pipeline.ingest(profile);
      }

      return { processed: profiles.length };
    }

    if (job.name === CRAWLER_REFRESH_JOB) {
      const payload = job.data as RefreshJobPayload;
      const creatorPlatform = await this.prisma.creatorPlatform.findFirstOrThrow({
        where: {
          creatorId: payload.creatorId,
          platform: payload.platform,
        },
      });

      const profile = await this.platformRegistry.getWorker(payload.platform).refreshCreator({
        creatorId: payload.creatorId,
        platform: payload.platform,
        username: creatorPlatform.handle,
        externalUrl: creatorPlatform.profileUrl,
      });

      await this.pipeline.ingest(profile);
      return { processed: 1 };
    }

    throw new Error(`Unsupported crawler job ${job.name}`);
  }
}
