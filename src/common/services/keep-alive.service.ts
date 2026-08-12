import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private readonly enabled: boolean;
  private readonly keepAliveUrl?: string;
  private hasWarnedMissingUrl = false;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('KEEP_ALIVE_ENABLED') === true;

    const explicitUrl = this.configService.get<string>('KEEP_ALIVE_URL');
    const renderUrl = this.configService.get<string>('RENDER_EXTERNAL_URL');

    this.keepAliveUrl =
      explicitUrl || (renderUrl ? `${renderUrl.replace(/\/$/, '')}/api/health` : undefined);
  }

  @Cron('0 */10 * * * *')
  async pingHealthEndpoint() {
    if (!this.enabled) {
      return;
    }

    if (!this.keepAliveUrl) {
      if (!this.hasWarnedMissingUrl) {
        this.logger.warn(
          'KEEP_ALIVE_ENABLED is true but no KEEP_ALIVE_URL or RENDER_EXTERNAL_URL is configured.',
        );
        this.hasWarnedMissingUrl = true;
      }
      return;
    }

    try {
      await axios.get(this.keepAliveUrl, {
        timeout: 10_000,
        headers: {
          'user-agent': 'CaskaydBackendKeepAlive/1.0',
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown keep-alive request error';
      this.logger.warn(`Keep-alive ping failed: ${message}`);
    }
  }
}
