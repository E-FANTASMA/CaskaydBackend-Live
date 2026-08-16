import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { UsersService } from '../../users/services/users.service';
import { InitializeSubscriptionDto } from '../dto/initialize-subscription.dto';
import { VerifySubscriptionDto } from '../dto/verify-subscription.dto';

const PLAN_CONFIG: Record<SubscriptionPlan, { amount: number; durationDays: number }> =
  {
    INDIVIDUAL: { amount: 7500, durationDays: 30 },
    TEAM: { amount: 25000, durationDays: 30 },
  };

const PLAN_DISPLAY_NAME: Record<SubscriptionPlan, string> = {
  INDIVIDUAL: 'Caskayd Individual Monthly',
  TEAM: 'Caskayd Team Monthly',
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) {}

  getPlans() {
    return Object.entries(PLAN_CONFIG).map(([plan, config]) => ({
      plan,
      ...config,
    }));
  }

  async initialize(userId: string, dto: InitializeSubscriptionDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const paymentPlanId = await this.paymentsService.ensureMonthlyPaymentPlan({
      amount: PLAN_CONFIG[dto.plan].amount,
      name: PLAN_DISPLAY_NAME[dto.plan],
    });
    const reference = `caskayd-${userId}-${Date.now()}`;
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        plan: dto.plan,
        status: SubscriptionStatus.PENDING,
        autoRenew: false,
        flutterwaveReference: reference,
        flutterwavePaymentPlanId: paymentPlanId,
      },
    });

    const payment = await this.paymentsService.initializePayment({
      amount: PLAN_CONFIG[dto.plan].amount,
      email: user.email,
      fullName: user.fullName,
      reference,
      title: `${dto.plan} subscription`,
      paymentPlanId,
    });

    return {
      subscriptionId: subscription.id,
      paymentLink: payment.link,
      reference: payment.reference,
    };
  }

  async verify(userId: string, dto: VerifySubscriptionDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await this.paymentsService.verifyTransaction(
      dto.transactionId,
    );

    if (verification.status !== 'successful' || !verification.tx_ref) {
      throw new BadRequestException('Payment verification failed');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        flutterwaveReference: verification.tx_ref,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    const remoteSubscription = await this.paymentsService.findSubscription({
      transactionId: verification.id ?? dto.transactionId,
      email: user.email,
      planId: subscription.flutterwavePaymentPlanId ?? undefined,
    });

    if (!remoteSubscription?.id) {
      throw new BadRequestException(
        'Recurring subscription was not created on Flutterwave',
      );
    }

    const currentlyActiveSubscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        id: { not: subscription.id },
      },
    });

    for (const activeSubscription of currentlyActiveSubscriptions) {
      if (activeSubscription.autoRenew && activeSubscription.flutterwaveSubscriptionId) {
        await this.paymentsService.cancelSubscription(
          activeSubscription.flutterwaveSubscriptionId,
        );
      }
    }

    await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
        autoRenew: false,
      },
    });

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        cancelledAt: null,
        flutterwaveTransactionId: String(dto.transactionId),
        flutterwaveSubscriptionId: remoteSubscription.id,
        flutterwavePaymentPlanId:
          remoteSubscription.plan ?? subscription.flutterwavePaymentPlanId,
        expiresAt: this.calculateNextExpiry(new Date(), subscription.plan),
      },
    });

    return updatedSubscription;
  }

  getCurrentSubscription(userId: string) {
    return this.getMostRelevantSubscription(userId);
  }

  async cancel(userId: string) {
    const subscription = await this.getMostRelevantSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('Active subscription not found');
    }

    if (!subscription.expiresAt || subscription.expiresAt < new Date()) {
      if (subscription.status !== SubscriptionStatus.EXPIRED) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }

      throw new NotFoundException('Active subscription not found');
    }

    if (!subscription.autoRenew || !subscription.flutterwaveSubscriptionId) {
      throw new BadRequestException('Subscription is not currently set to auto-renew');
    }

    await this.paymentsService.cancelSubscription(
      subscription.flutterwaveSubscriptionId,
    );

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });
  }

  async ensureActiveSubscription(userId: string) {
    const subscription = await this.getMostRelevantSubscription(userId);

    if (!subscription) {
      throw new BadRequestException('An active subscription is required');
    }

    if (!subscription.expiresAt || subscription.expiresAt < new Date()) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      throw new BadRequestException('Subscription has expired');
    }

    return subscription;
  }

  async handleWebhook(
    signature: string | undefined,
    rawBody: Buffer,
    payload: Record<string, unknown>,
  ) {
    const isValid = this.paymentsService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new ForbiddenException('Invalid Flutterwave webhook signature');
    }

    const eventType = this.getEventType(payload);
    const data = this.getPayloadData(payload);

    if (
      eventType === 'charge.completed' &&
      data?.status === 'successful'
    ) {
      await this.syncSuccessfulRecurringCharge(data);
    }

    if (
      eventType === 'subscription.cancelled' ||
      (typeof data?.status === 'string' && data.status.toLowerCase() === 'cancelled')
    ) {
      if (data) {
        await this.syncCancelledSubscription(data);
      }
    }

    return { received: true };
  }

  private async syncSuccessfulRecurringCharge(data: Record<string, unknown>) {
    const remoteSubscription = await this.resolveRemoteSubscription(data);
    if (!remoteSubscription?.id) {
      return;
    }

    const localSubscription = await this.findLocalSubscription(remoteSubscription);
    if (!localSubscription) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: localSubscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        cancelledAt: null,
        flutterwaveTransactionId:
          data.id !== undefined ? String(data.id) : localSubscription.flutterwaveTransactionId,
        flutterwaveSubscriptionId: remoteSubscription.id,
        flutterwavePaymentPlanId:
          remoteSubscription.plan ?? localSubscription.flutterwavePaymentPlanId,
        expiresAt: this.calculateNextExpiry(
          localSubscription.expiresAt ?? new Date(),
          localSubscription.plan,
        ),
      },
    });
  }

  private async syncCancelledSubscription(data: Record<string, unknown>) {
    const remoteSubscription = await this.resolveRemoteSubscription(data);
    if (!remoteSubscription?.id) {
      return;
    }

    const localSubscription = await this.findLocalSubscription(remoteSubscription);
    if (!localSubscription) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: localSubscription.id },
      data: {
        autoRenew: false,
        cancelledAt: new Date(),
        status:
          localSubscription.expiresAt && localSubscription.expiresAt > new Date()
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.CANCELLED,
      },
    });
  }

  private async resolveRemoteSubscription(data: Record<string, unknown>) {
    const customer =
      typeof data.customer === 'object' && data.customer !== null
        ? (data.customer as Record<string, unknown>)
        : undefined;

    const email =
      typeof customer?.email === 'string' ? customer.email : undefined;
    const planId = this.toOptionalNumber(data.payment_plan ?? data.plan);
    const transactionId =
      typeof data.id === 'string' || typeof data.id === 'number'
        ? data.id
        : undefined;

    return this.paymentsService.findSubscription({
      transactionId,
      email,
      planId,
    });
  }

  private async findLocalSubscription(remoteSubscription: {
    id: number;
    plan?: number;
    customer?: { email?: string };
  }) {
    if (remoteSubscription.id) {
      const byRemoteId = await this.prisma.subscription.findFirst({
        where: { flutterwaveSubscriptionId: remoteSubscription.id },
      });

      if (byRemoteId) {
        return byRemoteId;
      }
    }

    if (!remoteSubscription.customer?.email || !remoteSubscription.plan) {
      return null;
    }

    const user = await this.usersService.findByEmail(remoteSubscription.customer.email);
    if (!user) {
      return null;
    }

    return this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        flutterwavePaymentPlanId: remoteSubscription.plan,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private calculateNextExpiry(baseDate: Date, plan: SubscriptionPlan) {
    const expiresAt = new Date(baseDate);
    const effectiveBaseDate = expiresAt > new Date() ? expiresAt : new Date();
    effectiveBaseDate.setDate(
      effectiveBaseDate.getDate() + PLAN_CONFIG[plan].durationDays,
    );

    return effectiveBaseDate;
  }

  private async getMostRelevantSubscription(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!subscriptions.length) {
      return null;
    }

    const now = new Date();
    const activeSubscription = subscriptions.find(
      (subscription) =>
        subscription.expiresAt !== null && subscription.expiresAt > now,
    );

    if (activeSubscription) {
      if (activeSubscription.status !== SubscriptionStatus.ACTIVE) {
        return this.prisma.subscription.update({
          where: { id: activeSubscription.id },
          data: { status: SubscriptionStatus.ACTIVE },
        });
      }

      return activeSubscription;
    }

    return subscriptions[0];
  }

  private getEventType(payload: Record<string, unknown>) {
    if (typeof payload.type === 'string') {
      return payload.type;
    }

    if (typeof payload.event === 'string') {
      return payload.event;
    }

    return '';
  }

  private getPayloadData(payload: Record<string, unknown>) {
    return typeof payload.data === 'object' && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : null;
  }

  private toOptionalNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}
