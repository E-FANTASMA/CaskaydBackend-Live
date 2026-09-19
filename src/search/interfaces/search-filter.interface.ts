import { Prisma } from '@prisma/client';

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface SearchFilters {
  tokens: string[];
  niches: string[];
  locations: string[];
  gender?: string;
  platforms: string[];
  followers?: NumericRange;
  campaignIntent?: {
    id: string;
    name: string;
    slug: string;
    categoryIds: string[];
    categoryNames: string[];
    tags: string[];
  };
}

export interface SearchResultWithScore {
  score: number;
  creator: Prisma.CreatorGetPayload<{
    include: {
      primaryCategory: true;
      secondaryCategories: { include: { category: true } };
      platforms: true;
      searchTags: true;
    };
  }>;
}
