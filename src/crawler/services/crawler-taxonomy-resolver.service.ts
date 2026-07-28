import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { slugifyCategoryName } from '../../categories/utils/slugify.util';
import { PrismaService } from '../../database/prisma.service';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';
import { TaxonomyResolution } from '../interfaces/taxonomy-resolution.interface';

interface ScoredCategory {
  category: Category;
  score: number;
}

@Injectable()
export class CrawlerTaxonomyResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(profile: NormalizedCreatorProfile): Promise<TaxonomyResolution> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    if (!categories.length) {
      throw new NotFoundException('No taxonomy categories available for crawler resolution');
    }

    const scored = this.scoreCategories(categories, profile);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const rootsByCategoryId = new Map<string, Category>();
    for (const category of categories) {
      rootsByCategoryId.set(category.id, this.findRootCategory(category, categoriesById));
    }

    const primaryCategory = this.resolvePrimaryCategory(
      scored,
      rootsByCategoryId,
      categories,
    );

    const secondaryCategories = scored
      .filter(
        ({ category, score }) =>
          score > 0 &&
          category.id !== primaryCategory.id &&
          rootsByCategoryId.get(category.id)?.id === primaryCategory.id,
      )
      .sort((left, right) =>
        right.score - left.score || left.category.name.localeCompare(right.category.name),
      )
      .slice(0, 5)
      .map(({ category }) => category);

    return {
      primaryCategoryId: primaryCategory.id,
      primaryCategory,
      secondaryCategoryIds: secondaryCategories.map((category) => category.id),
      secondaryCategories,
    };
  }

  private scoreCategories(categories: Category[], profile: NormalizedCreatorProfile) {
    const text = [
      profile.bio,
      profile.displayName,
      profile.name,
      profile.username,
      profile.website,
      profile.location,
      ...profile.keywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const tokens = new Set(this.tokenize(text));

    return categories.map((category) => {
      const categoryTokens = this.tokenize(
        [category.name, category.slug, category.description].filter(Boolean).join(' '),
      );
      const phrasePatterns = new Set<string>([
        category.name.toLowerCase(),
        category.slug.toLowerCase().replace(/-/g, ' '),
      ]);

      let score = 0;

      for (const phrase of phrasePatterns) {
        if (phrase && text.includes(phrase)) {
          score += 10;
        }
      }

      for (const token of categoryTokens) {
        if (tokens.has(token)) {
          score += 3;
        }
      }

      return {
        category,
        score,
      };
    });
  }

  private resolvePrimaryCategory(
    scored: ScoredCategory[],
    rootsByCategoryId: Map<string, Category>,
    categories: Category[],
  ) {
    const rootScoreMap = new Map<string, number>();

    for (const item of scored) {
      const root = rootsByCategoryId.get(item.category.id);
      if (!root) {
        continue;
      }

      rootScoreMap.set(root.id, (rootScoreMap.get(root.id) ?? 0) + item.score);
    }

    const rankedRoots = categories
      .filter((category) => !category.parentId)
      .map((category) => ({
        category,
        score: rootScoreMap.get(category.id) ?? 0,
      }))
      .sort(
        (left, right) =>
          right.score - left.score || left.category.name.localeCompare(right.category.name),
      );

    const winner = rankedRoots.find(({ score }) => score > 0)?.category;
    if (winner) {
      return winner;
    }

    const fallback = categories.find(
      (category) => category.slug === 'unspecified' || category.name.toLowerCase() === 'unspecified',
    );
    if (fallback) {
      return fallback;
    }

    throw new NotFoundException(
      'Crawler taxonomy resolution could not match an existing category',
    );
  }

  private findRootCategory(category: Category, categoriesById: Map<string, Category>) {
    let current = category;
    while (current.parentId) {
      current = categoriesById.get(current.parentId) ?? current;
      if (!current.parentId) {
        break;
      }
    }

    return current;
  }

  private tokenize(text: string) {
    return slugifyCategoryName(text)
      .split('-')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }
}
