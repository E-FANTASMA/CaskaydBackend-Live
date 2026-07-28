import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  @UseGuards(JwtAuthGuard)
  getPlans() {
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
