import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [PaymentsModule, UsersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
