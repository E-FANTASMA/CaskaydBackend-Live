import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';
import { CrawlerController } from './controllers/crawler.controller';
import { CRAWLER_WORKER_TOKEN } from './constants/crawler.constants';
import { CrawlerDiscoveryService } from './services/crawler-discovery.service';
import { CrawlerDatabaseUpdaterService } from './services/crawler-database-updater.service';
import { CrawlerDuplicateDetectorService } from './services/crawler-duplicate-detector.service';
import { CrawlerImporterService } from './services/crawler-importer.service';
import { CrawlerNormalizerService } from './services/crawler-normalizer.service';
import { CrawlerPipelineService } from './services/crawler-pipeline.service';
import { CrawlerPlatformRegistryService } from './services/crawler-platform-registry.service';
import { CrawlerQueueProcessorService } from './services/crawler-queue-processor.service';
import { CrawlerQueueService } from './services/crawler-queue.service';
import { CrawlerSchedulerService } from './services/crawler-scheduler.service';
import { CrawlerSearchTagGeneratorService } from './services/crawler-search-tag-generator.service';
import { CrawlerTaxonomyResolverService } from './services/crawler-taxonomy-resolver.service';
import { InstagramCrawlerWorker } from './workers/instagram-crawler.worker';
import { TikTokCrawlerWorker } from './workers/tiktok-crawler.worker';
import { XCrawlerWorker } from './workers/x-crawler.worker';
import { YouTubeCrawlerWorker } from './workers/youtube-crawler.worker';

const crawlerWorkers = [
  InstagramCrawlerWorker,
  TikTokCrawlerWorker,
  YouTubeCrawlerWorker,
  XCrawlerWorker,
];

@Module({
  imports: [CommonModule, ScheduleModule],
  controllers: [CrawlerController],
  providers: [
    ...crawlerWorkers,
    {
      provide: CRAWLER_WORKER_TOKEN,
      useFactory: (
        instagram: InstagramCrawlerWorker,
        tiktok: TikTokCrawlerWorker,
        youtube: YouTubeCrawlerWorker,
        x: XCrawlerWorker,
      ) => [instagram, tiktok, youtube, x],
      inject: crawlerWorkers,
    },
    CrawlerNormalizerService,
    CrawlerTaxonomyResolverService,
    CrawlerSearchTagGeneratorService,
    CrawlerDuplicateDetectorService,
    CrawlerDatabaseUpdaterService,
    CrawlerPipelineService,
    CrawlerPlatformRegistryService,
    CrawlerDiscoveryService,
    CrawlerQueueService,
    CrawlerSchedulerService,
    CrawlerQueueProcessorService,
    CrawlerImporterService,
  ],
  exports: [CrawlerImporterService, CrawlerPipelineService, CrawlerQueueService],
})
export class CrawlerModule {}
