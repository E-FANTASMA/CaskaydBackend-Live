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
}

export interface SearchResultWithScore {
  score: number;
  creator: Prisma.CreatorGetPayload<{
    include: { platforms: true; searchTags: true };
  }>;
}
