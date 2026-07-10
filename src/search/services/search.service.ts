import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  creatorRelationsInclude,
  serializeCreator,
} from '../../creators/creator-response.util';
import { CampaignIntentResolverService } from './campaign-intent-resolver.service';
import { DictionaryParser } from './dictionary-parser.service';
import { QueryBuilderService } from './query-builder.service';
import { RankingService } from './ranking.service';
import { RegexParser } from './regex-parser.service';
import { TokenizerService } from './tokenizer.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenizer: TokenizerService,
    private readonly dictionaryParser: DictionaryParser,
    private readonly regexParser: RegexParser,
    private readonly campaignIntentResolver: CampaignIntentResolverService,
    private readonly queryBuilder: QueryBuilderService,
    private readonly rankingService: RankingService,
  ) {}

  async search(query: string) {
    const tokens = this.tokenizer.tokenize(query);
    const parsedFilters = this.dictionaryParser.parse(tokens);
    const followers = this.regexParser.parse(query);
    const campaignIntent = await this.campaignIntentResolver.resolve({
      query,
      tokens,
    });
    const filters = {
      ...parsedFilters,
      followers,
      campaignIntent,
    };

    try {
      const prismaQuery = this.queryBuilder.build(filters);
      const creators = await this.prisma.creator.findMany({
        where: prismaQuery,
        include: creatorRelationsInclude,
      });

      return this.rankingService.rank(creators, filters).map((result) => ({
        ...result,
        creator: serializeCreator(result.creator),
      }));
    } catch (error) {
      if (!this.isMissingTaxonomySchemaError(error)) {
        throw error;
      }

      const legacyQuery = this.queryBuilder.buildLegacy(filters);
      const creators = await this.prisma.creator.findMany({
        where: legacyQuery,
        include: {
          platforms: true,
          searchTags: true,
        },
      });

      return this.rankingService.rankLegacy(creators, filters);
    }
  }

  private isMissingTaxonomySchemaError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2021', 'P2022'].includes(error.code)
    );
  }
}
