import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { CreateCampaignNoteDto } from '../dto/create-campaign-note.dto';
import { UpdateCampaignNoteDto } from '../dto/update-campaign-note.dto';
import { CampaignsService } from '../services/campaigns.service';

@ApiTags('Campaign Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller()
export class CampaignNotesController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post('campaigns/:campaignId/creators/:creatorId/notes')
  @ApiOperation({ summary: 'Add a note to a creator inside a campaign' })
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Param('creatorId') creatorId: string,
    @Body() dto: CreateCampaignNoteDto,
  ) {
    return this.campaignsService.createNote(user.sub, campaignId, creatorId, dto);
  }

  @Get('campaigns/:campaignId/creators/:creatorId/notes')
  @ApiOperation({ summary: 'Get notes for a creator inside a campaign' })
  findNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Param('creatorId') creatorId: string,
  ) {
    return this.campaignsService.getNotes(user.sub, campaignId, creatorId);
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Update a campaign creator note' })
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignNoteDto,
  ) {
    return this.campaignsService.updateNote(user.sub, id, dto);
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Delete a campaign creator note' })
  removeNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaignsService.removeNote(user.sub, id);
  }
}
