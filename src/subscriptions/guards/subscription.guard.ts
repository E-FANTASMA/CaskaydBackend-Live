import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SubscriptionsService } from '../services/subscriptions.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { sub: string } }>();
    if (!request.user) {
      return false;
    }

    await this.subscriptionsService.ensureActiveSubscription(request.user.sub);
    return true;
  }
}
