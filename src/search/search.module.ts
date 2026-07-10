import { Module } from '@nestjs/common';
import { CampaignIntentsModule } from '../campaign-intents/campaign-intents.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SearchController } from './controllers/search.controller';
import { CampaignIntentResolverService } from './services/campaign-intent-resolver.service';
import { DictionaryParser } from './services/dictionary-parser.service';
import { QueryBuilderService } from './services/query-builder.service';
import { RankingService } from './services/ranking.service';
import { RegexParser } from './services/regex-parser.service';
import { SearchService } from './services/search.service';
import { TokenizerService } from './services/tokenizer.service';

@Module({
  imports: [SubscriptionsModule, CampaignIntentsModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    TokenizerService,
    DictionaryParser,
    RegexParser,
    CampaignIntentResolverService,
    QueryBuilderService,
    RankingService,
  ],
})
export class SearchModule {}
