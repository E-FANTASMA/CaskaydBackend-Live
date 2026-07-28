import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { slugifyCategoryName } from '../../categories/utils/slugify.util';
import { CreatorImportRecord } from '../interfaces/import-record.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';

@Injectable()
export class CrawlerNormalizerService {
  normalize(
    input: Partial<NormalizedCreatorProfile> | CreatorImportRecord,
  ): NormalizedCreatorProfile {
    const platform = this.normalizePlatform(input.platform);
    const username = this.normalizeUsername(input.username);
    const platformCreatorId =
      this.normalizeText(input.platformCreatorId) ?? username;

    if (!platform || !username || !platformCreatorId) {
      throw new BadRequestException(
        'Normalized creator profile requires platform, username and platformCreatorId',
      );
    }

    const keywords = this.normalizeKeywords([
      ...(Array.isArray(input.keywords)
        ? input.keywords
        : this.splitLooseList(input.keywords)),
      input.bio,
      input.displayName,
      input.name,
      username,
    ]);

    return {
      platform,
      platformCreatorId,
      name:
        this.normalizeText(input.name) ??
        this.normalizeText(input.displayName) ??
        username,
      displayName: this.normalizeText(input.displayName),
      username,
      bio: this.normalizeText(input.bio),
      profileImage: this.normalizeUrl(input.profileImage),
      followers: this.normalizeNumber(input.followers),
      following: this.normalizeOptionalNumber(input.following),
      posts: this.normalizeOptionalNumber(input.posts),
      website: this.normalizeUrl(input.website),
      businessEmail: this.normalizeEmail(input.businessEmail),
      verified: this.normalizeBoolean(input.verified),
      location: this.normalizeText(input.location),
      externalUrl:
        this.normalizeUrl(input.externalUrl) ??
        this.buildDefaultProfileUrl(platform, username),
      lastSeen: input.lastSeen instanceof Date ? input.lastSeen : new Date(),
      keywords,
    };
  }

  private normalizePlatform(value: unknown): PlatformType | undefined {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return undefined;
    }

    const slug = slugifyCategoryName(normalized).replace(/-/g, '_').toUpperCase();
    return Object.values(PlatformType).find((platform) => platform === slug);
  }

  private normalizeUsername(value: unknown) {
    return this.normalizeText(value)?.replace(/^@/, '').trim();
  }

  private normalizeNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }

    const normalized = this.normalizeText(value);
    if (!normalized) {
      return 0;
    }

    const compact = normalized.replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
    const match = compact.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
    if (!match) {
      return 0;
    }

    const amount = Number.parseFloat(match[1]);
    const suffix = match[2];
    const multiplier =
      suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;

    return Math.max(0, Math.round(amount * multiplier));
  }

  private normalizeOptionalNumber(value: unknown) {
    const normalized = this.normalizeNumber(value);
    return normalized || normalized === 0 ? normalized : undefined;
  }

  private normalizeBoolean(value: unknown) {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = this.normalizeText(value)?.toLowerCase();
    return ['true', 'yes', '1', 'verified'].includes(normalized ?? '');
  }

  private normalizeEmail(value: unknown) {
    const normalized = this.normalizeText(value)?.toLowerCase();
    if (!normalized) {
      return undefined;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : undefined;
  }

  private normalizeUrl(value: unknown) {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return undefined;
    }

    try {
      return new URL(normalized).toString();
    } catch {
      return undefined;
    }
  }

  private normalizeText(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private splitLooseList(value: unknown) {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return [];
    }

    return normalized.split(/[|,;/]/).map((item) => item.trim());
  }

  private normalizeKeywords(values: Array<unknown>) {
    const keywords = new Set<string>();

    for (const value of values) {
      const normalized = this.normalizeText(value);
      if (!normalized) {
        continue;
      }

      for (const candidate of normalized.split(/[|,;/]/)) {
        const cleaned = candidate.trim().toLowerCase();
        if (cleaned.length >= 2) {
          keywords.add(cleaned);
        }
      }
    }

    return [...keywords];
  }

  private buildDefaultProfileUrl(platform: PlatformType, username: string) {
    switch (platform) {
      case PlatformType.INSTAGRAM:
        return `https://instagram.com/${username}`;
      case PlatformType.TIKTOK:
        return `https://www.tiktok.com/@${username}`;
      case PlatformType.YOUTUBE:
        return `https://www.youtube.com/@${username}`;
      case PlatformType.X:
        return `https://x.com/${username}`;
      default:
        return undefined;
    }
  }
}
