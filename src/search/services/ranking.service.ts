import { Injectable } from "@nestjs/common";
import { SearchFilters, SearchResultWithScore } from "../interfaces/search-filter.interface";

@Injectable()
export class RankingService {
  rank(creators: SearchResultWithScore["creator"][], filters: SearchFilters) {
    return creators
      .map((creator) => ({
        creator,
        score: this.scoreCreator(creator, filters),
      }))
      .sort((a, b) => b.score - a.score);
  }

  rankLegacy(creators: any[], filters: SearchFilters) {
    return creators
      .map((creator) => ({
        creator,
        score: this.scoreLegacyCreator(creator, filters),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private scoreCreator(
    creator: SearchResultWithScore["creator"],
    filters: SearchFilters,
  ) {
    let score = 0;

    if (filters.tokens && filters.tokens.length > 0) {
      score += this.scoreTextRelevance(creator, filters.tokens);
    }

    if (
      creator.primaryCategory &&
      filters.niches.some(
        (niche) =>
          niche.toLowerCase() === creator.primaryCategory!.name.toLowerCase(),
      )
    ) {
      score += 50;
    }

    if (
      filters.niches.some((niche) =>
        creator.secondaryCategories.some(
          ({ category }) => category.name.toLowerCase() === niche.toLowerCase(),
        ),
      )
    ) {
      score += 25;
    }

    if (
      filters.campaignIntent?.categoryIds.some(
        (categoryId) => categoryId === creator.primaryCategoryId,
      )
    ) {
      score += 20;
    }

    if (
      filters.campaignIntent?.categoryIds.some((categoryId) =>
        creator.secondaryCategories.some(
          (secondaryCategory) => secondaryCategory.categoryId === categoryId,
        ),
      )
    ) {
      score += 20;
    }

    if (
      [
        ...filters.niches,
        ...(filters.campaignIntent?.tags ?? []),
        ...(filters.campaignIntent?.categoryNames ?? []),
      ].some((term) =>
        creator.searchTags.some(
          (searchTag) => searchTag.tag.toLowerCase() === term.toLowerCase(),
        ),
      )
    ) {
      score += 15;
    }

    if (
      filters.locations.some((location) =>
        [creator.country, creator.state]
          .filter(Boolean)
          .some((value) => value!.toLowerCase() === location.toLowerCase()),
      )
    ) {
      score += 10;
    }

    if (
      filters.gender &&
      creator.gender?.toLowerCase() === filters.gender.toLowerCase()
    ) {
      score += 5;
    }

    if (creator.platforms && creator.platforms.some((platform) => platform.verified)) {
      score += 5;
    }

    return score;
  }

  private scoreLegacyCreator(creator: any, filters: SearchFilters) {
    let score = 0;

    if (filters.tokens && filters.tokens.length > 0) {
      score += this.scoreTextRelevance(creator, filters.tokens);
    }

    if (
      filters.niches.some(
        (niche) => niche.toLowerCase() === creator.primaryNiche?.toLowerCase(),
      )
    ) {
      score += 20;
    }

    if (
      filters.niches.some((niche) =>
        (creator.secondaryNiches ?? []).some(
          (secondaryNiche: string) =>
            secondaryNiche.toLowerCase() === niche.toLowerCase(),
        ),
      )
    ) {
      score += 10;
    }

    if (
      filters.locations.some((location) =>
        [creator.country, creator.state]
          .filter(Boolean)
          .some((value) => value!.toLowerCase() === location.toLowerCase()),
      )
    ) {
      score += 10;
    }

    if (
      filters.gender &&
      creator.gender?.toLowerCase() === filters.gender.toLowerCase()
    ) {
      score += 5;
    }

    if (creator.platforms && creator.platforms.some((platform: any) => platform.verified)) {
      score += 5;
    }

    return score;
  }

  private scoreTextRelevance(creator: any, tokens: string[]): number {
    let score = 0;
    const fullQuery = tokens.join(" ").toLowerCase().trim();
    const cleanQuery = fullQuery.replace(/^@/, "");

    const name = (creator.name || "").toLowerCase().trim();

    if (name === fullQuery || name === cleanQuery) {
      score += 1000;
    } else if (cleanQuery && name.includes(cleanQuery)) {
      score += 500;
    }

    if (creator.platforms && Array.isArray(creator.platforms)) {
      for (const p of creator.platforms) {
        const handle = (p.handle || "").toLowerCase().trim();
        const cleanHandle = handle.replace(/^@/, "");

        if (cleanHandle === cleanQuery || handle === fullQuery) {
          score += 1000;
        } else if (cleanQuery && cleanHandle.includes(cleanQuery)) {
          score += 500;
        }
      }
    }

    for (const token of tokens) {
      const cleanToken = token.replace(/^@/, "").toLowerCase().trim();
      if (!cleanToken) continue;

      if (name.includes(cleanToken)) {
        score += 250;
      }

      if (creator.platforms && Array.isArray(creator.platforms)) {
        for (const p of creator.platforms) {
          const cleanHandle = (p.handle || "").replace(/^@/, "").toLowerCase().trim();
          if (cleanHandle.includes(cleanToken)) {
            score += 250;
          }
        }
      }
    }

    return score;
  }
}
