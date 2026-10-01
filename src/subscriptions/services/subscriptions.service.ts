import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentMethodService } from '../../payments/services/payment-method.service';
import { PaymentsService } from '../../payments/services/payments.service';
import type { FlutterwaveCardTokenDetails } from '../../payments/interfaces/flutterwave.interface';
import { UsersService } from '../../users/services/users.service';
import { InitializeSubscriptionDto } from '../dto/initialize-subscription.dto';
import { VerifySubscriptionDto } from '../dto/verify-subscription.dto';

const PLAN_CONFIG: Record<
  SubscriptionPlan,
  {
    amount: number;
    durationDays: number;
    includedSearches: number | null;
    accountLimit: number;
  }
> = {
  FREELANCER: {
    amount: 2000,
    durationDays: 30,
    includedSearches: 50,
    accountLimit: 1,
  },
  INDIVIDUAL: {
    amount: 7500,
    durationDays: 30,
    includedSearches: null,
    accountLimit: 1,
  },
  TEAM: {
    amount: 50000,
    durationDays: 30,
    includedSearches: null,
    accountLimit: 10,
  },
};

const PLAN_DISPLAY_NAME: Record<SubscriptionPlan, string> = {
  FREELANCER: 'Caskayd Freelancer Monthly',
  INDIVIDUAL: 'Caskayd Individual Monthly',
  TEAM: 'Caskayd Group Monthly',
};
const SEARCH_PACK_SIZE = 50;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly usersService: UsersService,
  ) {}

  getPlans() {
    return Object.entries(PLAN_CONFIG).map(([plan, config]) => ({
      plan,
      ...config,
      searchLimit: config.includedSearches,
    }));
  }

  async initialize(userId: string, dto: InitializeSubscriptionDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const planConfig = PLAN_CONFIG[dto.plan];
    const paymentPlanId = await this.paymentsService.ensureMonthlyPaymentPlan({
      amount: planConfig.amount,
      name: PLAN_DISPLAY_NAME[dto.plan] ?? 'Caskayd Monthly Subscription',
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
      amount: planConfig.amount,
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

    if (verification.currency && verification.currency !== 'NGN') {
      throw new BadRequestException('Invalid transaction currency, expected NGN');
    }

    if (verification.tx_ref.startsWith('caskayd-search-pack-')) {
      return this.verifySearchPack(
        userId,
        verification.tx_ref,
        String(dto.transactionId),
      );
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

    let savedPaymentMethod: any = null;
    if (verification.card && verification.card.token) {
      savedPaymentMethod = await this.paymentMethodService.saveCardToken(
        userId,
        verification.card,
      );
    }

    let remoteSubscription: any = null;
    try {
      remoteSubscription = await this.paymentsService.findSubscription({
        transactionId: verification.id ?? dto.transactionId,
        email: user.email,
        planId: subscription.flutterwavePaymentPlanId ?? undefined,
      });
    } catch (e) {
      // Remote subscription search fallback
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
        try {
          await this.paymentsService.cancelSubscription(
            activeSubscription.flutterwaveSubscriptionId,
          );
        } catch (e) {
          // Ignore cancellation errors for obsolete subs
        }
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
        flutterwaveSubscriptionId: remoteSubscription?.id ?? null,
        flutterwavePaymentPlanId:
          remoteSubscription?.plan ?? subscription.flutterwavePaymentPlanId,
        paymentMethodId: savedPaymentMethod?.id ?? subscription.paymentMethodId,
        searchesUsed: 0,
        searchCredits: 0,
        expiresAt: this.calculateNextExpiry(new Date(), subscription.plan),
      },
    });

    return updatedSubscription;
  }

  async verifyRedirect(transactionId: string, reference?: string) {
    const verification = await this.paymentsService.verifyTransaction(transactionId);

    if (verification.status !== 'successful' || !verification.tx_ref) {
      throw new BadRequestException('Payment verification failed');
    }

    if (reference && verification.tx_ref !== reference) {
      throw new BadRequestException('Payment reference mismatch');
    }

    if (verification.tx_ref.startsWith('caskayd-search-pack-')) {
      const purchase = await this.prisma.searchPackPurchase.findUnique({
        where: { reference: verification.tx_ref },
      });
      if (!purchase) {
        throw new NotFoundException('Search pack purchase not found');
      }
      return this.verify(purchase.userId, { transactionId });
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { flutterwaveReference: verification.tx_ref },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    return this.verify(subscription.userId, { transactionId });
  }

  async getUserTrialStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { freeSearchesUsed: true },
    });
    const freeSearchesUsed = user?.freeSearchesUsed ?? 0;
    const freeSearchesLimit = 5;
    const searchesRemaining = Math.max(0, freeSearchesLimit - freeSearchesUsed);
    return {
      isTrial: true,
      freeSearchesUsed,
      freeSearchesLimit,
      searchesRemaining,
      isExhausted: freeSearchesUsed >= freeSearchesLimit,
    };
  }

  async getCurrentSubscription(userId: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { memberId: userId },
      select: { ownerId: true },
    });
    const teamSubscription = membership
      ? await this.getMostRelevantSubscription(membership.ownerId)
      : null;

    if (
      teamSubscription?.plan === SubscriptionPlan.TEAM &&
      teamSubscription.expiresAt !== null &&
      teamSubscription.expiresAt > new Date()
    ) {
      return {
        ...teamSubscription,
        isTrial: false,
      };
    }

    const subscription = await this.getMostRelevantSubscription(userId);
    if (
      subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt !== null &&
      subscription.expiresAt > new Date()
    ) {
      return {
        ...subscription,
        isTrial: false,
      };
    }

    const trial = await this.getUserTrialStatus(userId);
    return {
      id: `trial-${userId}`,
      status: !trial.isExhausted
        ? SubscriptionStatus.ACTIVE
        : SubscriptionStatus.EXPIRED,
      plan: null,
      autoRenew: false,
      expiresAt: null,
      searchesUsed: trial.freeSearchesUsed,
      searchCredits: 0,
      isTrial: true,
      freeSearchesUsed: trial.freeSearchesUsed,
      freeSearchesLimit: trial.freeSearchesLimit,
      searchesRemaining: trial.searchesRemaining,
    };
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
    const membership = await this.prisma.teamMembership.findUnique({
      where: { memberId: userId },
      select: { ownerId: true },
    });
    const teamSubscription = membership
      ? await this.getMostRelevantSubscription(membership.ownerId)
      : null;
    const hasActiveTeamSubscription =
      teamSubscription?.plan === SubscriptionPlan.TEAM &&
      teamSubscription.expiresAt !== null &&
      teamSubscription.expiresAt > new Date();
    const subscription =
      hasActiveTeamSubscription
        ? teamSubscription
        : await this.getMostRelevantSubscription(userId);

    const isPaidActive =
      subscription &&
      !subscription.flutterwaveReference?.startsWith('free-') &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt !== null &&
      subscription.expiresAt > new Date();

    if (isPaidActive) {
      return {
        ...subscription,
        isTrial: false,
      };
    }

    if (subscription && (!subscription.expiresAt || subscription.expiresAt < new Date())) {
      if (subscription.status !== SubscriptionStatus.EXPIRED) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }
    }

    const trial = await this.getUserTrialStatus(userId);
    if (trial.isExhausted) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message:
            'Free trial limit reached (5 searches). Please choose a subscription plan to continue using Caskayd.',
          code: 'FREE_TRIAL_EXHAUSTED',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return {
      id: `trial-${userId}`,
      plan: null,
      status: SubscriptionStatus.ACTIVE,
      isTrial: true,
      freeSearchesUsed: trial.freeSearchesUsed,
      freeSearchesLimit: trial.freeSearchesLimit,
      searchesRemaining: trial.searchesRemaining,
    };
  }

  async consumeSearch(userId: string) {
    const access = await this.ensureActiveSubscription(userId);

    if ((access as any).isTrial) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { freeSearchesUsed: true },
      });
      const currentUsed = user?.freeSearchesUsed ?? 0;
      if (currentUsed >= 5) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message:
              'Free trial search limit reached (5/5). Please upgrade to continue searching.',
            code: 'FREE_TRIAL_EXHAUSTED',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { freeSearchesUsed: { increment: 1 } },
      });

      const nextUsed = currentUsed + 1;
      return {
        isTrial: true,
        freeSearchesUsed: nextUsed,
        freeSearchesLimit: 5,
        searchesRemaining: Math.max(0, 5 - nextUsed),
      };
    }

    const subscription = access as any;
    if (subscription.flutterwaveReference?.startsWith('free-')) {
      return { isTrial: false };
    }

    const includedSearches = PLAN_CONFIG[subscription.plan]?.includedSearches ?? null;
    if (includedSearches === null) {
      return { isTrial: false };
    }

    const searchLimit = includedSearches + subscription.searchCredits;
    const result = await this.prisma.subscription.updateMany({
      where: {
        id: subscription.id,
        searchesUsed: { lt: searchLimit },
      },
      data: { searchesUsed: { increment: 1 } },
    });

    if (result.count === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message:
            'Search limit reached. Wait for your subscription period to renew, buy another 50 searches, or change plans.',
          code: 'SEARCH_LIMIT_REACHED',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return {
      isTrial: false,
      searchesUsed: subscription.searchesUsed + 1,
      searchLimit,
    };
  }

  async getSearchUsage(userId: string) {
    const access = await this.ensureActiveSubscription(userId);
    if ((access as any).isTrial) {
      const trial = await this.getUserTrialStatus(userId);
      return {
        plan: 'TRIAL',
        searchesUsed: trial.freeSearchesUsed,
        additionalSearches: 0,
        searchLimit: trial.freeSearchesLimit,
        searchesRemaining: trial.searchesRemaining,
        isTrial: true,
        periodEndsAt: null,
      };
    }

    const subscription = access as any;
    const includedSearches = PLAN_CONFIG[subscription.plan]?.includedSearches ?? null;
    const limit =
      includedSearches === null
        ? null
        : includedSearches + subscription.searchCredits;

    return {
      plan: subscription.plan,
      searchesUsed: subscription.searchesUsed,
      additionalSearches: subscription.searchCredits,
      searchLimit: limit,
      searchesRemaining:
        limit === null ? null : Math.max(0, limit - subscription.searchesUsed),
      periodEndsAt: subscription.expiresAt,
      isTrial: false,
    };
  }

    async initializeSearchPack(userId: string) {
    const subscription = await this.ensureActiveSubscription(userId);
    if (subscription.plan !== SubscriptionPlan.FREELANCER) {
      throw new BadRequestException(
        'Search packs are only available with the Freelancer plan',
      );
    }

    const reference = `caskayd-search-pack-${userId}-${Date.now()}`;
    await this.prisma.searchPackPurchase.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        reference,
      },
    });

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payment = await this.paymentsService.initializePayment({
      amount: PLAN_CONFIG.FREELANCER.amount,
      email: user.email,
      fullName: user.fullName,
      reference,
      title: '50 additional creator searches',
    });

    return { paymentLink: payment.link, reference: payment.reference };
  }

  private async verifySearchPack(
    userId: string,
    reference: string,
    transactionId: string,
  ) {
    const purchase = await this.prisma.searchPackPurchase.findUnique({
      where: { reference },
    });
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException('Search pack purchase not found');
    }
    if (purchase.status === 'COMPLETED') {
      return this.getSearchUsage(userId);
    }

    const subscription = await this.ensureActiveSubscription(userId);
    if (
      subscription.id !== purchase.subscriptionId ||
      subscription.plan !== SubscriptionPlan.FREELANCER
    ) {
      throw new BadRequestException(
        'The Freelancer subscription associated with this search pack is no longer active',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.searchPackPurchase.updateMany({
        where: { id: purchase.id, status: 'PENDING' },
        data: { status: 'COMPLETED', transactionId },
      });
      if (updated.count > 0) {
        await transaction.subscription.update({
          where: { id: subscription.id },
          data: { searchCredits: { increment: SEARCH_PACK_SIZE } },
        });
      }
    });

    return this.getSearchUsage(userId);
  }

  async addTeamMember(ownerId: string, email: string) {
    const subscription = await this.ensureActiveSubscription(ownerId);
    if (subscription.plan !== SubscriptionPlan.TEAM) {
      throw new ForbiddenException('An active Group plan is required');
    }

    const member = await this.usersService.findByEmail(email);
    if (!member) {
      throw new NotFoundException('Register the account before adding it to a group');
    }
    if (member.id === ownerId) {
      throw new BadRequestException('The group owner is already included');
    }

    const currentMembership = await this.prisma.teamMembership.findUnique({
      where: { memberId: member.id },
    });
    if (currentMembership) {
      if (currentMembership.ownerId === ownerId) {
        return currentMembership;
      }
      throw new ConflictException('This account already belongs to a group');
    }

    const memberCount = await this.prisma.teamMembership.count({
      where: { ownerId },
    });
    if (memberCount >= PLAN_CONFIG.TEAM.accountLimit - 1) {
      throw new ConflictException('A Group plan supports 10 accounts total');
    }

    return this.prisma.teamMembership.create({
      data: { ownerId, memberId: member.id },
      include: { member: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async getTeamMembers(ownerId: string) {
    const subscription = await this.ensureActiveSubscription(ownerId);
    if (subscription.plan !== SubscriptionPlan.TEAM) {
      throw new ForbiddenException('An active Group plan is required');
    }

    return this.prisma.teamMembership.findMany({
      where: { ownerId },
      include: { member: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeTeamMember(ownerId: string, memberId: string) {
    const subscription = await this.ensureActiveSubscription(ownerId);
    if (subscription.plan !== SubscriptionPlan.TEAM) {
      throw new ForbiddenException('An active Group plan is required');
    }

    const membership = await this.prisma.teamMembership.findFirst({
      where: { ownerId, memberId },
    });
    if (!membership) {
      throw new NotFoundException('Group member not found');
    }

    return this.prisma.teamMembership.delete({
      where: { id: membership.id },
    });
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
    let remoteSubscription: Awaited<ReturnType<typeof this.resolveRemoteSubscription>> = null;
    try {
      remoteSubscription = await this.resolveRemoteSubscription(data);
    } catch (e) {
      // The transaction reference is sufficient to reconcile the local payment.
    }

    const localSubscription = remoteSubscription?.id
      ? await this.findLocalSubscription(remoteSubscription)
      : await this.findLocalSubscriptionByReference(data);
    if (!localSubscription) {
      return;
    }

    let paymentMethodId = localSubscription.paymentMethodId;
    const card =
      typeof data.card === 'object' && data.card !== null
        ? (data.card as { token?: string })
        : undefined;
    if (card?.token) {
      const paymentMethod = await this.paymentMethodService.saveCardToken(
        localSubscription.userId,
        data.card as FlutterwaveCardTokenDetails,
      );
      if (paymentMethod) {
        paymentMethodId = paymentMethod.id;
      }
    }

    await this.prisma.subscription.update({
      where: { id: localSubscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        cancelledAt: null,
          searchesUsed: 0,
          searchCredits: 0,
        flutterwaveTransactionId:
          data.id !== undefined ? String(data.id) : localSubscription.flutterwaveTransactionId,
        flutterwaveSubscriptionId:
          remoteSubscription?.id ?? localSubscription.flutterwaveSubscriptionId,
        flutterwavePaymentPlanId:
          remoteSubscription?.plan ??
          this.toOptionalNumber(data.payment_plan ?? data.plan) ??
          localSubscription.flutterwavePaymentPlanId,
        paymentMethodId,
        expiresAt: this.calculateNextExpiry(
          localSubscription.expiresAt ?? new Date(),
          localSubscription.plan,
        ),
      },
    });
  }

  private async findLocalSubscriptionByReference(data: Record<string, unknown>) {
    if (typeof data.tx_ref !== 'string' || !data.tx_ref) {
      return null;
    }

    return this.prisma.subscription.findFirst({
      where: { flutterwaveReference: data.tx_ref },
      orderBy: { createdAt: 'desc' },
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

  async renewSubscriptionWithToken(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        paymentMethod: true,
      },
    });

    if (!subscription || !subscription.user) {
      throw new NotFoundException('Subscription or user not found');
    }

    let paymentMethod = subscription.paymentMethod;
    if (!paymentMethod) {
      paymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(
        subscription.userId,
      );
    }

    if (!paymentMethod || !paymentMethod.token) {
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.FAILED,
          autoRenew: false,
        },
      });
      return { success: false, reason: 'No valid payment method token found' };
    }

    const txRef = `caskayd-autorenew-${subscription.id}-${Date.now()}`;
    const amount = PLAN_CONFIG[subscription.plan].amount;

    try {
      const chargeResult = await this.paymentsService.chargeToken({
        token: paymentMethod.token,
        currency: 'NGN',
        amount,
        email: subscription.user.email,
        tx_ref: txRef,
        first_name: subscription.user.fullName?.split(' ')[0] || 'Subscriber',
        last_name: subscription.user.fullName?.split(' ')[1] || '',
        customizations: {
          title: 'Caskayd Subscription Auto-Renewal',
          description: `Auto-renewal for ${subscription.plan} plan (₦${amount})`,
        },
      });

      const isSuccess =
        chargeResult.status === 'success' ||
        chargeResult.data?.status === 'successful';

      if (isSuccess) {
        const nextExpiry = this.calculateNextExpiry(
          subscription.expiresAt && subscription.expiresAt > new Date()
            ? subscription.expiresAt
            : new Date(),
          subscription.plan,
        );

        if (chargeResult.data?.card) {
          await this.paymentMethodService.saveCardToken(
            subscription.userId,
            chargeResult.data.card,
          );
        }

        const updatedSub = await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            autoRenew: true,
            searchesUsed: 0,
            searchCredits: 0,
            expiresAt: nextExpiry,
            flutterwaveTransactionId: chargeResult.data?.id
              ? String(chargeResult.data.id)
              : subscription.flutterwaveTransactionId,
            paymentMethodId: paymentMethod.id,
          },
        });

        return { success: true, subscription: updatedSub };
      } else {
        await this.prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: SubscriptionStatus.FAILED,
            autoRenew: false,
          },
        });
        return { success: false, reason: chargeResult.message || 'Charge failed' };
      }
    } catch (error) {
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.FAILED,
          autoRenew: false,
        },
      });
      return { success: false, reason: (error as Error).message };
    }
  }
}

