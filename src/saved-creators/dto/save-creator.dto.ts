import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SaveCreatorDto {
  @ApiProperty()
  @IsString()
  creatorId: string;
}
