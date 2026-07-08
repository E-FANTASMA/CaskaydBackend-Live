import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SavedCreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  save(userId: string, creatorId: string) {
    return this.prisma.savedCreator.upsert({
      where: {
        userId_creatorId: {
          userId,
          creatorId,
        },
      },
      create: {
        userId,
        creatorId,
      },
      update: {},
      include: {
        creator: true,
      },
    });
  }

  async remove(userId: string, creatorId: string) {
    await this.prisma.savedCreator.delete({
      where: {
        userId_creatorId: {
          userId,
          creatorId,
        },
      },
    });

    return { message: 'Saved creator removed successfully' };
  }

  findAll(userId: string) {
    return this.prisma.savedCreator.findMany({
      where: { userId },
      include: {
        creator: {
          include: {
            platforms: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
