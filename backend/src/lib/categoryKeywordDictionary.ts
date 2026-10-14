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
  FOOD: [
    'food', 'restaurant', 'lunch', 'dinner', 'breakfast', 'groceries', 'grocery', 'cafe', 'coffee',
    'pizza', 'burger', 'supper', 'brunch', 'snack', 'meal', 'takeaway', 'takeout', 'drink', 'tea',
    'bar', 'pub', 'bakery', 'dessert', 'icecream', 'sandwich', 'biryani', 'sushi', 'pasta', 'noodle',
    'beer', 'wine', 'swiggy', 'zomato', 'doordash', 'eat', 'eatery', 'diner',
  ],
  ACCOMMODATION: [
    'hotel', 'hostel', 'airbnb', 'accommodation', 'lodging', 'rent', 'motel', 'resort', 'villa',
    'stay', 'booking', 'guesthouse', 'homestay',
  ],
  TRAVEL: [
    'travel', 'flight', 'taxi', 'uber', 'train', 'bus', 'fuel', 'gas', 'petrol', 'parking',
    'metro', 'cab', 'ride', 'toll', 'ferry', 'ola', 'lyft', 'subway', 'airfare', 'diesel', 'trip',
    'rickshaw', 'commute', 'airport',
  ],
  ENTERTAINMENT: [
    'movie', 'cinema', 'concert', 'entertainment', 'games', 'tickets', 'netflix', 'spotify', 'show',
    'theatre', 'theater', 'museum', 'party', 'club', 'bowling',
  ],
  SHOPPING: [
    'shopping', 'clothes', 'clothing', 'shoes', 'electronics', 'shirt', 'dress', 'jacket', 'amazon',
    'mall', 'gift', 'jeans', 'bag', 'watch', 'gadget', 'furniture',
  ],
  UTILITIES: [
    'electricity', 'water', 'gas bill', 'internet', 'utilities', 'phone bill', 'wifi', 'broadband',
    'mobile bill', 'recharge', 'electric', 'sewage', 'cable', 'power bill', 'utility',
  ],
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
 * Simple plural variants of a word (no stemming library): the word itself,
 * minus a trailing "s", and minus a trailing "es". Short words are left alone
 * so "gas" never becomes "ga".
 */
function variants(word: string): string[] {
  const result = [word];
  if (word.length > 3 && word.endsWith('s')) result.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('es')) result.push(word.slice(0, -2));
  return result;
}

/** Whether two whole words are equal once simple plurals are normalised. */
export function wordsMatch(a: string, b: string): boolean {
  return a === b || variants(a).includes(b) || variants(b).includes(a);
}

/**
 * Whether `keyword` (one or more words) appears in `titleTokens` as a
 * contiguous run of whole-word tokens, e.g. tokens ["gas", "bill"] contain
 * the keyword "gas bill" but tokens ["gas", "billboard"] do not.
 */
function containsWholeWordPhrase(titleTokens: string[], keyword: string): boolean {
  const keywordTokens = keyword.split(' ');
  for (let start = 0; start <= titleTokens.length - keywordTokens.length; start++) {
    if (keywordTokens.every((token, offset) => wordsMatch(titleTokens[start + offset] ?? '', token))) {
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
      if (!keyword.includes(' ') && titleTokens.some((token) => wordsMatch(token, keyword))) {
        return categoryCode;
      }
    }
  }

  return null;
}
