import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({ example: '1234567', description: 'Flutterwave transaction ID' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;
}
