import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  FlutterwaveInitializeResponse,
  FlutterwavePaymentPlanResponse,
  FlutterwaveSubscriptionResponse,
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
    paymentPlanId?: number;
  }): Promise<FlutterwaveInitializeResponse> {
    const { secretKey, redirectUrl, baseUrl } = this.getPaymentConfig();

    try {
      const response = await axios.post(
        `${baseUrl}/payments`,
        {
          tx_ref: payload.reference,
          amount: payload.amount,
          currency: 'NGN',
          redirect_url: redirectUrl,
          payment_plan: payload.paymentPlanId,
          payment_options: 'card',
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

  async ensureMonthlyPaymentPlan(payload: {
    amount: number;
    name: string;
  }): Promise<number> {
    const { secretKey, baseUrl } = this.getSecretKeyAndBaseUrl();

    try {
      const existingPlansResponse = await axios.get(`${baseUrl}/payment-plans`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        params: {
          amount: payload.amount,
          currency: 'NGN',
          interval: 'monthly',
          status: 'active',
        },
      });

      const existingPlan = (
        Array.isArray(existingPlansResponse.data?.data)
          ? existingPlansResponse.data.data
          : []
      ).find((plan: FlutterwavePaymentPlanResponse) => plan.name === payload.name);

      if (existingPlan?.id) {
        return existingPlan.id;
      }

      const createPlanResponse = await axios.post(
        `${baseUrl}/payment-plans`,
        {
          amount: payload.amount,
          name: payload.name,
          interval: 'monthly',
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );

      const paymentPlanId = createPlanResponse.data?.data?.id;
      if (!paymentPlanId) {
        throw new Error('Missing payment plan id');
      }

      return paymentPlanId;
    } catch (error) {
      throw new BadGatewayException('Unable to prepare Flutterwave payment plan');
    }
  }

  async verifyTransaction(
    transactionId: string,
  ): Promise<FlutterwaveVerificationResponse> {
    const { secretKey, baseUrl } = this.getSecretKeyAndBaseUrl();

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

  async findSubscription(options: {
    transactionId?: number | string;
    email?: string;
    planId?: number;
  }): Promise<FlutterwaveSubscriptionResponse | null> {
    const { secretKey, baseUrl } = this.getSecretKeyAndBaseUrl();

    try {
      const response = await axios.get(`${baseUrl}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        params: {
          transaction_id: options.transactionId,
          email: options.email,
          plan: options.planId,
        },
      });

      const subscriptions = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      return subscriptions[0] ?? null;
    } catch (error) {
      throw new BadGatewayException('Unable to fetch Flutterwave subscription');
    }
  }

  async cancelSubscription(subscriptionId: number): Promise<void> {
    const { secretKey, baseUrl } = this.getSecretKeyAndBaseUrl();

    try {
      await axios.put(
        `${baseUrl}/subscriptions/${subscriptionId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );
    } catch (error) {
      throw new BadGatewayException('Unable to cancel Flutterwave subscription');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature?: string): boolean {
    const secretHash = this.configService.get<string>(
      'FLUTTERWAVE_WEBHOOK_SECRET_HASH',
    );

    if (!secretHash) {
      throw new InternalServerErrorException(
        'Flutterwave webhook secret hash is not configured',
      );
    }

    if (!signature) {
      return false;
    }

    const digest = crypto
      .createHmac('sha256', secretHash)
      .update(rawBody)
      .digest('base64');

    return digest === signature;
  }

  private getSecretKeyAndBaseUrl() {
    const secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    const baseUrl = this.configService.getOrThrow<string>('FLUTTERWAVE_BASE_URL');

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Flutterwave credentials are not configured',
      );
    }

    return { secretKey, baseUrl };
  }

  private getPaymentConfig() {
    const { secretKey, baseUrl } = this.getSecretKeyAndBaseUrl();
    const redirectUrl = this.configService.get<string>('FLUTTERWAVE_REDIRECT_URL');

    if (!redirectUrl) {
      throw new InternalServerErrorException(
        'Flutterwave credentials are not configured',
      );
    }

    return { secretKey, redirectUrl, baseUrl };
  }
}
