import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CrawlerSchedulerTriggerDto {
  @ApiProperty({
    enum: ['discovery', 'large', 'medium', 'small'],
    description: 'Select which scheduler workflow to run immediately.',
  })
  @IsIn(['discovery', 'large', 'medium', 'small'])
  trigger: 'discovery' | 'large' | 'medium' | 'small';
}
