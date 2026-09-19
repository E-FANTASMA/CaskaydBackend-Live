import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreatorsController } from './controllers/creators.controller';
import { CreatorsService } from './services/creators.service';
import { CreatorAvatarSyncService } from './services/creator-avatar-sync.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, CreatorAvatarSyncService],
  exports: [CreatorsService, CreatorAvatarSyncService],
})
export class CreatorsModule {}
