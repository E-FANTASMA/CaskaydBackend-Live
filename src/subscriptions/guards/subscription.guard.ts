import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../services/subscriptions.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { sub: string } }>();
    if (!request.user) {
      return false;
    }

    if (this.configService.get<boolean>('PAYMENT_ENABLED') === false) {
      return true;
    }

    await this.subscriptionsService.ensureActiveSubscription(request.user.sub);
    return true;
  }
}
