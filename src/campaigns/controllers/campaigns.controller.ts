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
import { AddCampaignCreatorDto } from '../dto/add-campaign-creator.dto';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignCreatorStatusDto } from '../dto/update-campaign-creator-status.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { CampaignsService } from '../services/campaigns.service';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user campaigns' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by id' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaignsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaignsService.remove(user.sub, id);
  }

  @Post(':id/creators')
  @ApiOperation({ summary: 'Add a creator to a campaign' })
  addCreator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddCampaignCreatorDto,
  ) {
    return this.campaignsService.addCreator(user.sub, id, dto);
  }

  @Delete(':id/creators/:creatorId')
  @ApiOperation({ summary: 'Remove a creator from a campaign' })
  removeCreator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('creatorId') creatorId: string,
  ) {
    return this.campaignsService.removeCreator(user.sub, id, creatorId);
  }

  @Patch(':id/creators/:creatorId/status')
  @ApiOperation({ summary: 'Update creator workflow status in a campaign' })
  updateCreatorStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('creatorId') creatorId: string,
    @Body() dto: UpdateCampaignCreatorStatusDto,
  ) {
    return this.campaignsService.updateCreatorStatus(user.sub, id, creatorId, dto);
  }
}
