import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryCreatorSuggestionsDto } from '../dto/query-creator-suggestions.dto';
import { UpdateCreatorSuggestionDto } from '../dto/update-creator-suggestion.dto';
import { CreatorSuggestionsService } from '../services/creator-suggestions.service';

@ApiTags('Admin Creator Suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'ADMIN')
@Controller('admin/creator-suggestions')
export class AdminCreatorSuggestionsController {
  constructor(
    private readonly creatorSuggestionsService: CreatorSuggestionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List creator suggestions for admin review' })
  findAll(@Query() query: QueryCreatorSuggestionsDto) {
    return this.creatorSuggestionsService.findAllAdmin(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update creator suggestion status (approve or reject)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCreatorSuggestionDto,
  ) {
    return this.creatorSuggestionsService.updateStatusAdmin(id, dto);
  }
}
