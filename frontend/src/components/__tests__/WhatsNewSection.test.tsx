import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { getWhatsNewStrings } from '../../i18n/whatsNewStrings';

// getWhatsNewStrings runs once per WhatsNewSection render, so its call count is a render counter.
vi.mock('../../i18n/whatsNewStrings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../i18n/whatsNewStrings')>();
  return { ...actual, getWhatsNewStrings: vi.fn(actual.getWhatsNewStrings) };
});
import type { ReleaseNotesResult } from '../../services/releaseNotesService';

const fetchMock = vi.fn();
vi.mock('../../services/releaseNotesService', () => ({ fetchReleaseNotes: () => fetchMock() }));

import WhatsNewSection from '../WhatsNewSection';

const q = (c: HTMLElement, id: string): HTMLElement | null => c.querySelector(`[testid="${id}"]`);
const rel = (tag: string, date: string | null, bullets: string[]) => ({ tag, date, bullets });
const ok = (releases: ReleaseNotesResult['releases']): ReleaseNotesResult => ({ releases, fromCache: false, error: null });

describe('WhatsNewSection', () => {
  beforeEach(() => fetchMock.mockReset());

  it('should show the latest release first and keep older ones collapsed until See all', async () => {
    fetchMock.mockResolvedValue(ok([rel('a', '2026-10-31', ['One', 'Two']), rel('b', '2026-10-30', ['Old'])]));
    const { container } = render(<WhatsNewSection />);
    await waitFor(() => expect(q(container, 'whats-new-release-0')).not.toBeNull());
    expect(q(container, 'whats-new-release-0-date')?.textContent).toBe('2026-10-31');
    expect(container.textContent).toContain('• One');
    expect(q(container, 'whats-new-release-1')).toBeNull();
    fireEvent.click(q(container, 'whats-new-toggle-older') as HTMLElement);
    expect(q(container, 'whats-new-release-1')).not.toBeNull();
    expect(container.textContent).toContain('Old');
  });

  it('should show the empty message when there are no releases', async () => {
    fetchMock.mockResolvedValue(ok([]));
    const { container } = render(<WhatsNewSection />);
    await waitFor(() => expect(q(container, 'whats-new-empty')).not.toBeNull());
  });

  it('should show the cached notice, an error and a retry that reloads', async () => {
    fetchMock.mockResolvedValueOnce({ releases: [rel('a', null, [])], fromCache: true, error: 'offline' });
    const { container } = render(<WhatsNewSection />);
    await waitFor(() => expect(q(container, 'whats-new-error')).not.toBeNull());
    expect(q(container, 'whats-new-cached')).not.toBeNull();
    expect(q(container, 'whats-new-release-0-date')?.textContent).toBe('a');
    fetchMock.mockResolvedValueOnce(ok([rel('a', '2026-10-31', ['x'])]));
    fireEvent.click(q(container, 'whats-new-retry') as HTMLElement);
    await waitFor(() => expect(q(container, 'whats-new-error')).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should render markup in bullets as inert text', async () => {
    fetchMock.mockResolvedValue(ok([rel('a', null, ['<b>x</b>'])]));
    const { container } = render(<WhatsNewSection />);
    await waitFor(() => expect(q(container, 'whats-new-release-0')).not.toBeNull());
    expect(container.querySelector('b')).toBeNull();
  });

  it('should show the message for each error kind', async () => {
    const strings = getWhatsNewStrings('en');
    const cases = [
      ['offline', strings.errorOffline], ['rate_limit', strings.errorRateLimit],
      ['not_found', strings.errorNotFound], ['http', strings.errorGeneric], ['bad_response', strings.errorBadResponse],
    ] as const;
    for (const [kind, text] of cases) {
      fetchMock.mockResolvedValueOnce({ releases: [], fromCache: false, error: kind });
      const { container, unmount } = render(<WhatsNewSection />);
      await waitFor(() => expect(q(container, 'whats-new-error')?.textContent).toBe(text));
      unmount();
    }
  });

  it('should collapse older releases again on the second toggle', async () => {
    fetchMock.mockResolvedValue(ok([rel('a', '2026-10-31', ['One']), rel('b', '2026-10-30', ['Old'])]));
    const { container } = render(<WhatsNewSection />);
    await waitFor(() => expect(q(container, 'whats-new-toggle-older')).not.toBeNull());
    const toggle = q(container, 'whats-new-toggle-older') as HTMLElement;
    fireEvent.click(toggle);
    expect(q(container, 'whats-new-release-1')).not.toBeNull();
    fireEvent.click(toggle);
    expect(q(container, 'whats-new-release-1')).toBeNull();
  });

  it('should let only the latest load win when an earlier overlapping load resolves late', async () => {
    let resolveFirst: (r: ReleaseNotesResult) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<ReleaseNotesResult>((r) => { resolveFirst = r; }));
    fetchMock.mockResolvedValueOnce(ok([rel('second', '2026-10-30', ['fresh bullet'])]));
    // StrictMode runs the mount effect twice, which starts two overlapping loads.
    const { container } = render(<React.StrictMode><WhatsNewSection /></React.StrictMode>);
    await waitFor(() => expect(container.textContent).toContain('fresh bullet'));
    await act(async () => { resolveFirst(ok([rel('stale', '2026-01-01', ['stale bullet'])])); });
    expect(container.textContent).toContain('fresh bullet');
    expect(container.textContent).not.toContain('stale bullet');
  });

  it('should not render again after unmount when the pending load resolves', async () => {
    let resolveFirst: (r: ReleaseNotesResult) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<ReleaseNotesResult>((r) => { resolveFirst = r; }));
    const { unmount } = render(<WhatsNewSection />);
    const before = vi.mocked(getWhatsNewStrings).mock.calls.length;
    unmount();
    await act(async () => { resolveFirst(ok([rel('late', null, [])])); });
    expect(vi.mocked(getWhatsNewStrings).mock.calls.length).toBe(before);
  });
});
