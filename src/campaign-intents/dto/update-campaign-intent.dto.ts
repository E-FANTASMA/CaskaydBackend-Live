import { PartialType } from '@nestjs/swagger';
import { CreateCampaignIntentDto } from './create-campaign-intent.dto';

export class UpdateCampaignIntentDto extends PartialType(
  CreateCampaignIntentDto,
) {}
