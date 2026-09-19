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
 * Tokenize a title into an ordered list of lowercase whole words for exact
 * word-boundary matching (so "gasket" never matches the "gas" keyword, and
 * "phone Billy" never matches the "phone bill" keyword).
 */
function tokenize(title: string): string[] {
  return title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Whether `keyword` (one or more words) appears in `titleTokens` as a
 * contiguous run of whole-word tokens, e.g. tokens ["gas", "bill"] contain
 * the keyword "gas bill" but tokens ["gas", "billboard"] do not.
 */
function containsWholeWordPhrase(titleTokens: string[], keyword: string): boolean {
  const keywordTokens = keyword.split(' ');
  for (let start = 0; start <= titleTokens.length - keywordTokens.length; start++) {
    if (keywordTokens.every((token, offset) => titleTokens[start + offset] === token)) {
      return true;
    }
  }
  return false;
}

/**
 * Look up a category code for a given expense title via whole-word,
 * case-insensitive keyword matching. A multi-word dictionary keyword
 * (e.g. "gas bill") is matched as a contiguous run of whole-word tokens,
 * the same word-boundary guarantee single-word keywords get -- never a
 * raw substring, so "phone bill" cannot match inside "phone Billy".
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
  const titleTokenSet = new Set(titleTokens);

  // Multi-word keywords (e.g. "gas bill") are checked across every category
  // before any single-word keyword (e.g. "gas") -- otherwise a shorter,
  // single-word keyword from an earlier-declared category would always win
  // and the more specific multi-word entry could never fire.
  for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
    for (const keyword of keywords) {
      if (keyword.includes(' ') && containsWholeWordPhrase(titleTokens, keyword)) {
        return categoryCode;
      }
    }
  }

  for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
    for (const keyword of keywords) {
      if (!keyword.includes(' ') && titleTokenSet.has(keyword)) {
        return categoryCode;
      }
    }
  }

  return null;
}
