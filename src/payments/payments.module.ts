import { Module } from '@nestjs/common';
import { PaymentsService } from './services/payments.service';

@Module({
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
