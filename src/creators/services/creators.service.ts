import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  creatorRelationsInclude,
  serializeCreator,
} from '../creator-response.util';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { QueryCreatorsDto } from '../dto/query-creators.dto';
import { UpdateCreatorDto } from '../dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCreatorDto) {
    const creator = await this.prisma.creator.create({
      data: await this.buildCreatorCreateInput(dto),
      include: creatorRelationsInclude,
    });

    return serializeCreator(creator);
  }

  async findAll(query: QueryCreatorsDto) {
    const where: Prisma.CreatorWhereInput = {
      AND: [
        query.niche
          ? {
              OR: [
                {
                  primaryCategory: {
                    name: { contains: query.niche, mode: 'insensitive' },
                  },
                },
                {
                  secondaryCategories: {
                    some: {
                      category: {
                        name: { contains: query.niche, mode: 'insensitive' },
                      },
                    },
                  },
                },
                {
                  searchTags: {
                    some: {
                      tag: { contains: query.niche, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {},
        query.country
          ? { country: { contains: query.country, mode: 'insensitive' } }
          : {},
        query.platform
          ? {
              platforms: {
                some: {
                  platform: query.platform as never,
                },
              },
            }
          : {},
      ],
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const creators = await this.prisma.creator.findMany({
      where,
      include: creatorRelationsInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return creators.map(serializeCreator);
  }

  async findOne(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      include: creatorRelationsInclude,
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return serializeCreator(creator);
  }

  async update(id: string, dto: UpdateCreatorDto) {
    await this.assertCreatorExists(id);

    const creator = await this.prisma.creator.update({
      where: { id },
      data: await this.buildCreatorUpdateInput(dto),
      include: creatorRelationsInclude,
    });

    return serializeCreator(creator);
  }

  async remove(id: string) {
    await this.assertCreatorExists(id);
    await this.prisma.creator.delete({ where: { id } });
    return { message: 'Creator deleted successfully' };
  }

  private async assertCreatorExists(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
  }

  private async buildCreatorCreateInput(dto: CreateCreatorDto) {
    const taxonomy = await this.resolveCreatorTaxonomy(dto, true);
    const secondaryCategoryIds = taxonomy.secondaryCategoryIds ?? [];

    return {
      name: dto.name,
      gender: dto.gender,
      country: dto.country,
      state: dto.state,
      primaryCategory: {
        connect: {
          id: taxonomy.primaryCategoryId!,
        },
      },
      businessEmail: dto.businessEmail,
      profileImage: dto.profileImage,
      secondaryCategories: secondaryCategoryIds.length
        ? {
            create: secondaryCategoryIds.map((categoryId) => ({
              categoryId,
            })),
          }
        : undefined,
      platforms: dto.platforms?.length
        ? {
            create: dto.platforms,
          }
        : undefined,
      searchTags: this.normalizeSearchTags(dto.searchTags).length
        ? {
            create: this.normalizeSearchTags(dto.searchTags).map((tag) => ({
              tag,
            })),
          }
        : undefined,
    };
  }

  private async buildCreatorUpdateInput(dto: UpdateCreatorDto) {
    const taxonomy = await this.resolveCreatorTaxonomy(dto, false);

    return {
      name: dto.name,
      gender: dto.gender,
      country: dto.country,
      state: dto.state,
      primaryCategory: taxonomy.primaryCategoryId
        ? {
            connect: {
              id: taxonomy.primaryCategoryId,
            },
          }
        : undefined,
      businessEmail: dto.businessEmail,
      profileImage: dto.profileImage,
      secondaryCategories: taxonomy.secondaryCategoryIds
        ? {
            deleteMany: {},
            create: taxonomy.secondaryCategoryIds.map((categoryId) => ({
              categoryId,
            })),
          }
        : undefined,
      platforms: dto.platforms
        ? {
            deleteMany: {},
            create: dto.platforms,
          }
        : undefined,
      searchTags: dto.searchTags
        ? {
            deleteMany: {},
            create: this.normalizeSearchTags(dto.searchTags).map((tag) => ({
              tag,
            })),
          }
        : undefined,
    };
  }

  private async resolveCreatorTaxonomy(
    dto: CreateCreatorDto | UpdateCreatorDto,
    requirePrimary: boolean,
  ) {
    const hasPrimaryInput =
      dto.primaryCategoryId !== undefined || dto.primaryNiche !== undefined;
    const hasSecondaryInput =
      dto.secondaryCategoryIds !== undefined || dto.secondaryNiches !== undefined;

    const primaryCategoryId = hasPrimaryInput
      ? await this.resolvePrimaryCategoryId(dto)
      : undefined;
    const secondaryCategoryIds = hasSecondaryInput
      ? await this.resolveSecondaryCategoryIds(dto)
      : undefined;

    if (requirePrimary && !primaryCategoryId) {
      throw new BadRequestException('Exactly one primary category is required');
    }

    if (secondaryCategoryIds && secondaryCategoryIds.length > 5) {
      throw new BadRequestException(
        'A creator can have at most five secondary categories',
      );
    }

    if (
      primaryCategoryId &&
      secondaryCategoryIds?.includes(primaryCategoryId)
    ) {
      throw new BadRequestException(
        'Primary category cannot also appear as a secondary category',
      );
    }

    return {
      primaryCategoryId,
      secondaryCategoryIds,
    };
  }

  private async resolvePrimaryCategoryId(dto: CreateCreatorDto | UpdateCreatorDto) {
    if (dto.primaryCategoryId && dto.primaryNiche) {
      const [byId, byName] = await Promise.all([
        this.getCategoryById(dto.primaryCategoryId),
        this.findCategoryByLegacyName(dto.primaryNiche),
      ]);

      if (!byName || byId.id !== byName.id) {
        throw new BadRequestException(
          'primaryCategoryId and primaryNiche reference different categories',
        );
      }

      return byId.id;
    }

    if (dto.primaryCategoryId) {
      return (await this.getCategoryById(dto.primaryCategoryId)).id;
    }

    if (dto.primaryNiche) {
      const category = await this.findCategoryByLegacyName(dto.primaryNiche);
      if (!category) {
        throw new BadRequestException(
          `No category matches legacy niche "${dto.primaryNiche}"`,
        );
      }

      return category.id;
    }

    return undefined;
  }

  private async resolveSecondaryCategoryIds(
    dto: CreateCreatorDto | UpdateCreatorDto,
  ) {
    const values =
      dto.secondaryCategoryIds ??
      (dto.secondaryNiches
        ? await Promise.all(
            dto.secondaryNiches.map(async (niche) => {
              const category = await this.findCategoryByLegacyName(niche);
              if (!category) {
                throw new BadRequestException(
                  `No category matches legacy niche "${niche}"`,
                );
              }
              return category.id;
            }),
          )
        : []);

    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length !== values.length) {
      throw new BadRequestException('Secondary categories cannot contain duplicates');
    }

    if (dto.secondaryCategoryIds) {
      const count = await this.prisma.category.count({
        where: {
          id: {
            in: uniqueValues,
          },
        },
      });

      if (count !== uniqueValues.length) {
        throw new BadRequestException('Secondary categories must all be valid');
      }
    }

    return uniqueValues;
  }

  private async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException(`Category "${id}" does not exist`);
    }

    return category;
  }

  private findCategoryByLegacyName(name: string) {
    return this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: name.trim(), mode: 'insensitive' } },
          {
            slug: {
              equals: name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, ''),
            },
          },
        ],
      },
      select: { id: true },
    });
  }

  private normalizeSearchTags(tags?: string[]) {
    return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  }
}
