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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { CreateCampaignIntentDto } from '../dto/create-campaign-intent.dto';
import { UpdateCampaignIntentDto } from '../dto/update-campaign-intent.dto';
import { CampaignIntentsService } from '../services/campaign-intents.service';

@ApiTags('Campaign Intents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('campaign-intents')
export class CampaignIntentsController {
  constructor(
    private readonly campaignIntentsService: CampaignIntentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List campaign intents' })
  findAll() {
    return this.campaignIntentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign intent by id' })
  findOne(@Param('id') id: string) {
    return this.campaignIntentsService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a campaign intent' })
  create(@Body() dto: CreateCampaignIntentDto) {
    return this.campaignIntentsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update a campaign intent' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignIntentDto) {
    return this.campaignIntentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete a campaign intent' })
  remove(@Param('id') id: string) {
    return this.campaignIntentsService.remove(id);
  }
}
