import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { slugifyCategoryName } from '../../categories/utils/slugify.util';
import { CreateCampaignIntentDto } from '../dto/create-campaign-intent.dto';
import { UpdateCampaignIntentDto } from '../dto/update-campaign-intent.dto';

@Injectable()
export class CampaignIntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const intents = await this.prisma.campaignIntent.findMany({
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: true,
      },
      orderBy: { name: 'asc' },
    });

    return intents.map((intent) => this.serializeIntent(intent));
  }

  async findOne(id: string) {
    const intent = await this.prisma.campaignIntent.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: true,
      },
    });

    if (!intent) {
      throw new NotFoundException('Campaign intent not found');
    }

    return this.serializeIntent(intent);
  }

  async create(dto: CreateCampaignIntentDto) {
    await this.assertValidCategoryIds(dto.categoryIds);

    const created = await this.prisma.campaignIntent.create({
      data: {
        name: dto.name.trim(),
        slug: await this.ensureUniqueSlug(dto.name),
        description: dto.description?.trim(),
        categories: {
          create: this.uniqueStrings(dto.categoryIds).map((categoryId) => ({
            categoryId,
          })),
        },
        tags: {
          create: this.normalizeTags(dto.tags).map((tag) => ({
            tag,
          })),
        },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: true,
      },
    });

    return this.serializeIntent(created);
  }

  async update(id: string, dto: UpdateCampaignIntentDto) {
    await this.findOne(id);
    if (dto.categoryIds) {
      await this.assertValidCategoryIds(dto.categoryIds);
    }

    const updated = await this.prisma.campaignIntent.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.name ? await this.ensureUniqueSlug(dto.name, id) : undefined,
        description: dto.description?.trim(),
        categories: dto.categoryIds
          ? {
              deleteMany: {},
              create: this.uniqueStrings(dto.categoryIds).map((categoryId) => ({
                categoryId,
              })),
            }
          : undefined,
        tags: dto.tags
          ? {
              deleteMany: {},
              create: this.normalizeTags(dto.tags).map((tag) => ({
                tag,
              })),
            }
          : undefined,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: true,
      },
    });

    return this.serializeIntent(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.campaignIntent.delete({ where: { id } });
    return { message: 'Campaign intent deleted successfully' };
  }

  private async assertValidCategoryIds(categoryIds: string[]) {
    const uniqueCategoryIds = this.uniqueStrings(categoryIds);
    if (!uniqueCategoryIds.length) {
      throw new BadRequestException(
        'Campaign intent must reference at least one category',
      );
    }

    const count = await this.prisma.category.count({
      where: {
        id: {
          in: uniqueCategoryIds,
        },
      },
    });

    if (count !== uniqueCategoryIds.length) {
      throw new BadRequestException(
        'Campaign intent mappings must reference valid categories',
      );
    }
  }

  private normalizeTags(tags: string[]) {
    return this.uniqueStrings(tags.map((tag) => tag.trim().toLowerCase())).filter(
      Boolean,
    );
  }

  private uniqueStrings(values: string[]) {
    return [...new Set(values)];
  }

  private serializeIntent(intent: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    categories: { category: { id: string; name: string; slug: string } }[];
    tags: { tag: string }[];
  }) {
    return {
      ...intent,
      categories: intent.categories.map(({ category }) => category),
      categoryIds: intent.categories.map(({ category }) => category.id),
      tags: intent.tags.map(({ tag }) => tag),
    };
  }

  private async ensureUniqueSlug(name: string, currentId?: string) {
    const baseSlug = slugifyCategoryName(name);
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.campaignIntent.findFirst({
        where: {
          slug,
          ...(currentId ? { NOT: { id: currentId } } : {}),
        },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }
}
