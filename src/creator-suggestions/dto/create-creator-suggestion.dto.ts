import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCreatorSuggestionDto {
  @ApiProperty({ description: 'Name of the creator' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Username / handle of the creator' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ description: 'Platform of the creator (e.g. Instagram, TikTok, YouTube)' })
  @IsNotEmpty()
  @IsString()
  platform: string;

  @ApiPropertyOptional({ description: 'Link to the creator profile' })
  @IsOptional()
  @IsUrl()
  link?: string;
}
