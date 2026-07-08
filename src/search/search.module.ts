import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SearchController } from './controllers/search.controller';
import { DictionaryParser } from './services/dictionary-parser.service';
import { QueryBuilderService } from './services/query-builder.service';
import { RankingService } from './services/ranking.service';
import { RegexParser } from './services/regex-parser.service';
import { SearchService } from './services/search.service';
import { TokenizerService } from './services/tokenizer.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    TokenizerService,
    DictionaryParser,
    RegexParser,
    QueryBuilderService,
    RankingService,
  ],
})
export class SearchModule {}
