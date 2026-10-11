/**
 * Category Keyword Dictionary Tests
 */

import { suggestCategoryCode, CATEGORY_KEYWORD_DICTIONARY, wordsMatch } from '../categoryKeywordDictionary';

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
    expect(suggestCategoryCode('Call Billy, phone Billy about the visit')).toBeNull();
  });
});

describe('suggestCategoryCode plurals and expanded vocabulary', () => {
  it.each([
    ['dinners', 'FOOD'],
    ['Pizza', 'FOOD'],
    ['supper with friends', 'FOOD'],
    ['metro card', 'TRAVEL'],
    ['Wifi', 'UTILITIES'],
    ['mobile bill', 'UTILITIES'],
    ['hotels', 'ACCOMMODATION'],
    ['movies', 'ENTERTAINMENT'],
    ['ticket', 'ENTERTAINMENT'],
    ['new shoe', 'SHOPPING'],
  ])('should map "%s" to %s', (title, code) => {
    expect(suggestCategoryCode(title)).toBe(code);
  });

  it('should still not match "gasket" to "gas", and a plural gas bill still works', () => {
    expect(suggestCategoryCode('gaskets')).toBeNull();
    expect(suggestCategoryCode('gas bills')).toBe('UTILITIES');
  });

  it('should not match words that merely contain a keyword plus extra letters', () => {
    expect(wordsMatch('gasket', 'gas')).toBe(false);
  });

  it('should not list the same keyword (after plural normalisation) in two categories', () => {
    const owner = new Map<string, string>();
    for (const [code, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
      for (const keyword of keywords) {
        for (const [otherKeyword, otherCode] of owner) {
          if (otherCode !== code) {
            expect(wordsMatch(keyword, otherKeyword)).toBe(false);
          }
        }
      }
      keywords.forEach((k) => owner.set(k, code));
    }
  });
});
