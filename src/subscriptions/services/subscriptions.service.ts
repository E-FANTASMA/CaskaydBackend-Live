import {
  BadRequestException,
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
    STARTER: { amount: 29, durationDays: 30 },
    PRO: { amount: 79, durationDays: 30 },
    ENTERPRISE: { amount: 199, durationDays: 30 },
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

    const reference = `caskayd-${userId}-${Date.now()}`;
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        plan: dto.plan,
        status: SubscriptionStatus.PENDING,
        flutterwaveReference: reference,
      },
    });

    const payment = await this.paymentsService.initializePayment({
      amount: PLAN_CONFIG[dto.plan].amount,
      email: user.email,
      fullName: user.fullName,
      reference,
      title: `${dto.plan} subscription`,
    });

    return {
      subscriptionId: subscription.id,
      paymentLink: payment.link,
      reference: payment.reference,
    };
  }

  async verify(userId: string, dto: VerifySubscriptionDto) {
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

    const planConfig = PLAN_CONFIG[subscription.plan];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planConfig.durationDays);

    await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        flutterwaveTransactionId: dto.transactionId,
        expiresAt,
      },
    });

    return updatedSubscription;
  }

  getCurrentSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureActiveSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

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
}
