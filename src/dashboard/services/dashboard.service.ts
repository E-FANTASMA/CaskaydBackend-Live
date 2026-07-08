import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const [
      currentSubscription,
      campaignCount,
      savedCreatorCount,
      recentCampaigns,
      recentSavedCreators,
    ] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
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
