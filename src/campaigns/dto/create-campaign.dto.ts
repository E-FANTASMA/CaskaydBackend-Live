import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;
}
