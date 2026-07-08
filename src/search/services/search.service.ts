import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
    private readonly queryBuilder: QueryBuilderService,
    private readonly rankingService: RankingService,
  ) {}

  async search(query: string) {
    const tokens = this.tokenizer.tokenize(query);
    const parsedFilters = this.dictionaryParser.parse(tokens);
    const followers = this.regexParser.parse(query);
    const filters = {
      ...parsedFilters,
      followers,
    };

    const prismaQuery = this.queryBuilder.build(filters);
    const creators = await this.prisma.creator.findMany({
      where: prismaQuery,
      include: {
        platforms: true,
        searchTags: true,
      },
    });

    return this.rankingService.rank(creators, filters);
  }
}
