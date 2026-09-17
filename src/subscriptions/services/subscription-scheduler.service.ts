import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutoRenewals() {
    this.logger.log('Starting automated subscription auto-renewal job...');

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() + 24);

    const subscriptionsToRenew = await this.prisma.subscription.findMany({
      where: {
        autoRenew: true,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED],
        },
        OR: [
          { expiresAt: { lte: cutoffDate } },
          { expiresAt: null },
        ],
      },
    });

    this.logger.log(
      `Found ${subscriptionsToRenew.length} subscription(s) eligible for auto-renewal.`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptionsToRenew) {
      try {
        const result = await this.subscriptionsService.renewSubscriptionWithToken(
          sub.id,
        );
        if (result.success) {
          successCount++;
          this.logger.log(`Successfully renewed subscription ${sub.id}`);
        } else {
          failCount++;
          this.logger.warn(
            `Failed to renew subscription ${sub.id}: ${result.reason}`,
          );
        }
      } catch (error) {
        failCount++;
        this.logger.error(
          `Unhandled error renewing subscription ${sub.id}`,
          (error as Error).stack,
        );
      }
    }

    this.logger.log(
      `Auto-renewal job completed. Processed: ${subscriptionsToRenew.length}, Succeeded: ${successCount}, Failed: ${failCount}`,
    );

    return {
      totalProcessed: subscriptionsToRenew.length,
      successCount,
      failCount,
    };
  }
}
