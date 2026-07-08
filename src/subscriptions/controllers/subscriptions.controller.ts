import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InitializeSubscriptionDto } from '../dto/initialize-subscription.dto';
import { VerifySubscriptionDto } from '../dto/verify-subscription.dto';
import { SubscriptionsService } from '../services/subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a subscription payment' })
  initialize(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitializeSubscriptionDto,
  ) {
    return this.subscriptionsService.initialize(user.sub, dto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify Flutterwave payment and activate subscription' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifySubscriptionDto,
  ) {
    return this.subscriptionsService.verify(user.sub, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription' })
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getCurrentSubscription(user.sub);
  }
}
