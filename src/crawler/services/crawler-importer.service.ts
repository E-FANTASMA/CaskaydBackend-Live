import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { CreatorImportRecord } from '../interfaces/import-record.interface';
import { ImportCreatorsDto } from '../dto/import-creators.dto';
import { CrawlerPipelineService } from './crawler-pipeline.service';

@Injectable()
export class CrawlerImporterService {
  constructor(private readonly pipeline: CrawlerPipelineService) {}

  async importCsv(filePath: string, options: ImportCreatorsDto = {}) {
    const content = await fs.readFile(filePath, 'utf8');
    const records = this.parseCsv(content);
    return this.ingestRecords(records, options);
  }

  async importJson(filePath: string, options: ImportCreatorsDto = {}) {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    const records = Array.isArray(parsed) ? (parsed as CreatorImportRecord[]) : [];
    return this.ingestRecords(records, options);
  }

  private async ingestRecords(records: CreatorImportRecord[], options: ImportCreatorsDto) {
    const summary = {
      source: options.source ?? 'manual',
      total: records.length,
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [index, record] of records.entries()) {
      try {
        if (!options.dryRun) {
          await this.pipeline.ingest(record);
        }
        summary.imported += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push(
          `Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return summary;
  }

  private parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }

      value += char;
    }

    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }

    const [header = [], ...body] = rows;
    return body
      .filter((columns) => columns.some((column) => column.trim()))
      .map((columns) =>
        header.reduce<CreatorImportRecord>((record, column, index) => {
          record[column.trim()] = columns[index]?.trim() ?? '';
          return record;
        }, {}),
      );
  }
}
