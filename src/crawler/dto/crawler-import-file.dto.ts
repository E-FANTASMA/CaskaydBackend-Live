import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CrawlerImportFileDto {
  @ApiProperty({
    example: 'C:\\\\Users\\\\ojoje\\\\Downloads\\\\creators.csv',
    description: 'Absolute or repo-relative path to the import file.',
  })
  @IsString()
  filePath: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
