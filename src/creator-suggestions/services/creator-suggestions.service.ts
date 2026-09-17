import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlatformType, SuggestionStatus } from '@prisma/client';
import {
  creatorRelationsInclude,
  serializeCreator,
} from '../../creators/creator-response.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateCreatorSuggestionDto } from '../dto/create-creator-suggestion.dto';
import { QueryCreatorSuggestionsDto } from '../dto/query-creator-suggestions.dto';
import { UpdateCreatorSuggestionDto } from '../dto/update-creator-suggestion.dto';

@Injectable()
export class CreatorSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCreatorSuggestionDto) {
    const normalizedUsername = this.normalizeUsername(dto.username);

    // Duplicate check in CreatorPlatform (existing creators)
    const existingCreatorPlatform = await this.prisma.creatorPlatform.findFirst({
      where: {
        handle: {
          equals: normalizedUsername,
          mode: 'insensitive',
        },
      },
    });

    if (existingCreatorPlatform) {
      throw new BadRequestException('Creator already exists');
    }

    // Duplicate check in CreatorSuggestion (pending suggestions)
    const existingSuggestion = await this.prisma.creatorSuggestion.findFirst({
      where: {
        username: normalizedUsername,
        status: SuggestionStatus.PENDING,
      },
    });

    if (existingSuggestion) {
      throw new BadRequestException('Creator already suggested');
    }

    return this.prisma.creatorSuggestion.create({
      data: {
        name: dto.name.trim(),
        username: normalizedUsername,
        platform: dto.platform.trim(),
        link: dto.link?.trim() || null,
        status: SuggestionStatus.PENDING,
      },
    });
  }

  async findAllAdmin(query: QueryCreatorSuggestionsDto) {
    return this.prisma.creatorSuggestion.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatusAdmin(id: string, dto: UpdateCreatorSuggestionDto) {
    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.creatorSuggestion.findUnique({
        where: { id },
      });

      if (!suggestion) {
        throw new NotFoundException('Creator suggestion not found');
      }

      if (suggestion.status !== SuggestionStatus.PENDING) {
        throw new BadRequestException(
          `Suggestion has already been ${suggestion.status.toLowerCase()}`,
        );
      }

      if (dto.status === SuggestionStatus.APPROVED) {
        const platformType = this.parsePlatformType(suggestion.platform);

        const creator = await tx.creator.create({
          data: {
            name: suggestion.name,
            state: null,
            primaryCategoryId: null,
            platforms: {
              create: {
                platform: platformType,
                handle: suggestion.username,
                followers: 0,
                verified: false,
                profileUrl: suggestion.link,
              },
            },
          },
          include: creatorRelationsInclude,
        });

        const updatedSuggestion = await tx.creatorSuggestion.update({
          where: { id },
          data: { status: SuggestionStatus.APPROVED },
        });

        return {
          suggestion: updatedSuggestion,
          creator: serializeCreator(creator),
        };
      }

      if (dto.status === SuggestionStatus.REJECTED) {
        const updatedSuggestion = await tx.creatorSuggestion.update({
          where: { id },
          data: { status: SuggestionStatus.REJECTED },
        });

        return {
          suggestion: updatedSuggestion,
        };
      }

      throw new BadRequestException('Invalid suggestion status provided');
    });
  }

  normalizeUsername(username: string): string {
    return username
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
  }

  private parsePlatformType(platform: string): PlatformType {
    const formatted = platform.trim().toUpperCase();
    if (formatted in PlatformType) {
      return PlatformType[formatted as keyof typeof PlatformType];
    }
    if (formatted === 'TWITTER') {
      return PlatformType.X;
    }
    return PlatformType.INSTAGRAM;
  }
}
