import { Injectable } from '@nestjs/common';
import { SearchFilters } from '../interfaces/search-filter.interface';

const NICHE_SYNONYMS: Record<string, string> = {
  restaurant: 'food',
  chef: 'food',
  technology: 'tech',
  style: 'fashion',
};

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'linkedin'];
const GENDERS = ['male', 'female'];
const NIGERIAN_STATES = [
  'abia',
  'adamawa',
  'akwa ibom',
  'anambra',
  'bauchi',
  'bayelsa',
  'benue',
  'borno',
  'cross river',
  'delta',
  'ebonyi',
  'edo',
  'ekiti',
  'enugu',
  'gombe',
  'imo',
  'jigawa',
  'kaduna',
  'kano',
  'katsina',
  'kebbi',
  'kogi',
  'kwara',
  'lagos',
  'nasarawa',
  'niger',
  'ogun',
  'ondo',
  'osun',
  'oyo',
  'plateau',
  'rivers',
  'sokoto',
  'taraba',
  'yobe',
  'zamfara',
];

@Injectable()
export class DictionaryParser {
  parse(tokens: string[]): Omit<SearchFilters, 'followers'> {
    const normalizedTokens = tokens.map((token) => NICHE_SYNONYMS[token] ?? token);

    const niches = normalizedTokens.filter((token) =>
      ['food', 'tech', 'fashion', 'travel', 'beauty', 'fitness'].includes(token),
    );
    const locations = normalizedTokens.filter(
      (token) =>
        ['nigeria', 'abuja', 'ghana', 'kenya', 'london', 'usa'].includes(token) ||
        NIGERIAN_STATES.includes(token),
    );
    const gender = normalizedTokens.find((token) => GENDERS.includes(token));
    const platforms = normalizedTokens.filter((token) => PLATFORMS.includes(token));

    return {
      tokens: normalizedTokens,
      niches,
      locations,
      gender,
      platforms,
    };
  }
}
