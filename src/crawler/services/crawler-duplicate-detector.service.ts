import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DuplicateMatch } from '../interfaces/duplicate-match.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';

@Injectable()
export class CrawlerDuplicateDetectorService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatch(profile: NormalizedCreatorProfile): Promise<DuplicateMatch | null> {
    const [platformMatch, emailMatch, nameMatch] = await Promise.all([
      this.findByPlatform(profile),
      this.findByEmail(profile),
      this.findByName(profile),
    ]);

    const candidates = [platformMatch, emailMatch, nameMatch].filter(Boolean) as DuplicateMatch[];
    if (!candidates.length) {
      return null;
    }

    return candidates.sort((left, right) => right.confidenceScore - left.confidenceScore)[0];
  }

  private async findByPlatform(profile: NormalizedCreatorProfile): Promise<DuplicateMatch | null> {
    const creatorPlatform = await this.prisma.creatorPlatform.findFirst({
      where: {
        platform: profile.platform,
        handle: {
          equals: profile.username,
          mode: 'insensitive',
        },
      },
      select: {
        creatorId: true,
      },
    });

    if (!creatorPlatform) {
      return null;
    }

    return {
      matchedCreatorId: creatorPlatform.creatorId,
      confidenceScore: 1,
      matchedBy: ['platform', 'username'],
    };
  }

  private async findByEmail(profile: NormalizedCreatorProfile): Promise<DuplicateMatch | null> {
    if (!profile.businessEmail) {
      return null;
    }

    const creator = await this.prisma.creator.findFirst({
      where: {
        businessEmail: {
          equals: profile.businessEmail,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (!creator) {
      return null;
    }

    return {
      matchedCreatorId: creator.id,
      confidenceScore: 0.92,
      matchedBy: ['businessEmail'],
    };
  }

  private async findByName(profile: NormalizedCreatorProfile): Promise<DuplicateMatch | null> {
    const creator = await this.prisma.creator.findFirst({
      where: {
        name: {
          equals: profile.displayName ?? profile.name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (!creator) {
      return null;
    }

    return {
      matchedCreatorId: creator.id,
      confidenceScore: 0.45,
      matchedBy: ['displayName'],
    };
  }
}
