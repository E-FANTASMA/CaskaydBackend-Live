import { ApiProperty } from '@nestjs/swagger';
import { SuggestionStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateCreatorSuggestionDto {
  @ApiProperty({ enum: SuggestionStatus })
  @IsNotEmpty()
  @IsEnum(SuggestionStatus)
  status: SuggestionStatus;
}
