import { DictionaryParser } from './dictionary-parser.service';

describe('DictionaryParser', () => {
  it('recognizes Nigerian states in a location search', () => {
    const parser = new DictionaryParser();

    expect(parser.parse(['ogun', 'state']).locations).toEqual(['ogun']);
  });
});