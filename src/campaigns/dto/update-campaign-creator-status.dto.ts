import { ApiProperty } from '@nestjs/swagger';
import { CampaignCreatorStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCampaignCreatorStatusDto {
  @ApiProperty({ enum: CampaignCreatorStatus })
  @IsEnum(CampaignCreatorStatus)
  status: CampaignCreatorStatus;
}
