import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../../users/services/users.service';
import { InitializePaymentDto } from '../dto/initialize-payment.dto';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { PaymentMethodService } from '../services/payment-method.service';
import { PaymentsService } from '../services/payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly usersService: UsersService,
  ) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize Flutterwave card payment' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async initializePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitializePaymentDto,
  ) {
    const dbUser = await this.usersService.findById(user.sub);
    if (!dbUser) {
      throw new BadRequestException('User not found');
    }

    const amount = dto.amount ?? 2000;
    const reference = `caskayd-pay-${user.sub}-${Date.now()}`;
    const title = dto.title ?? 'Caskayd Card Payment';

    const payment = await this.paymentsService.initializePayment({
      amount,
      email: dbUser.email,
      fullName: dbUser.fullName,
      reference,
      title,
    });

    return {
      status: 'success',
      amount,
      currency: 'NGN',
      paymentUrl: payment.link,
      reference: payment.reference,
    };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify Flutterwave payment (GET query format)' })
  @ApiQuery({ name: 'transaction_id', required: false })
  @ApiQuery({ name: 'tx_ref', required: false })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async verifyPaymentGet(
    @CurrentUser() user: AuthenticatedUser,
    @Query('transaction_id') queryTxId?: string,
    @Query('tx_ref') queryTxRef?: string,
  ) {
    const txId = queryTxId || queryTxRef;
    if (!txId) {
      throw new BadRequestException('transaction_id or tx_ref query parameter is required');
    }
    return this.processVerification(user.sub, txId);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify Flutterwave payment (POST body format)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async verifyPaymentPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.processVerification(user.sub, dto.transaction_id);
  }

  @Get('methods')
  @ApiOperation({ summary: 'List saved card payment methods for current user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getPaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentMethodService.getUserPaymentMethods(user.sub);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Flutterwave payment webhooks' })
  async handleWebhook(
    @Headers('flutterwave-signature') signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    const isValid = this.paymentsService.verifyWebhookSignature(
      request.rawBody ?? Buffer.from(JSON.stringify(payload)),
      signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const data = typeof payload.data === 'object' && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : null;

    if (data && data.status === 'successful' && data.card) {
      const email = (data.customer as Record<string, unknown>)?.email as string;
      if (email) {
        const user = await this.usersService.findByEmail(email);
        if (user) {
          await this.paymentMethodService.saveCardToken(
            user.id,
            data.card as any,
          );
        }
      }
    }

    return { received: true };
  }

  private async processVerification(userId: string, transactionId: string) {
    const verification = await this.paymentsService.verifyTransaction(transactionId);

    if (verification.status !== 'successful') {
      throw new BadRequestException('Payment verification failed or transaction not successful');
    }

    if (verification.currency && verification.currency !== 'NGN') {
      throw new BadRequestException('Invalid payment currency, expected NGN');
    }

    let savedPaymentMethod: any = null;
    if (verification.card && verification.card.token) {
      savedPaymentMethod = await this.paymentMethodService.saveCardToken(
        userId,
        verification.card,
      );
    }

    return {
      status: 'successful',
      transactionId: verification.id ?? transactionId,
      reference: verification.tx_ref,
      amount: verification.amount,
      currency: verification.currency,
      paymentMethod: savedPaymentMethod
        ? {
            id: savedPaymentMethod.id,
            last4: savedPaymentMethod.last4,
            cardType: savedPaymentMethod.cardType,
            expiryMonth: savedPaymentMethod.expiryMonth,
            expiryYear: savedPaymentMethod.expiryYear,
          }
        : null,
    };
  }
}
