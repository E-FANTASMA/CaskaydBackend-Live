import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlatformType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

function parseFollowerString(val: string): number {
  if (!val) return 0;
  const clean = val.trim().toLowerCase();
  const numPart = parseFloat(clean.replace(/[^\d.]/g, ''));
  if (isNaN(numPart)) return 0;
  if (clean.endsWith('m')) return Math.round(numPart * 1000000);
  if (clean.endsWith('k')) return Math.round(numPart * 1000);
  return Math.round(numPart);
}

@Injectable()
export class CreatorMetricsSyncSchedulerService {
  private readonly logger = new Logger(CreatorMetricsSyncSchedulerService.name);
  private isSyncing = false;

  constructor(private readonly prisma: PrismaService) {}

  // Tier 1: Mega Creators (> 500k followers) - Twice a week (Mondays & Thursdays at 2:00 AM)
  @Cron('0 2 * * 1,4')
  async scheduleMegaCreators() {
    this.logger.log('Starting scheduled Tier 1 (Mega >500k) creator metrics sync...');
    await this.syncTier(500000);
  }

  // Tier 2: Mid Creators (100k - 500k followers) - Once a week (Tuesdays at 3:00 AM)
  @Cron('0 3 * * 2')
  async scheduleMidCreators() {
    this.logger.log('Starting scheduled Tier 2 (Mid 100k-500k) creator metrics sync...');
    await this.syncTier(100000, 500000);
  }

  // Tier 3: Micro Creators (< 100k followers) - Bi-weekly (1st and 15th of every month at 4:00 AM)
  @Cron('0 4 1,15 * *')
  async scheduleMicroCreators() {
    this.logger.log('Starting scheduled Tier 3 (Micro <100k) creator metrics sync...');
    await this.syncTier(0, 100000);
  }

  async syncTier(minFollowers: number, maxFollowers?: number): Promise<{ updated: number; failed: number }> {
    if (this.isSyncing) {
      this.logger.warn('A metrics sync is already in progress, skipping this execution.');
      return { updated: 0, failed: 0 };
    }

    this.isSyncing = true;
    let updated = 0;
    let failed = 0;

    try {
      const records = await this.prisma.creatorPlatform.findMany({
        where: {
          platform: { in: [PlatformType.INSTAGRAM, PlatformType.TIKTOK] },
          followers: {
            gte: minFollowers,
            ...(maxFollowers !== undefined ? { lt: maxFollowers } : {}),
          },
        },
        select: {
          id: true,
          creatorId: true,
          platform: true,
          handle: true,
          followers: true,
          verified: true,
        },
      });

      this.logger.log(`Found ${records.length} records to sync in tier [${minFollowers} - ${maxFollowers ?? 'inf'}]`);

      for (const record of records) {
        try {
          const result = await this.fetchPlatformMetrics(record.platform, record.handle);
          if (result) {
            await this.prisma.creatorPlatform.update({
              where: { id: record.id },
              data: {
                followers: result.followers,
                verified: result.verified ?? record.verified,
                lastUpdated: new Date(),
              },
            });
            updated++;
          } else {
            failed++;
          }
        } catch (err) {
          this.logger.warn(`Failed to sync metrics for @${record.handle} on ${record.platform}: ${err}`);
          failed++;
        }

        // Polite delay between outbound scrapes
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      this.logger.log(`Tier sync complete: ${updated} updated, ${failed} failed.`);
    } finally {
      this.isSyncing = false;
    }

    return { updated, failed };
  }

  private async fetchPlatformMetrics(
    platform: PlatformType,
    rawHandle: string,
  ): Promise<{ followers: number; verified?: boolean } | null> {
    const handle = rawHandle.replace(/^@/, '').trim();
    if (!handle) return null;

    if (platform === PlatformType.INSTAGRAM) {
      const res = await fetch(`https://www.instagram.com/${handle}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) return null;
      const html = await res.text();

      const descMatch = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (!descMatch) return null;

      const folMatch = descMatch[1].match(/([\d\.,KMkm]+)\s+Followers/i);
      if (!folMatch) return null;

      const followers = parseFollowerString(folMatch[1]);
      const verified = html.includes('Verified') || html.includes('title="Verified"');

      return { followers, verified };
    }

    if (platform === PlatformType.TIKTOK) {
      const res = await fetch(`https://www.tiktok.com/@${handle}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) return null;
      const html = await res.text();

      const folMatch = html.match(/"followerCount":(\d+)/);
      if (!folMatch) return null;

      const followers = parseInt(folMatch[1], 10);
      const verMatch = html.match(/"verified":(true|false)/);
      const verified = verMatch ? verMatch[1] === 'true' : false;

      return { followers, verified };
    }

    return null;
  }
}
