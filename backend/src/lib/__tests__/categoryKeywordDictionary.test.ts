/**
 * Category Keyword Dictionary Tests
 */

import { suggestCategoryCode } from '../categoryKeywordDictionary';

describe('suggestCategoryCode', () => {
  it('should resolve a title containing "gas station" to the transport-equivalent category code (AE3)', () => {
    expect(suggestCategoryCode('Gas station fill-up')).toBe('TRAVEL');
  });

  it('should return null when the title has no dictionary keyword', () => {
    expect(suggestCategoryCode('Unrelated title xyz')).toBeNull();
  });

  it('should return null for an empty title rather than throwing', () => {
    expect(() => suggestCategoryCode('')).not.toThrow();
    expect(suggestCategoryCode('')).toBeNull();
  });

  it('should match case-insensitively', () => {
    expect(suggestCategoryCode('COFFEE with a friend')).toBe('FOOD');
  });

  it('should match whole words only, not substrings ("gasket" must not match "gas")', () => {
    expect(suggestCategoryCode('Replaced a gasket')).toBeNull();
  });

  it('should prefer a multi-word keyword ("gas bill") over a shorter single-word keyword ("gas") it contains', () => {
    expect(suggestCategoryCode('Gas bill for March')).toBe('UTILITIES');
  });

  it('should match multi-word keywords on whole-word boundaries only, not as a raw substring ("phone bill" must not match "phone Billy")', () => {
    expect(suggestCategoryCode('Call Billy, phone Billy about the trip')).toBeNull();
  });
});
