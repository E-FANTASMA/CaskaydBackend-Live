import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InitializeSubscriptionDto } from '../dto/initialize-subscription.dto';
import { VerifySubscriptionDto } from '../dto/verify-subscription.dto';
import { SubscriptionsService } from '../services/subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  @UseGuards(JwtAuthGuard)
  getPlans() {
    if (this.configService.get<boolean>('PAYMENT_ENABLED') === false) {
      return [];
    }

    return this.subscriptionsService.getPlans();
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a subscription payment' })
  @UseGuards(JwtAuthGuard)
  initialize(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitializeSubscriptionDto,
  ) {
    return this.subscriptionsService.initialize(user.sub, dto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify Flutterwave payment and activate subscription' })
  @UseGuards(JwtAuthGuard)
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifySubscriptionDto,
  ) {
    return this.subscriptionsService.verify(user.sub, dto);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Verify Flutterwave payment and redirect to dashboard' })
  async callback(
    @Query('transaction_id') transactionId: string | undefined,
    @Query('tx_ref') reference: string | undefined,
    @Res() response: Response,
  ) {
    const dashboardUrl = this.configService.get<string>('FRONTEND_DASHBOARD_URL');
    if (!dashboardUrl) {
      throw new InternalServerErrorException('Frontend dashboard URL is not configured');
    }

    const redirectUrl = new URL(dashboardUrl);
    try {
      if (!transactionId) {
        throw new Error('Missing Flutterwave transaction id');
      }

      await this.subscriptionsService.verifyRedirect(transactionId, reference);
      redirectUrl.searchParams.set('payment', 'success');
    } catch (error) {
      redirectUrl.searchParams.set('payment', 'failed');
    }

    return response.redirect(redirectUrl.toString());
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel recurring subscription auto-renewal' })
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancel(user.sub);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription' })
  @UseGuards(JwtAuthGuard)
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getCurrentSubscription(user.sub);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Flutterwave subscription webhooks' })
  handleWebhook(
    @Headers('flutterwave-signature') signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    return this.subscriptionsService.handleWebhook(
      signature,
      request.rawBody ?? Buffer.from(JSON.stringify(payload)),
      payload,
    );
  }
}
