import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
