import { Injectable } from '@nestjs/common';
import { CrawlerDatabaseUpdaterService } from './crawler-database-updater.service';
import { CrawlerDuplicateDetectorService } from './crawler-duplicate-detector.service';
import { CrawlerNormalizerService } from './crawler-normalizer.service';
import { CrawlerSearchTagGeneratorService } from './crawler-search-tag-generator.service';
import { CrawlerTaxonomyResolverService } from './crawler-taxonomy-resolver.service';
import { CreatorImportRecord } from '../interfaces/import-record.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';

@Injectable()
export class CrawlerPipelineService {
  constructor(
    private readonly normalizer: CrawlerNormalizerService,
    private readonly taxonomyResolver: CrawlerTaxonomyResolverService,
    private readonly searchTagGenerator: CrawlerSearchTagGeneratorService,
    private readonly duplicateDetector: CrawlerDuplicateDetectorService,
    private readonly databaseUpdater: CrawlerDatabaseUpdaterService,
  ) {}

  async ingest(
    rawProfile: Partial<NormalizedCreatorProfile> | CreatorImportRecord,
  ) {
    const profile = this.normalizer.normalize(rawProfile);
    const taxonomy = await this.taxonomyResolver.resolve(profile);
    const searchTags = this.searchTagGenerator.generate(profile, taxonomy);
    const duplicateMatch = await this.duplicateDetector.findMatch(profile);

    return this.databaseUpdater.persist({
      profile,
      taxonomy,
      searchTags,
      duplicateMatch,
    });
  }
}
