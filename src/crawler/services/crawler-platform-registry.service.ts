import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { CRAWLER_WORKER_TOKEN } from '../constants/crawler.constants';
import { CrawlerWorker } from '../interfaces/crawler-worker.interface';

@Injectable()
export class CrawlerPlatformRegistryService {
  constructor(
    @Inject(CRAWLER_WORKER_TOKEN)
    private readonly workers: CrawlerWorker[],
  ) {}

  getWorker(platform: PlatformType) {
    const worker = this.workers.find((candidate) => candidate.platform === platform);
    if (!worker) {
      throw new NotFoundException(`No crawler worker registered for platform ${platform}`);
    }

    return worker;
  }
}
