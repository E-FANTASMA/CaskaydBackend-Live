import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DuplicateMatch } from '../interfaces/duplicate-match.interface';
import { NormalizedCreatorProfile } from '../interfaces/normalized-creator-profile.interface';
import { TaxonomyResolution } from '../interfaces/taxonomy-resolution.interface';

interface PersistCreatorInput {
  profile: NormalizedCreatorProfile;
  taxonomy: TaxonomyResolution;
  searchTags: string[];
  duplicateMatch: DuplicateMatch | null;
}

@Injectable()
export class CrawlerDatabaseUpdaterService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(input: PersistCreatorInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.duplicateMatch) {
        return this.updateExistingCreator(tx as PrismaClient, input);
      }

      return this.createCreator(tx as PrismaClient, input);
    });
  }

  private async createCreator(tx: PrismaClient, input: PersistCreatorInput) {
    const { country, state } = this.extractLocation(input.profile.location);

    return tx.creator.create({
      data: {
        name: input.profile.displayName ?? input.profile.name,
        businessEmail: input.profile.businessEmail,
        profileImage: input.profile.profileImage,
        country,
        state,
        primaryCategoryId: input.taxonomy.primaryCategoryId,
        secondaryCategories: input.taxonomy.secondaryCategoryIds.length
          ? {
              create: input.taxonomy.secondaryCategoryIds.map((categoryId) => ({
                categoryId,
              })),
            }
          : undefined,
        searchTags: input.searchTags.length
          ? {
              create: input.searchTags.map((tag) => ({
                tag,
              })),
            }
          : undefined,
        platforms: {
          create: {
            platform: input.profile.platform,
            handle: input.profile.username,
            followers: input.profile.followers,
            verified: input.profile.verified,
            profileUrl: input.profile.externalUrl,
          },
        },
      },
      include: {
        secondaryCategories: true,
        searchTags: true,
        platforms: true,
      },
    });
  }

  private async updateExistingCreator(tx: PrismaClient, input: PersistCreatorInput) {
    const creatorId = input.duplicateMatch!.matchedCreatorId;
    const existing = await tx.creator.findUniqueOrThrow({
      where: { id: creatorId },
      include: {
        secondaryCategories: true,
        searchTags: true,
        platforms: true,
      },
    });

    const { country, state } = this.extractLocation(input.profile.location);
    const creatorPatch: Prisma.CreatorUpdateInput = {};

    if ((input.profile.displayName ?? input.profile.name) !== existing.name) {
      creatorPatch.name = input.profile.displayName ?? input.profile.name;
    }
    if (input.profile.businessEmail !== existing.businessEmail) {
      creatorPatch.businessEmail = input.profile.businessEmail;
    }
    if (input.profile.profileImage !== existing.profileImage) {
      creatorPatch.profileImage = input.profile.profileImage;
    }
    if (country !== existing.country) {
      creatorPatch.country = country;
    }
    if (state !== existing.state) {
      creatorPatch.state = state;
    }
    if (input.taxonomy.primaryCategoryId !== existing.primaryCategoryId) {
      creatorPatch.primaryCategory = {
        connect: {
          id: input.taxonomy.primaryCategoryId,
        },
      };
    }

    const existingSecondaryIds = existing.secondaryCategories
      .map((entry) => entry.categoryId)
      .sort();
    const nextSecondaryIds = [...input.taxonomy.secondaryCategoryIds].sort();
    if (existingSecondaryIds.join('|') !== nextSecondaryIds.join('|')) {
      creatorPatch.secondaryCategories = {
        deleteMany: {},
        create: nextSecondaryIds.map((categoryId) => ({
          categoryId,
        })),
      };
    }

    const existingTags = existing.searchTags.map((entry) => entry.tag).sort();
    const nextTags = [...input.searchTags].sort();
    if (existingTags.join('|') !== nextTags.join('|')) {
      creatorPatch.searchTags = {
        deleteMany: {},
        create: nextTags.map((tag) => ({
          tag,
        })),
      };
    }

    if (Object.keys(creatorPatch).length) {
      await tx.creator.update({
        where: { id: existing.id },
        data: creatorPatch,
      });
    }

    const existingPlatform = existing.platforms.find(
      (platform) => platform.platform === input.profile.platform,
    );
    if (!existingPlatform) {
      await tx.creatorPlatform.create({
        data: {
          creatorId: existing.id,
          platform: input.profile.platform,
          handle: input.profile.username,
          followers: input.profile.followers,
          verified: input.profile.verified,
          profileUrl: input.profile.externalUrl,
        },
      });
    } else {
      const platformPatch: Prisma.CreatorPlatformUpdateInput = {
        lastUpdated: new Date(),
      };

      if (existingPlatform.handle !== input.profile.username) {
        platformPatch.handle = input.profile.username;
      }
      if (existingPlatform.followers !== input.profile.followers) {
        platformPatch.followers = input.profile.followers;
      }
      if (existingPlatform.verified !== input.profile.verified) {
        platformPatch.verified = input.profile.verified;
      }
      if (existingPlatform.profileUrl !== input.profile.externalUrl) {
        platformPatch.profileUrl = input.profile.externalUrl;
      }

      await tx.creatorPlatform.update({
        where: {
          id: existingPlatform.id,
        },
        data: platformPatch,
      });
    }

    return tx.creator.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        secondaryCategories: true,
        searchTags: true,
        platforms: true,
      },
    });
  }

  private extractLocation(location?: string) {
    if (!location) {
      return {
        country: undefined,
        state: undefined,
      };
    }

    const [state, country] = location.split(',').map((part) => part.trim());
    if (!country) {
      return {
        country: state || undefined,
        state: undefined,
      };
    }

    return {
      state: state || undefined,
      country: country || undefined,
    };
  }
}
