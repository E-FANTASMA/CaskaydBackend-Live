import { Injectable } from '@nestjs/common';
import { NumericRange } from '../interfaces/search-filter.interface';

@Injectable()
export class RegexParser {
  parse(query: string): NumericRange | undefined {
    const normalized = query.toLowerCase();

    const betweenMatch = normalized.match(/between\s+(\d+)(k|m)?\s+and\s+(\d+)(k|m)?/);
    if (betweenMatch) {
      return {
        min: this.toAbsoluteNumber(betweenMatch[1], betweenMatch[2]),
        max: this.toAbsoluteNumber(betweenMatch[3], betweenMatch[4]),
      };
    }

    const underMatch = normalized.match(/under\s+(\d+)(k|m)?/);
    if (underMatch) {
      return {
        max: this.toAbsoluteNumber(underMatch[1], underMatch[2]),
      };
    }

    const aboveMatch = normalized.match(/(above|over)\s+(\d+)(k|m)?/);
    if (aboveMatch) {
      return {
        min: this.toAbsoluteNumber(aboveMatch[2], aboveMatch[3]),
      };
    }

    return undefined;
  }

  private toAbsoluteNumber(value: string, suffix?: string) {
    const numericValue = Number(value);
    if (suffix === 'm') {
      return numericValue * 1_000_000;
    }
    if (suffix === 'k') {
      return numericValue * 1_000;
    }

    return numericValue;
  }
}
