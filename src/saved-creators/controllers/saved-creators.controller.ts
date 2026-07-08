import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { SaveCreatorDto } from '../dto/save-creator.dto';
import { SavedCreatorsService } from '../services/saved-creators.service';

@ApiTags('Saved Creators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('saved-creators')
export class SavedCreatorsController {
  constructor(private readonly savedCreatorsService: SavedCreatorsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a creator' })
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveCreatorDto) {
    return this.savedCreatorsService.save(user.sub, dto.creatorId);
  }

  @Delete(':creatorId')
  @ApiOperation({ summary: 'Remove a saved creator' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('creatorId') creatorId: string,
  ) {
    return this.savedCreatorsService.remove(user.sub, creatorId);
  }

  @Get()
  @ApiOperation({ summary: 'List saved creators' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.savedCreatorsService.findAll(user.sub);
  }
}
