import { Module } from '@nestjs/common';
import { CampaignIntentsModule } from './campaign-intents/campaign-intents.module';
import { CategoriesModule } from './categories/categories.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CommonModule } from './common/common.module';
import { configValidationSchema } from './config/config.validation';
import { CrawlerModule } from './crawler/crawler.module';
import { CreatorsModule } from './creators/creators.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { SavedCreatorsModule } from './saved-creators/saved-creators.module';
import { SearchModule } from './search/search.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30,
      },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    PaymentsModule,
    SubscriptionsModule,
    CategoriesModule,
    CampaignIntentsModule,
    CrawlerModule,
    CreatorsModule,
    SearchModule,
    CampaignsModule,
    SavedCreatorsModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
