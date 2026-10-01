import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SubscriptionGuard } from "../../subscriptions/guards/subscription.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { SubscriptionsService } from "../../subscriptions/services/subscriptions.service";
import { SearchQueryDto } from "../dto/search-query.dto";
import { SearchService } from "../services/search.service";

@ApiTags("Search")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller("search")
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Search creators with deterministic parsing and ranking" })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ) {
    const access = await this.subscriptionsService.consumeSearch(user.sub);
    const results = await this.searchService.search(query.query);

    if (access?.isTrial) {
      return results.slice(0, 10);
    }
    return results;
  }
}
