import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenizerService {
  tokenize(query: string) {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }
}
