import { ApiProperty } from '@nestjs/swagger';
import { PlatformType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CrawlerRefreshDto {
  @ApiProperty()
  @IsString()
  creatorId: string;

  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  platform: PlatformType;
}
