import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddCampaignCreatorDto {
  @ApiProperty()
  @IsString()
  creatorId: string;
}
