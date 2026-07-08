import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCampaignCreatorDto } from '../dto/add-campaign-creator.dto';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { CreateCampaignNoteDto } from '../dto/create-campaign-note.dto';
import { UpdateCampaignCreatorStatusDto } from '../dto/update-campaign-creator-status.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { UpdateCampaignNoteDto } from '../dto/update-campaign-note.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        userId,
        name: dto.name,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.campaign.findMany({
      where: { userId },
      include: {
        campaignCreators: {
          include: {
            creator: true,
            notes: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        campaignCreators: {
          include: {
            creator: {
              include: {
                platforms: true,
              },
            },
            notes: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOne(userId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { message: 'Campaign deleted successfully' };
  }

  async addCreator(userId: string, campaignId: string, dto: AddCampaignCreatorDto) {
    await this.findOne(userId, campaignId);

    return this.prisma.campaignCreator.upsert({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId: dto.creatorId,
        },
      },
      create: {
        campaignId,
        creatorId: dto.creatorId,
      },
      update: {},
    });
  }

  async removeCreator(userId: string, campaignId: string, creatorId: string) {
    await this.findOne(userId, campaignId);
    await this.prisma.campaignCreator.delete({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId,
        },
      },
    });
    return { message: 'Creator removed from campaign successfully' };
  }

  async updateCreatorStatus(
    userId: string,
    campaignId: string,
    creatorId: string,
    dto: UpdateCampaignCreatorStatusDto,
  ) {
    await this.findOne(userId, campaignId);
    return this.prisma.campaignCreator.update({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId,
        },
      },
      data: {
        status: dto.status,
      },
    });
  }

  async createNote(
    userId: string,
    campaignId: string,
    creatorId: string,
    dto: CreateCampaignNoteDto,
  ) {
    await this.findOne(userId, campaignId);
    return this.prisma.campaignCreatorNote.create({
      data: {
        campaignId,
        creatorId,
        note: dto.note,
      },
    });
  }

  async getNotes(userId: string, campaignId: string, creatorId: string) {
    await this.findOne(userId, campaignId);
    return this.prisma.campaignCreatorNote.findMany({
      where: {
        campaignId,
        creatorId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateNote(userId: string, noteId: string, dto: UpdateCampaignNoteDto) {
    const note = await this.prisma.campaignCreatorNote.findUnique({
      where: { id: noteId },
      include: {
        campaignCreator: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!note || note.campaignCreator.campaign.userId !== userId) {
      throw new NotFoundException('Note not found');
    }

    return this.prisma.campaignCreatorNote.update({
      where: { id: noteId },
      data: dto,
    });
  }

  async removeNote(userId: string, noteId: string) {
    const note = await this.prisma.campaignCreatorNote.findUnique({
      where: { id: noteId },
      include: {
        campaignCreator: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!note || note.campaignCreator.campaign.userId !== userId) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.campaignCreatorNote.delete({ where: { id: noteId } });
    return { message: 'Note deleted successfully' };
  }
}
