import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
  },
}));

import {
  fetchReleaseNotes, parseBullets, parseReleases, parseTagDate, RELEASES_CACHE_KEY, RELEASES_URL,
} from '../releaseNotesService';

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body } as Response;
}
const payload = [
  { tag_name: 'staging-20261031-abcdef1', body: '- Fixed **login**\n* Added [docs](http://x)\nnot a bullet\n- <script>alert(1)</script>ok' },
  { tag_name: 'staging-20261030-1234567', body: null },
  { tag_name: 'draft-one', draft: true, body: '- hidden' },
];

describe('parseTagDate', () => {
  it('should return the date for a staging tag', () => expect(parseTagDate('staging-20261031-abcdef1')).toBe('2026-10-31'));
  it('should return null for a non-matching tag', () => expect(parseTagDate('v1.0.0')).toBeNull());
  it('should return null for an impossible date', () => expect(parseTagDate('staging-20261340-abcdef1')).toBeNull());
});

describe('parseBullets', () => {
  it('should keep bullets and strip markdown and html', () => {
    expect(parseBullets(payload[0].body as string)).toEqual(['Fixed login', 'Added docs', 'alert(1)ok']);
  });
  it('should return an empty list for an empty body', () => expect(parseBullets('')).toEqual([]));
});

describe('parseReleases', () => {
  it('should skip drafts and tolerate null bodies', () => {
    const r = parseReleases(payload);
    expect(r.map((x) => x.tag)).toEqual(['staging-20261031-abcdef1', 'staging-20261030-1234567']);
    expect(r[1].bullets).toEqual([]);
  });
  it('should return an empty list for a non-array payload', () => expect(parseReleases({ message: 'x' })).toEqual([]));
});

describe('fetchReleaseNotes', () => {
  beforeEach(() => { store.clear(); vi.stubGlobal('fetch', vi.fn()); });

  it('should fetch the releases url, return parsed notes and cache them', async () => {
    vi.mocked(fetch).mockResolvedValue(res(200, payload));
    const r = await fetchReleaseNotes();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(RELEASES_URL);
    expect(r).toMatchObject({ fromCache: false, error: null });
    expect(r.releases).toHaveLength(2);
    expect(store.has(RELEASES_CACHE_KEY)).toBe(true);
  });

  it('should return an empty list without error when there are no releases', async () => {
    vi.mocked(fetch).mockResolvedValue(res(200, []));
    expect(await fetchReleaseNotes()).toEqual({ releases: [], fromCache: false, error: null });
  });

  it('should report not_found on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(res(404, {}));
    expect((await fetchReleaseNotes()).error).toBe('not_found');
  });

  it('should report rate_limit on 403 with exhausted quota', async () => {
    vi.mocked(fetch).mockResolvedValue(res(403, {}, { 'x-ratelimit-remaining': '0' }));
    expect((await fetchReleaseNotes()).error).toBe('rate_limit');
  });

  it('should report http on a plain 403 or 500', async () => {
    vi.mocked(fetch).mockResolvedValue(res(500, {}));
    expect((await fetchReleaseNotes()).error).toBe('http');
  });

  it('should report offline when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Network request failed'));
    expect(await fetchReleaseNotes()).toEqual({ releases: [], fromCache: false, error: 'offline' });
  });

  it('should fall back to the cached notes when the fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(res(200, payload));
    await fetchReleaseNotes();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'));
    const r = await fetchReleaseNotes();
    expect(r).toMatchObject({ fromCache: true, error: 'offline' });
    expect(r.releases).toHaveLength(2);
  });

  it('should ignore a corrupt cache', async () => {
    store.set(RELEASES_CACHE_KEY, '{not json');
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    expect((await fetchReleaseNotes()).releases).toEqual([]);
  });
});
