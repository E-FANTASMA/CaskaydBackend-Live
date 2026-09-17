import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { PaymentsService } from './payments.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentsService', () => {
  let service: PaymentsService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FLUTTERWAVE_SECRET_KEY') return 'FLWSECK_TEST-123';
              if (key === 'FLUTTERWAVE_REDIRECT_URL') return 'https://example.com/callback';
              if (key === 'FLUTTERWAVE_WEBHOOK_SECRET_HASH') return 'my-secret-hash';
              return null;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'FLUTTERWAVE_BASE_URL') return 'https://api.flutterwave.com/v3';
              throw new Error(`Missing key ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it('should initialize payment URL successfully', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          link: 'https://checkout.flutterwave.com/v3/hosted/pay/123456',
        },
      },
    });

    const result = await service.initializePayment({
      amount: 2000,
      email: 'test@example.com',
      fullName: 'Test User',
      reference: 'ref-123',
      title: 'Caskayd Payment',
    });

    expect(result.link).toBe('https://checkout.flutterwave.com/v3/hosted/pay/123456');
    expect(result.reference).toBe('ref-123');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.objectContaining({
        amount: 2000,
        currency: 'NGN',
        tx_ref: 'ref-123',
      }),
      expect.anything(),
    );
  });

  it('should verify transaction and extract card token details', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: {
          id: 12345,
          status: 'successful',
          tx_ref: 'ref-123',
          amount: 2000,
          currency: 'NGN',
          card: {
            token: 'flw-t12-sample-token',
            last_4digits: '4242',
            type: 'VISA',
            expiry: '12/28',
          },
        },
      },
    });

    const verification = await service.verifyTransaction('12345');

    expect(verification.status).toBe('successful');
    expect(verification.amount).toBe(2000);
    expect(verification.currency).toBe('NGN');
    expect(verification.card?.token).toBe('flw-t12-sample-token');
    expect(verification.card?.last_4digits).toBe('4242');
  });

  it('should charge card token successfully', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Charge successful',
        data: {
          id: 67890,
          tx_ref: 'ref-token-123',
          status: 'successful',
          amount: 2000,
          currency: 'NGN',
        },
      },
    });

    const response = await service.chargeToken({
      token: 'flw-t12-sample-token',
      amount: 2000,
      currency: 'NGN',
      email: 'test@example.com',
      tx_ref: 'ref-token-123',
    });

    expect(response.status).toBe('success');
    expect(response.data?.status).toBe('successful');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/tokenized-charges',
      expect.objectContaining({
        token: 'flw-t12-sample-token',
        amount: 2000,
        currency: 'NGN',
      }),
      expect.anything(),
    );
  });
});
