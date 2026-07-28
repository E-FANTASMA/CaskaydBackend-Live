import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CrawlerDiscoveryDto } from '../dto/crawler-discovery.dto';
import { CrawlerImportFileDto } from '../dto/crawler-import-file.dto';
import { CrawlerRefreshDto } from '../dto/crawler-refresh.dto';
import { CrawlerSchedulerTriggerDto } from '../dto/crawler-scheduler-trigger.dto';
import { CrawlerImporterService } from '../services/crawler-importer.service';
import { CrawlerQueueService } from '../services/crawler-queue.service';
import { CrawlerSchedulerService } from '../services/crawler-scheduler.service';

@ApiTags('Crawler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crawler')
export class CrawlerController {
  constructor(
    private readonly crawlerQueueService: CrawlerQueueService,
    private readonly crawlerImporterService: CrawlerImporterService,
    private readonly crawlerSchedulerService: CrawlerSchedulerService,
  ) {}

  @Get('scheduler')
  @ApiOperation({ summary: 'Inspect crawler scheduler entry points' })
  getSchedulerOverview() {
    return {
      file: 'src/crawler/services/crawler-scheduler.service.ts',
      cronJobs: [
        {
          method: 'scheduleDailyDiscovery',
          cron: '0 0 2 * * *',
          purpose: 'Enqueue discovery jobs for all supported platforms every day at 02:00',
        },
        {
          method: 'scheduleLargeCreatorRefresh',
          cron: '0 0 3 * * *',
          purpose: 'Refresh large creators daily at 03:00',
        },
        {
          method: 'scheduleMediumCreatorRefresh',
          cron: '0 0 4 * * 1',
          purpose: 'Refresh medium creators every Monday at 04:00',
        },
        {
          method: 'scheduleSmallCreatorRefresh',
          cron: '0 0 5 1 * *',
          purpose: 'Refresh small creators on day 1 of each month at 05:00',
        },
      ],
    };
  }

  @Post('discovery')
  @ApiOperation({ summary: 'Queue a crawler discovery job' })
  async enqueueDiscovery(@Body() dto: CrawlerDiscoveryDto) {
    const job = await this.crawlerQueueService.enqueueDiscovery(
      dto.platform,
      dto.keywords,
      dto.limit ?? 10,
    );

    return {
      message: 'Discovery job queued',
      jobId: job.id,
      queue: job.queueName,
      payload: job.data,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Queue a crawler refresh job for an existing creator' })
  async enqueueRefresh(@Body() dto: CrawlerRefreshDto) {
    const job = await this.crawlerQueueService.enqueueRefresh(
      dto.creatorId,
      dto.platform,
    );

    return {
      message: 'Refresh job queued',
      jobId: job.id,
      queue: job.queueName,
      payload: job.data,
    };
  }

  @Post('import/csv')
  @ApiOperation({ summary: 'Import creators from CSV through the crawler pipeline' })
  importCsv(@Body() dto: CrawlerImportFileDto) {
    return this.crawlerImporterService.importCsv(dto.filePath, {
      source: 'swagger-csv',
      dryRun: dto.dryRun,
    });
  }

  @Post('import/json')
  @ApiOperation({ summary: 'Import creators from JSON through the crawler pipeline' })
  importJson(@Body() dto: CrawlerImportFileDto) {
    return this.crawlerImporterService.importJson(dto.filePath, {
      source: 'swagger-json',
      dryRun: dto.dryRun,
    });
  }

  @Post('scheduler/run')
  @ApiOperation({ summary: 'Run one scheduler workflow immediately for testing' })
  async runScheduler(@Body() dto: CrawlerSchedulerTriggerDto) {
    switch (dto.trigger) {
      case 'discovery':
        await this.crawlerSchedulerService.scheduleDailyDiscovery();
        break;
      case 'large':
        await this.crawlerSchedulerService.scheduleLargeCreatorRefresh();
        break;
      case 'medium':
        await this.crawlerSchedulerService.scheduleMediumCreatorRefresh();
        break;
      case 'small':
        await this.crawlerSchedulerService.scheduleSmallCreatorRefresh();
        break;
    }

    return {
      message: `Scheduler trigger "${dto.trigger}" executed`,
      schedulerFile: 'src/crawler/services/crawler-scheduler.service.ts',
    };
  }
}
