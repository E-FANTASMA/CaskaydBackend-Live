import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { QueryCreatorsDto } from '../dto/query-creators.dto';
import { UpdateCreatorDto } from '../dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCreatorDto) {
    return this.prisma.creator.create({
      data: {
        name: dto.name,
        gender: dto.gender,
        country: dto.country,
        state: dto.state,
        primaryNiche: dto.primaryNiche,
        secondaryNiches: dto.secondaryNiches,
        businessEmail: dto.businessEmail,
        profileImage: dto.profileImage,
        platforms: dto.platforms?.length
          ? {
              create: dto.platforms,
            }
          : undefined,
        searchTags: dto.searchTags?.length
          ? {
              create: dto.searchTags.map((tag) => ({ tag })),
            }
          : undefined,
      },
      include: {
        platforms: true,
        searchTags: true,
      },
    });
  }

  async findAll(query: QueryCreatorsDto) {
    const where: Prisma.CreatorWhereInput = {
      AND: [
        query.niche
          ? {
              OR: [
                { primaryNiche: { contains: query.niche, mode: 'insensitive' } },
                { secondaryNiches: { has: query.niche } },
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

    return this.prisma.creator.findMany({
      where,
      include: {
        platforms: true,
        searchTags: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      include: {
        platforms: true,
        searchTags: true,
      },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return creator;
  }

  async update(id: string, dto: UpdateCreatorDto) {
    await this.findOne(id);

    return this.prisma.creator.update({
      where: { id },
      data: {
        name: dto.name,
        gender: dto.gender,
        country: dto.country,
        state: dto.state,
        primaryNiche: dto.primaryNiche,
        secondaryNiches: dto.secondaryNiches,
        businessEmail: dto.businessEmail,
        profileImage: dto.profileImage,
        platforms: dto.platforms
          ? {
              deleteMany: {},
              create: dto.platforms,
            }
          : undefined,
        searchTags: dto.searchTags
          ? {
              deleteMany: {},
              create: dto.searchTags.map((tag) => ({ tag })),
            }
          : undefined,
      },
      include: {
        platforms: true,
        searchTags: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.creator.delete({ where: { id } });
    return { message: 'Creator deleted successfully' };
  }
}
