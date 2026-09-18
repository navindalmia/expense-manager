/**
 * Fuzzy Match
 *
 * Pure, framework-free scoring of a query string against a candidate title
 * (KTD9 -- token-overlap + substring scoring in TypeScript, no new
 * dependency or DB extension). Deliberately has no Prisma/DB dependency so
 * it can be unit-tested as plain input -> score logic.
 */

/**
 * Normalize a string into lowercase whitespace-trimmed tokens.
 */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Score how well `query` matches `candidate`.
 *
 * Scoring:
 * - Exact match (case-insensitive, trimmed) scores highest.
 * - Otherwise, combines token overlap (shared whole words) with a
 *   substring bonus (candidate contains query, or vice versa).
 * - Returns 0 when there is no overlap at all, or when either input is
 *   empty/whitespace-only -- never throws.
 *
 * @param query - The text being typed (e.g. a partial expense title)
 * @param candidate - A past expense title to compare against
 * @returns A non-negative score; higher means a better match
 */
export function scoreMatch(query: string, candidate: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedCandidate = candidate.toLowerCase().trim();

  if (normalizedQuery.length === 0 || normalizedCandidate.length === 0) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 110;
  }

  const queryTokens = tokenize(normalizedQuery);
  const candidateTokens = tokenize(normalizedCandidate);
  const candidateTokenSet = new Set(candidateTokens);

  const sharedTokenCount = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
  const tokenScore = queryTokens.length > 0 ? (sharedTokenCount / queryTokens.length) * 60 : 0;

  let substringScore = 0;
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    substringScore = 40;
  }

  return tokenScore + substringScore;
}

export interface RankedMatch<T> {
  item: T;
  score: number;
}

/**
 * Rank a list of candidates by their fuzzy match score against `query`,
 * highest score first, dropping zero-score (no overlap) candidates.
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
  return items
    .map((item) => ({ item, score: scoreMatch(query, getTitle(item)) }))
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
