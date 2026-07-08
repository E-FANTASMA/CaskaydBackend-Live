import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SavedCreatorsController } from './controllers/saved-creators.controller';
import { SavedCreatorsService } from './services/saved-creators.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [SavedCreatorsController],
  providers: [SavedCreatorsService],
  exports: [SavedCreatorsService],
})
export class SavedCreatorsModule {}
