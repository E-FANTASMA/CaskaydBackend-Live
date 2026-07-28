import { Injectable } from '@nestjs/common';
import { TaxonomyResolution } from '../interfaces/taxonomy-resolution.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';

@Injectable()
export class CrawlerSearchTagGeneratorService {
  generate(profile: NormalizedCreatorProfile, taxonomy: TaxonomyResolution) {
    const tags = new Set<string>();
    const add = (value?: string | null) => {
      if (!value) {
        return;
      }

      const normalized = value.trim().toLowerCase();
      if (normalized) {
        tags.add(normalized);
      }
    };

    add(profile.name);
    add(profile.displayName);
    add(profile.username);
    add(profile.website);
    add(profile.location);
    add(taxonomy.primaryCategory.name);
    taxonomy.secondaryCategories.forEach((category) => add(category.name));
    profile.keywords.forEach((keyword) => add(keyword));

    for (const source of [profile.bio, profile.displayName, profile.name]) {
      if (!source) {
        continue;
      }

      for (const part of source.toLowerCase().split(/[^a-z0-9]+/)) {
        if (part.length >= 3) {
          tags.add(part);
        }
      }
    }

    return [...tags];
  }
}
