import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { CreatorPlatformDto } from './creator-platform.dto';

export class CreateCreatorDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Normalized primary category id. Preferred over legacy primaryNiche.',
  })
  @IsOptional()
  @IsString()
  primaryCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Legacy field kept for backwards compatibility.',
  })
  @IsOptional()
  @IsString()
  primaryNiche?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Normalized secondary category ids.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  secondaryCategoryIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Legacy field kept for backwards compatibility.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  secondaryNiches?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  searchTags?: string[];

  @ApiPropertyOptional({ type: [CreatorPlatformDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatorPlatformDto)
  platforms?: CreatorPlatformDto[];
}
