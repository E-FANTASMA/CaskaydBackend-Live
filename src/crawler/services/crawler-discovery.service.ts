import { Injectable } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { CrawlerPlatformRegistryService } from './crawler-platform-registry.service';

@Injectable()
export class CrawlerDiscoveryService {
  constructor(
    private readonly platformRegistry: CrawlerPlatformRegistryService,
  ) {}

  discoverCreators(platform: PlatformType, keywords?: string[], limit?: number) {
    return this.platformRegistry
      .getWorker(platform)
      .discoverCreators({ platform, keywords, limit });
  }
}
