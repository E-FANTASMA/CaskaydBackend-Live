import { ApiPropertyOptional } from '@nestjs/swagger';
import { SuggestionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryCreatorSuggestionsDto {
  @ApiPropertyOptional({ enum: SuggestionStatus })
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;
}
