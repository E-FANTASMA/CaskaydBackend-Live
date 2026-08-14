import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getDashboard(userId: string) {
    const [
      currentSubscription,
      campaignCount,
      savedCreatorCount,
      recentCampaigns,
      recentSavedCreators,
    ] = await Promise.all([
      this.subscriptionsService.getCurrentSubscription(userId),
      this.prisma.campaign.count({
        where: { userId },
      }),
      this.prisma.savedCreator.count({
        where: { userId },
      }),
      this.prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.savedCreator.findMany({
        where: { userId },
        include: {
          creator: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      currentSubscription,
      campaignCount,
      savedCreatorCount,
      recentCampaigns,
      recentSavedCreators,
    };
  }
}
