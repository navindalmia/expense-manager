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
  it('should keep intraword underscores and lone symbols', () => {
    expect(parseBullets('- Fixed user_id lookup\n- amount < 5 and total > 3\n- 2 * 3')).toEqual([
      'Fixed user_id lookup', 'amount < 5 and total > 3', '2 * 3',
    ]);
  });
  it('should strip paired emphasis, code and strikethrough', () => {
    expect(parseBullets('- __bold__ *em* `code` ~~gone~~')).toEqual(['bold em code gone']);
  });
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

  it('should report http on a 500', async () => {
    vi.mocked(fetch).mockResolvedValue(res(500, {}));
    expect((await fetchReleaseNotes()).error).toBe('http');
  });

  it('should report http on a plain 403 without an exhausted quota', async () => {
    vi.mocked(fetch).mockResolvedValue(res(403, {}, { 'x-ratelimit-remaining': '12' }));
    expect((await fetchReleaseNotes()).error).toBe('http');
  });

  it('should report rate_limit on a 429', async () => {
    vi.mocked(fetch).mockResolvedValue(res(429, {}));
    expect((await fetchReleaseNotes()).error).toBe('rate_limit');
  });

  it('should report bad_response when the 200 body cannot be parsed', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => { throw new SyntaxError('bad'); } } as unknown as Response);
    expect((await fetchReleaseNotes()).error).toBe('bad_response');
  });

  it('should keep a good cache when a 200 returns a non-array body', async () => {
    store.set(RELEASES_CACHE_KEY, JSON.stringify([{ tag: 'staging-20261031-abcdef1', date: '2026-10-31', bullets: ['kept'] }]));
    vi.mocked(fetch).mockResolvedValue(res(200, { message: 'unexpected' }));
    const r = await fetchReleaseNotes();
    expect(r).toMatchObject({ fromCache: true, error: 'bad_response' });
    expect(r.releases[0].bullets).toEqual(['kept']);
    expect(JSON.parse(store.get(RELEASES_CACHE_KEY) as string)).toHaveLength(1);
  });

  it('should not overwrite a good cache when a 200 returns an empty array', async () => {
    const good = JSON.stringify([{ tag: 'staging-20261031-abcdef1', date: '2026-10-31', bullets: ['kept'] }]);
    store.set(RELEASES_CACHE_KEY, good);
    vi.mocked(fetch).mockResolvedValue(res(200, []));
    expect(await fetchReleaseNotes()).toEqual({ releases: [], fromCache: false, error: null });
    expect(store.get(RELEASES_CACHE_KEY)).toBe(good);
  });

  it('should report bad_response and keep the cache when every item fails parsing', async () => {
    const good = JSON.stringify([{ tag: 'staging-20261031-abcdef1', date: '2026-10-31', bullets: ['kept'] }]);
    store.set(RELEASES_CACHE_KEY, good);
    vi.mocked(fetch).mockResolvedValue(res(200, [{ nope: 1 }, { tag_name: 5 }]));
    const r = await fetchReleaseNotes();
    expect(r).toMatchObject({ fromCache: true, error: 'bad_response' });
    expect(r.releases).toHaveLength(1);
    expect(store.get(RELEASES_CACHE_KEY)).toBe(good);
  });

  it('should drop malformed cache entries and keep valid ones', async () => {
    store.set(RELEASES_CACHE_KEY, JSON.stringify([{ tag: 'x' }, { tag: 't', date: null, bullets: ['ok'] }, null, { tag: 'u', date: null, bullets: [1] }]));
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    const r = await fetchReleaseNotes();
    expect(r.releases).toEqual([{ tag: 't', date: null, bullets: ['ok'] }]);
  });

  it('should treat a cache with only malformed entries as no cache', async () => {
    store.set(RELEASES_CACHE_KEY, JSON.stringify([{ tag: 5 }]));
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    expect(await fetchReleaseNotes()).toEqual({ releases: [], fromCache: false, error: 'offline' });
  });

  it('should abort after 10 seconds and report offline', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        (init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')));
      }));
      const pending = fetchReleaseNotes();
      await vi.advanceTimersByTimeAsync(10000);
      expect((await pending).error).toBe('offline');
    } finally {
      vi.useRealTimers();
    }
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
