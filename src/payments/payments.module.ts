import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [UsersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentMethodService],
  exports: [PaymentsService, PaymentMethodService],
})
export class PaymentsModule {}
