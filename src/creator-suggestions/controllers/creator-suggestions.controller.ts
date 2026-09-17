import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateCreatorSuggestionDto } from '../dto/create-creator-suggestion.dto';
import { CreatorSuggestionsService } from '../services/creator-suggestions.service';

@ApiTags('Creator Suggestions')
@Controller('creator-suggestions')
export class CreatorSuggestionsController {
  constructor(
    private readonly creatorSuggestionsService: CreatorSuggestionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new creator suggestion' })
  create(@Body() dto: CreateCreatorSuggestionDto) {
    return this.creatorSuggestionsService.create(dto);
  }
}
