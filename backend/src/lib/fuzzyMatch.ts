/**
 * Fuzzy Match
 *
 * Pure, DB-free ranking of a query string against candidate titles, backed
 * by Fuse.js (KTD4). Fuse's native score is lower-is-better (0 = perfect);
 * this module inverts it so callers keep the original contract: a
 * non-negative score where higher is better and 0 means "no match".
 *
 * Fuse matches the WHOLE query as one pattern (ignoreLocation), so a single
 * shared filler word ("to", "the") cannot make an otherwise different title
 * match. A query consisting only of filler words is additionally rejected
 * unless it equals the candidate exactly.
 */

import Fuse from 'fuse.js';

/** Fuse score at or below which a candidate counts as a match (0 = perfect). */
const MATCH_THRESHOLD = 0.35;
const EXACT_MATCH_SCORE = 110;
const MIN_MATCH_CHAR_LENGTH = 2;

const FILLER_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
]);

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function isFillerOnly(normalizedQuery: string): boolean {
  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 0);
  return tokens.length > 0 && tokens.every((token) => FILLER_WORDS.has(token));
}

function buildFuse<T>(items: T[], getTitle: (item: T) => string): Fuse<T> {
  return new Fuse(items, {
    keys: [{ name: 'title', getFn: (item: T): string => normalize(getTitle(item)) }],
    includeScore: true,
    threshold: MATCH_THRESHOLD,
    ignoreLocation: true,
    minMatchCharLength: MIN_MATCH_CHAR_LENGTH,
  });
}

function toScore(fuseScore: number | undefined): number {
  return Math.max(Math.round((1 - (fuseScore ?? 1)) * 100), 1);
}

/**
 * Score how well `query` matches `candidate`.
 *
 * - Exact match (case-insensitive, trimmed) scores highest (110).
 * - Otherwise 1-100 from Fuse's inverted score; 0 when below the match
 *   threshold, when the query is filler-only, or when either input is empty.
 * - Never throws.
 */
export function scoreMatch(query: string, candidate: string): number {
  const normalizedQuery = normalize(query);
  const normalizedCandidate = normalize(candidate);

  if (normalizedQuery.length === 0 || normalizedCandidate.length === 0) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return EXACT_MATCH_SCORE;
  }

  if (isFillerOnly(normalizedQuery)) {
    return 0;
  }

  const [best] = buildFuse([candidate], (title: string): string => title).search(normalizedQuery);
  return best ? toScore(best.score) : 0;
}

export interface RankedMatch<T> {
  item: T;
  score: number;
}

/**
 * Rank candidates by fuzzy match against `query`, best first, dropping
 * non-matches. Builds one Fuse index over all candidates.
 *
 * @param query - The text being typed
 * @param items - Candidates to rank
 * @param getTitle - Extracts the comparable title from each candidate
 * @param limit - Maximum number of ranked matches to return
 */
export function rankMatches<T>(
  query: string,
  items: T[],
  getTitle: (item: T) => string,
  limit: number
): RankedMatch<T>[] {
  const normalizedQuery = normalize(query);

  if (normalizedQuery.length === 0 || items.length === 0) {
    return [];
  }

  const fillerOnly = isFillerOnly(normalizedQuery);

  return buildFuse(items, getTitle)
    .search(normalizedQuery)
    .map((result): RankedMatch<T> => {
      const exact = normalize(getTitle(result.item)) === normalizedQuery;
      return { item: result.item, score: exact ? EXACT_MATCH_SCORE : toScore(result.score) };
    })
    .filter((ranked) => !fillerOnly || ranked.score === EXACT_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
