import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  FlutterwaveInitializeResponse,
  FlutterwaveVerificationResponse,
} from '../interfaces/flutterwave.interface';

@Injectable()
export class PaymentsService {
  constructor(private readonly configService: ConfigService) {}

  async initializePayment(payload: {
    amount: number;
    email: string;
    fullName: string;
    reference: string;
    title: string;
  }): Promise<FlutterwaveInitializeResponse> {
    const secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    const redirectUrl = this.configService.get<string>('FLUTTERWAVE_REDIRECT_URL');
    const baseUrl = this.configService.getOrThrow<string>('FLUTTERWAVE_BASE_URL');

    if (!secretKey || !redirectUrl) {
      throw new InternalServerErrorException(
        'Flutterwave credentials are not configured',
      );
    }

    try {
      const response = await axios.post(
        `${baseUrl}/payments`,
        {
          tx_ref: payload.reference,
          amount: payload.amount,
          currency: 'USD',
          redirect_url: redirectUrl,
          customer: {
            email: payload.email,
            name: payload.fullName,
          },
          customizations: {
            title: payload.title,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );

      return {
        link: response.data?.data?.link,
        reference: payload.reference,
      };
    } catch (error) {
      throw new BadGatewayException('Unable to initialize Flutterwave payment');
    }
  }

  async verifyTransaction(
    transactionId: string,
  ): Promise<FlutterwaveVerificationResponse> {
    const secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    const baseUrl = this.configService.getOrThrow<string>('FLUTTERWAVE_BASE_URL');

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Flutterwave credentials are not configured',
      );
    }

    try {
      const response = await axios.get(
        `${baseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );

      const data = response.data?.data;

      return {
        status: data?.status,
        tx_ref: data?.tx_ref,
        id: data?.id,
        amount: data?.amount,
        currency: data?.currency,
      };
    } catch (error) {
      throw new BadGatewayException('Unable to verify Flutterwave transaction');
    }
  }
}
