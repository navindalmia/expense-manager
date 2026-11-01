import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
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
});
