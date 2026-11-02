/**
 * Release Notes Service
 *
 * Reads the public GitHub Releases of this repo (unauthenticated, 60 requests/hour/IP) so staging
 * testers can read release notes in the app. Keeps the last good result in AsyncStorage and falls
 * back to it when the network, the rate limit or GitHub fails. Release text is reduced to plain
 * strings here, so nothing downstream ever renders raw markdown or HTML.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RELEASES_URL =
  'https://api.github.com/repos/navindalmia/expense-manager/releases?per_page=5';
export const RELEASES_CACHE_KEY = '@whatsNew/releases';
const REQUEST_TIMEOUT_MS = 10000;

export interface ReleaseNote {
  tag: string;
  /** YYYY-MM-DD parsed from a staging-YYYYMMDD-<sha7> tag, else null. */
  date: string | null;
  bullets: string[];
}

export type ReleaseNotesErrorKind = 'offline' | 'rate_limit' | 'not_found' | 'http' | 'bad_response';

export interface ReleaseNotesResult {
  releases: ReleaseNote[];
  /** True when the releases came from the cache because the live fetch failed. */
  fromCache: boolean;
  /** Set when the live fetch failed (releases may still be filled from the cache). */
  error: ReleaseNotesErrorKind | null;
}

interface RawRelease {
  tag_name?: unknown;
  body?: unknown;
  draft?: unknown;
}

const TAG_PATTERN = /^staging-(\d{4})(\d{2})(\d{2})-[0-9a-f]{7}$/;

/** Date part of a staging-YYYYMMDD-<sha7> tag as YYYY-MM-DD, or null when the tag does not match or the date is invalid. */
export function parseTagDate(tag: string): string | null {
  const match = TAG_PATTERN.exec(tag);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid =
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day);
  return valid ? `${year}-${month}-${day}` : null;
}

/** Strip paired emphasis, links and HTML tags (lone * _ < > characters stay) so the text is safe to show verbatim as plain text. */
function toPlainText(line: string): string {
  return line
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bullet lines (-, *, +) of a markdown body as plain strings; other lines are ignored. */
export function parseBullets(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => /^\s*[-*+]\s+(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => toPlainText(match[1]))
    .filter((text) => text.length > 0);
}

function toReleaseNote(raw: RawRelease): ReleaseNote | null {
  if (raw.draft === true || typeof raw.tag_name !== 'string' || raw.tag_name.length === 0) return null;
  return {
    tag: raw.tag_name,
    date: parseTagDate(raw.tag_name),
    bullets: typeof raw.body === 'string' ? parseBullets(raw.body) : [],
  };
}

export function parseReleases(payload: unknown): ReleaseNote[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => (item && typeof item === 'object' ? toReleaseNote(item as RawRelease) : null))
    .filter((note): note is ReleaseNote => note !== null);
}

function isReleaseNote(value: unknown): value is ReleaseNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.tag === 'string' &&
    (note.date === null || typeof note.date === 'string') &&
    Array.isArray(note.bullets) &&
    note.bullets.every((b) => typeof b === 'string')
  );
}

async function readCache(): Promise<ReleaseNote[] | null> {
  try {
    const raw = await AsyncStorage.getItem(RELEASES_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isReleaseNote);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

async function writeCache(releases: ReleaseNote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RELEASES_CACHE_KEY, JSON.stringify(releases));
  } catch {
    // Caching is best effort; a storage failure must not break the screen.
  }
}

function classifyFailure(response: Response): ReleaseNotesErrorKind {
  if (response.status === 404) return 'not_found';
  const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
  if (response.status === 429 || (response.status === 403 && exhausted)) return 'rate_limit';
  return 'http';
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestReleases(): Promise<{ releases: ReleaseNote[] } | { error: ReleaseNotesErrorKind }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return { error: classifyFailure(response) };
    const payload = await parseBody(response);
    if (!Array.isArray(payload)) return { error: 'bad_response' };
    const releases = parseReleases(payload);
    // A non-empty array that yields nothing usable is schema drift, not "no releases".
    return payload.length > 0 && releases.length === 0 ? { error: 'bad_response' } : { releases };
  } catch {
    return { error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Latest releases, newest first. Never throws: failures come back as `error` with any cached notes. */
export async function fetchReleaseNotes(): Promise<ReleaseNotesResult> {
  const outcome = await requestReleases();
  if ('releases' in outcome) {
    // Never replace a good cache with an empty list.
    if (outcome.releases.length > 0) await writeCache(outcome.releases);
    return { releases: outcome.releases, fromCache: false, error: null };
  }
  const cached = await readCache();
  return { releases: cached ?? [], fromCache: cached !== null, error: outcome.error };
}
