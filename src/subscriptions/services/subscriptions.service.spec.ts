import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PaymentsService } from '../../payments/services/payments.service';
import { UsersService } from '../../users/services/users.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: {
    subscription: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let paymentsService: jest.Mocked<PaymentsService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    prisma = {
      subscription: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    paymentsService = {
      ensureMonthlyPaymentPlan: jest.fn(),
      initializePayment: jest.fn(),
      verifyTransaction: jest.fn(),
      findSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;

    usersService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    service = new SubscriptionsService(
      prisma as never,
      paymentsService,
      usersService,
    );
  });

  it('initializes a recurring checkout with a Flutterwave payment plan', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Test User',
    } as never);
    paymentsService.ensureMonthlyPaymentPlan.mockResolvedValue(901);
    prisma.subscription.create.mockResolvedValue({
      id: 'sub-1',
    } as never);
    paymentsService.initializePayment.mockResolvedValue({
      link: 'https://pay.example.com',
      reference: 'caskayd-user-1-1',
    });

    const result = await service.initialize('user-1', {
      plan: SubscriptionPlan.INDIVIDUAL,
    });

    expect(paymentsService.ensureMonthlyPaymentPlan).toHaveBeenCalledWith({
      amount: 7500,
      name: 'Caskayd Individual Monthly',
    });
    expect(paymentsService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 7500,
        paymentPlanId: 901,
      }),
    );
    expect(result.paymentLink).toBe('https://pay.example.com');
  });

  it('cancels auto-renew without removing current access immediately', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        flutterwaveSubscriptionId: 55,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    ] as never);
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      autoRenew: false,
    } as never);

    await service.cancel('user-1');

    expect(paymentsService.cancelSubscription).toHaveBeenCalledWith(55);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          autoRenew: false,
        }),
      }),
    );
  });

  it('rejects webhook payloads with an invalid Flutterwave signature', async () => {
    paymentsService.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleWebhook(undefined, Buffer.from('{}'), {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when cancelling with no active subscription', async () => {
    prisma.subscription.findMany.mockResolvedValue([] as never);

    await expect(service.cancel('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cancels the live subscription even when a newer expired row exists', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'expired-newer',
        status: SubscriptionStatus.EXPIRED,
        autoRenew: false,
        flutterwaveSubscriptionId: null,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: 'active-older',
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        flutterwaveSubscriptionId: 91,
        expiresAt: futureDate,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ] as never);
    prisma.subscription.update.mockResolvedValue({
      id: 'active-older',
      autoRenew: false,
      cancelledAt: new Date(),
    } as never);

    await service.cancel('user-1');

    expect(paymentsService.cancelSubscription).toHaveBeenCalledWith(91);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'active-older' },
      }),
    );
  });

  it('returns the unexpired subscription even when a newer expired row exists', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'expired-newer',
        status: SubscriptionStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: 'active-older',
        status: SubscriptionStatus.ACTIVE,
        expiresAt: futureDate,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ] as never);

    const result = await service.getCurrentSubscription('user-1');

    expect(result).toMatchObject({
      id: 'active-older',
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureDate,
    });
  });

  it('restores access when an unexpired subscription was marked expired locally', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        status: SubscriptionStatus.EXPIRED,
        expiresAt: futureDate,
        createdAt: new Date(),
      },
    ] as never);
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureDate,
    } as never);

    const result = await service.ensureActiveSubscription('user-1');

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: SubscriptionStatus.ACTIVE },
    });
    expect(result).toMatchObject({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      expiresAt: futureDate,
    });
  });
});
