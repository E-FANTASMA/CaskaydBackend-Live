import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { slugifyCategoryName } from '../utils/slugify.util';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      include: {
        parent: true,
        children: true,
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    const byParent = new Map<string | null, typeof categories>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      const group = byParent.get(key) ?? [];
      group.push(category);
      byParent.set(key, group);
    }

    const buildNode = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: buildNode(category.id),
      }));

    return buildNode(null);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const parent = dto.parentId ? await this.getExistingCategory(dto.parentId) : null;
    const level = dto.level ?? (parent ? parent.level + 1 : 1);

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: await this.ensureUniqueSlug(dto.name),
        description: dto.description?.trim(),
        parentId: parent?.id,
        level,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getExistingCategory(id);
    const parent = dto.parentId ? await this.getExistingCategory(dto.parentId) : null;

    if (parent?.id === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    const level = dto.level ?? (dto.parentId !== undefined ? (parent ? parent.level + 1 : 1) : undefined);

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.name ? await this.ensureUniqueSlug(dto.name, id) : undefined,
        description: dto.description?.trim(),
        parentId: dto.parentId === undefined ? undefined : parent?.id ?? null,
        level,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    if (level !== undefined) {
      await this.syncChildLevels(updated.id, updated.level);
    }

    return updated;
  }

  async remove(id: string) {
    await this.getExistingCategory(id);

    const [childrenCount, primaryCount, secondaryCount, intentCount] =
      await Promise.all([
        this.prisma.category.count({ where: { parentId: id } }),
        this.prisma.creator.count({ where: { primaryCategoryId: id } }),
        this.prisma.creatorSecondaryCategory.count({ where: { categoryId: id } }),
        this.prisma.campaignIntentCategory.count({ where: { categoryId: id } }),
      ]);

    if (childrenCount || primaryCount || secondaryCount || intentCount) {
      throw new BadRequestException(
        'Category cannot be deleted while it is referenced by other records',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Category deleted successfully' };
  }

  private async getExistingCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async ensureUniqueSlug(name: string, currentId?: string) {
    const baseSlug = slugifyCategoryName(name);
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.category.findFirst({
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

  private async syncChildLevels(parentId: string, parentLevel: number) {
    const children = await this.prisma.category.findMany({
      where: { parentId },
      select: { id: true },
    });

    for (const child of children) {
      await this.prisma.category.update({
        where: { id: child.id },
        data: { level: parentLevel + 1 },
      });
      await this.syncChildLevels(child.id, parentLevel + 1);
    }
  }
}
