import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly configService: ConfigService) {}

  getQueue(name: string) {
    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: {
            host: this.configService.getOrThrow<string>('REDIS_HOST'),
            port: this.configService.getOrThrow<number>('REDIS_PORT'),
            password:
              this.configService.get<string>('REDIS_PASSWORD') || undefined,
            db: this.configService.getOrThrow<number>('REDIS_DB'),
          },
        }),
      );
    }

    return this.queues.get(name)!;
  }

  async onModuleDestroy() {
    await Promise.all(
      [...this.queues.values()].map(async (queue) => {
        await queue.close();
      }),
    );
  }
}
