import { Injectable } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { BaseMockCrawlerWorker } from './base-mock-crawler.worker';

@Injectable()
export class InstagramCrawlerWorker extends BaseMockCrawlerWorker {
  readonly platform = PlatformType.INSTAGRAM;
}
