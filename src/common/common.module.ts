import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RolesGuard } from './guards/roles.guard';
import { RedisService } from './services/redis.service';
import { QueueService } from './services/queue.service';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    RolesGuard,
    RedisService,
    QueueService,
  ],
  exports: [RolesGuard, RedisService, QueueService],
})
export class CommonModule {}
