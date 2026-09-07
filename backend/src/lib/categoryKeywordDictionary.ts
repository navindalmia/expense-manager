/**
 * Category Keyword Dictionary
 *
 * Plain data + a pure lookup function mapping expense-title keywords to
 * category codes (R8, KTD3). Matching is case-insensitive, whole-word only
 * (KTD8's "no match" -> "Other" fallback is the caller's responsibility,
 * not this dictionary's) -- deliberately simpler than U5's fuzzy title
 * match, since keyword matching here is exact-word by design.
 */

export const CATEGORY_KEYWORD_DICTIONARY: Record<string, string[]> = {
  FOOD: ['food', 'restaurant', 'lunch', 'dinner', 'breakfast', 'groceries', 'grocery', 'cafe', 'coffee'],
  ACCOMMODATION: ['hotel', 'hostel', 'airbnb', 'accommodation', 'lodging', 'rent'],
  TRAVEL: ['travel', 'flight', 'taxi', 'uber', 'train', 'bus', 'fuel', 'gas', 'petrol', 'parking'],
  ENTERTAINMENT: ['movie', 'cinema', 'concert', 'entertainment', 'games', 'tickets'],
  SHOPPING: ['shopping', 'clothes', 'clothing', 'shoes', 'electronics'],
  UTILITIES: ['electricity', 'water', 'gas bill', 'internet', 'utilities', 'phone bill'],
};

/**
 * Tokenize a title into lowercase whole words for exact word-boundary
 * matching (so "gasket" never matches the "gas" keyword).
 */
function tokenize(title: string): Set<string> {
  return new Set(title.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/**
 * Look up a category code for a given expense title via whole-word,
 * case-insensitive keyword matching. A multi-word dictionary keyword
 * (e.g. "gas bill") is matched as a substring of the lowercased title
 * rather than a single token.
 *
 * @param title - The expense title text to match against
 * @returns The matching category code, or null when nothing matches
 */
export function suggestCategoryCode(title: string): string | null {
  const normalizedTitle = title.toLowerCase().trim();

  if (normalizedTitle.length === 0) {
    return null;
  }

  const titleTokens = tokenize(normalizedTitle);

  // Multi-word keywords (e.g. "gas bill") are checked across every category
  // before any single-word keyword (e.g. "gas") -- otherwise a shorter,
  // single-word keyword from an earlier-declared category would always win
  // and the more specific multi-word entry could never fire.
  for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
    for (const keyword of keywords) {
      if (keyword.includes(' ') && normalizedTitle.includes(keyword)) {
        return categoryCode;
      }
    }
  }

  for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
    for (const keyword of keywords) {
      if (!keyword.includes(' ') && titleTokens.has(keyword)) {
        return categoryCode;
      }
    }
  }

  return null;
}
