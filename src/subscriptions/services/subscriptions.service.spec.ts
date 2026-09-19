import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PaymentMethodService } from '../../payments/services/payment-method.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { UsersService } from '../../users/services/users.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: {
    subscription: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let paymentsService: jest.Mocked<PaymentsService>;
  let paymentMethodService: jest.Mocked<PaymentMethodService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    prisma = {
      subscription: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    paymentsService = {
      ensureMonthlyPaymentPlan: jest.fn(),
      initializePayment: jest.fn(),
      verifyTransaction: jest.fn(),
      chargeToken: jest.fn(),
      findSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;

    paymentMethodService = {
      saveCardToken: jest.fn(),
      getDefaultPaymentMethod: jest.fn(),
      getUserPaymentMethods: jest.fn(),
    } as unknown as jest.Mocked<PaymentMethodService>;

    usersService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    service = new SubscriptionsService(
      prisma as never,
      paymentsService,
      paymentMethodService,
      usersService,
    );
  });

  it('initializes a recurring checkout with 2000 NGN amount', async () => {
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
      amount: 2000,
      name: 'Caskayd Individual Monthly',
    });
    expect(paymentsService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        paymentPlanId: 901,
      }),
    );
    expect(result.paymentLink).toBe('https://pay.example.com');
  });

  it('verifies payment and saves card token if returned by Flutterwave', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    } as never);

    paymentsService.verifyTransaction.mockResolvedValue({
      status: 'successful',
      tx_ref: 'caskayd-ref-1',
      id: 'tx-100',
      amount: 2000,
      currency: 'NGN',
      card: {
        token: 'flw-card-token-123',
        last_4digits: '4242',
        type: 'VISA',
      },
    });

    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.INDIVIDUAL,
      flutterwavePaymentPlanId: 901,
    } as never);

    paymentMethodService.saveCardToken.mockResolvedValue({
      id: 'pm-1',
      userId: 'user-1',
      token: 'flw-card-token-123',
    } as never);

    paymentsService.findSubscription.mockResolvedValue({
      id: 555,
      plan: 901,
    });

    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      paymentMethodId: 'pm-1',
    } as never);

    const result = await service.verify('user-1', { transactionId: 'tx-100' });

    expect(paymentMethodService.saveCardToken).toHaveBeenCalledWith('user-1', {
      token: 'flw-card-token-123',
      last_4digits: '4242',
      type: 'VISA',
    });
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('renews subscription using saved card token', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.INDIVIDUAL,
      expiresAt: new Date(),
      user: { email: 'user@example.com', fullName: 'Jane Doe' },
      paymentMethod: { id: 'pm-1', token: 'saved-card-token' },
    } as never);

    paymentsService.chargeToken.mockResolvedValue({
      status: 'success',
      data: {
        id: 9999,
        status: 'successful',
        amount: 2000,
      },
    });

    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
    } as never);

    const result = await service.renewSubscriptionWithToken('sub-1');

    expect(paymentsService.chargeToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'saved-card-token',
        amount: 2000,
        currency: 'NGN',
        email: 'user@example.com',
      }),
    );
    expect(result.success).toBe(true);
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

  it('activates an initial subscription from a successful charge webhook', async () => {
    paymentsService.verifyWebhookSignature.mockReturnValue(true);
    paymentsService.findSubscription.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.INDIVIDUAL,
      status: SubscriptionStatus.PENDING,
      expiresAt: null,
      paymentMethodId: null,
      flutterwavePaymentPlanId: 901,
      flutterwaveSubscriptionId: null,
    } as never);
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
    } as never);

    await service.handleWebhook(
      'valid-signature',
      Buffer.from('{}'),
      {
        type: 'charge.completed',
        data: {
          id: 100,
          status: 'successful',
          tx_ref: 'caskayd-user-1-1',
          payment_plan: 901,
        },
      },
    );

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          autoRenew: true,
          flutterwaveTransactionId: '100',
        }),
      }),
    );
  });

  it('throws when cancelling with no active subscription', async () => {
    prisma.subscription.findMany.mockResolvedValue([] as never);

    await expect(service.cancel('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
