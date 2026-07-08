import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CampaignNotesController } from './controllers/campaign-notes.controller';
import { CampaignsController } from './controllers/campaigns.controller';
import { CampaignsService } from './services/campaigns.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CampaignsController, CampaignNotesController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
