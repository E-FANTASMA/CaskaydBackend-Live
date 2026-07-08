import { PartialType } from '@nestjs/swagger';
import { CreateCampaignNoteDto } from './create-campaign-note.dto';

export class UpdateCampaignNoteDto extends PartialType(CreateCampaignNoteDto) {}
