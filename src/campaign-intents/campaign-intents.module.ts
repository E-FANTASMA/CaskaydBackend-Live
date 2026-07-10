import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CampaignIntentsController } from './controllers/campaign-intents.controller';
import { CampaignIntentsService } from './services/campaign-intents.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CampaignIntentsController],
  providers: [CampaignIntentsService],
  exports: [CampaignIntentsService],
})
export class CampaignIntentsModule {}
