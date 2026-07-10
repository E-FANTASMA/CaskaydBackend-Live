import { Injectable } from '@nestjs/common';
import { PlatformType, Prisma } from '@prisma/client';
import { SearchFilters } from '../interfaces/search-filter.interface';

@Injectable()
export class QueryBuilderService {
  build(filters: SearchFilters): Prisma.CreatorWhereInput {
    const andFilters: Prisma.CreatorWhereInput[] = [];

    if (filters.niches.length) {
      andFilters.push({
        OR: [
          {
            primaryCategory: {
              name: {
                in: filters.niches,
                mode: 'insensitive',
              },
            },
          },
          {
            secondaryCategories: {
              some: {
                category: {
                  name: {
                    in: filters.niches,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
          {
            searchTags: {
              some: {
                tag: { in: filters.niches, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    if (
      filters.campaignIntent?.categoryIds.length ||
      filters.campaignIntent?.tags.length
    ) {
      andFilters.push({
        OR: [
          ...(filters.campaignIntent.categoryIds.length
            ? [
                {
                  primaryCategoryId: {
                    in: filters.campaignIntent.categoryIds,
                  },
                },
                {
                  secondaryCategories: {
                    some: {
                      categoryId: {
                        in: filters.campaignIntent.categoryIds,
                      },
                    },
                  },
                },
              ]
            : []),
          ...(filters.campaignIntent.tags.length
            ? [
                {
                  searchTags: {
                    some: {
                      tag: {
                        in: filters.campaignIntent.tags,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      });
    }

    if (filters.locations.length) {
      andFilters.push({
        OR: [
          { country: { in: filters.locations, mode: 'insensitive' } },
          { state: { in: filters.locations, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.gender) {
      andFilters.push({
        gender: { equals: filters.gender, mode: 'insensitive' },
      });
    }

    if (filters.platforms.length || filters.followers) {
      andFilters.push({
        platforms: {
          some: {
            ...(filters.platforms.length
              ? {
                  platform: {
                    in: filters.platforms.map((platform) =>
                      platform.toUpperCase(),
                    ) as PlatformType[],
                  },
                }
              : {}),
            ...(filters.followers?.min !== undefined
              ? { followers: { gte: filters.followers.min } }
              : {}),
            ...(filters.followers?.max !== undefined
              ? { followers: { lte: filters.followers.max } }
              : {}),
          },
        },
      });
    }

    return andFilters.length ? { AND: andFilters } : {};
  }

  buildLegacy(filters: SearchFilters): Prisma.CreatorWhereInput {
    const andFilters: Prisma.CreatorWhereInput[] = [];

    if (filters.niches.length) {
      andFilters.push({
        OR: [
          {
            primaryNiche: {
              in: filters.niches,
              mode: 'insensitive',
            },
          },
          {
            secondaryNiches: {
              hasSome: filters.niches,
            },
          },
          {
            searchTags: {
              some: {
                tag: { in: filters.niches, mode: 'insensitive' },
              },
            },
          },
        ],
      } as Prisma.CreatorWhereInput);
    }

    if (filters.locations.length) {
      andFilters.push({
        OR: [
          { country: { in: filters.locations, mode: 'insensitive' } },
          { state: { in: filters.locations, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.gender) {
      andFilters.push({
        gender: { equals: filters.gender, mode: 'insensitive' },
      });
    }

    if (filters.platforms.length || filters.followers) {
      andFilters.push({
        platforms: {
          some: {
            ...(filters.platforms.length
              ? {
                  platform: {
                    in: filters.platforms.map((platform) =>
                      platform.toUpperCase(),
                    ) as PlatformType[],
                  },
                }
              : {}),
            ...(filters.followers?.min !== undefined
              ? { followers: { gte: filters.followers.min } }
              : {}),
            ...(filters.followers?.max !== undefined
              ? { followers: { lte: filters.followers.max } }
              : {}),
          },
        },
      });
    }

    return andFilters.length ? { AND: andFilters } : {};
  }
}
