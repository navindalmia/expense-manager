import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Updates from 'expo-updates';
import { runUpdateCheck } from '../UpdateCheck';

const u = Updates as unknown as {
  isEnabled: boolean;
  checkForUpdateAsync: ReturnType<typeof vi.fn>;
  fetchUpdateAsync: ReturnType<typeof vi.fn>;
  reloadAsync: ReturnType<typeof vi.fn>;
};

describe('runUpdateCheck', () => {
  let messages: string[];
  const setStatus = (m: string): void => { messages.push(m); };

  beforeEach(() => {
    messages = [];
    vi.clearAllMocks();
    u.isEnabled = true;
    u.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  });

  it('should say updates are not enabled when the build has them off', async () => {
    u.isEnabled = false;
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe('Updates are not enabled in this build.');
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('should report the latest update when none is available and not reload', async () => {
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe('You already have the latest update.');
    expect(u.reloadAsync).not.toHaveBeenCalled();
  });

  it('should download then restart when an update is available', async () => {
    u.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    await runUpdateCheck(setStatus);
    expect(u.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(u.reloadAsync).toHaveBeenCalledTimes(1);
    expect(messages).toContain('Downloading the update...');
  });

  it('should show the real error message when the check fails', async () => {
    u.checkForUpdateAsync.mockRejectedValue(new Error('Failed to download manifest from URL'));
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe('Update check failed: Failed to download manifest from URL');
  });
});
