import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FlutterwaveCardTokenDetails } from '../interfaces/flutterwave.interface';

@Injectable()
export class PaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  async saveCardToken(
    userId: string,
    cardData: FlutterwaveCardTokenDetails,
    provider = 'flutterwave',
  ) {
    if (!cardData?.token) {
      return null;
    }

    let expiryMonth: string | undefined;
    let expiryYear: string | undefined;

    if (cardData.expiry) {
      const parts = cardData.expiry.split('/');
      if (parts.length === 2) {
        expiryMonth = parts[0].trim();
        expiryYear = parts[1].trim();
      }
    }

    const existingToken = await this.prisma.paymentMethod.findFirst({
      where: {
        userId,
        token: cardData.token,
      },
    });

    if (existingToken) {
      return this.prisma.paymentMethod.update({
        where: { id: existingToken.id },
        data: {
          last4: cardData.last_4digits ?? existingToken.last4,
          cardType: cardData.type ?? existingToken.cardType,
          expiryMonth: expiryMonth ?? existingToken.expiryMonth,
          expiryYear: expiryYear ?? existingToken.expiryYear,
          updatedAt: new Date(),
        },
      });
    }

    const existingDefault = await this.prisma.paymentMethod.findFirst({
      where: { userId, isDefault: true },
    });

    const isDefault = !existingDefault;

    return this.prisma.paymentMethod.create({
      data: {
        userId,
        provider,
        token: cardData.token,
        last4: cardData.last_4digits,
        cardType: cardData.type,
        expiryMonth,
        expiryYear,
        isDefault,
      },
    });
  }

  async getDefaultPaymentMethod(userId: string) {
    return this.prisma.paymentMethod.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async getUserPaymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
