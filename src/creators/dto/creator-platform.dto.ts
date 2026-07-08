import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreatorPlatformDto {
  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  platform: PlatformType;

  @ApiProperty()
  @IsString()
  handle: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  followers: number;

  @ApiProperty()
  @IsBoolean()
  verified: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  profileUrl?: string;
}
