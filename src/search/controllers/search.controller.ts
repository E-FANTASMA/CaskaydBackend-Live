import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchService } from '../services/search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search creators with deterministic parsing and ranking' })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.query);
  }
}
