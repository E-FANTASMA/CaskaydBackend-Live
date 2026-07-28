import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformType } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CrawlerDiscoveryDto {
  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  platform: PlatformType;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional seed keywords for mocked discovery providers.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
