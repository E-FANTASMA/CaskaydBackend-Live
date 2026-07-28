import { Injectable } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { BaseMockCrawlerWorker } from './base-mock-crawler.worker';

@Injectable()
export class YouTubeCrawlerWorker extends BaseMockCrawlerWorker {
  readonly platform = PlatformType.YOUTUBE;
}
