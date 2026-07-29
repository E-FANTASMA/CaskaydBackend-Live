import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST')?.trim();
    this.enabled = Boolean(host);

    if (!this.enabled) {
      this.client = null;
      this.logger.log('Redis is disabled because REDIS_HOST is not configured');
      return;
    }

    const options: RedisOptions = {
      host,
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.getOrThrow<number>('REDIS_DB'),
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };

    this.client = new Redis(options);
    this.client.on('error', (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  getClient() {
    return this.client;
  }

  isEnabled() {
    return this.enabled;
  }

  async onModuleDestroy() {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
