import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionsService } from '../services/subscriptions.service';

describe('SubscriptionGuard', () => {
  const request = { user: { sub: 'user-1' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  it('allows authenticated users through when payments are disabled', async () => {
    const ensureActiveSubscription = jest.fn();
    const subscriptionsService = {
      ensureActiveSubscription,
    } as unknown as SubscriptionsService;
    const configService = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    const guard = new SubscriptionGuard(subscriptionsService, configService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(ensureActiveSubscription).not.toHaveBeenCalled();
  });

  it('requires an active subscription when payments are enabled', async () => {
    const ensureActiveSubscription = jest
      .fn()
      .mockResolvedValue({ id: 'sub-1' });
    const subscriptionsService = {
      ensureActiveSubscription,
    } as unknown as SubscriptionsService;
    const configService = {
      get: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const guard = new SubscriptionGuard(subscriptionsService, configService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(ensureActiveSubscription).toHaveBeenCalledWith('user-1');
  });
});
