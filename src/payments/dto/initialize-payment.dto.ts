import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InitializePaymentDto {
  @ApiPropertyOptional({ example: 2000, description: 'Payment amount in NGN (default: 2000)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ example: 'Caskayd Subscription', description: 'Payment title' })
  @IsOptional()
  @IsString()
  title?: string;
}
