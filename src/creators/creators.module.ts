import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreatorsController } from './controllers/creators.controller';
import { CreatorsService } from './services/creators.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
