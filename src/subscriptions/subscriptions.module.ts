import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SubscriptionSchedulerService } from './services/subscription-scheduler.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [PaymentsModule, UsersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionSchedulerService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionSchedulerService, SubscriptionGuard],
})
export class SubscriptionsModule {}
