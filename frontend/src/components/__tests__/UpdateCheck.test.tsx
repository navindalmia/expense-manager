import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Updates from 'expo-updates';
import { runUpdateCheck } from '../UpdateCheck';
import { updateText } from '../../utils/updateStrings';

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

  it('should report updates disabled and not check', async () => {
    u.isEnabled = false;
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe(updateText('disabled'));
    expect(u.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('should report latest and not reload when none is available', async () => {
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe(updateText('latest'));
    expect(u.reloadAsync).not.toHaveBeenCalled();
  });

  it('should download then reload when an update is available', async () => {
    u.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    await runUpdateCheck(setStatus);
    expect(u.fetchUpdateAsync).toHaveBeenCalled();
    expect(u.reloadAsync).toHaveBeenCalled();
  });

  it('should show the error message when the check throws', async () => {
    u.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    await runUpdateCheck(setStatus);
    expect(messages.at(-1)).toBe(`${updateText('failed')}: offline`);
  });

  it('should have French strings for every key', () => {
    expect(updateText('button', 'fr')).not.toBe(updateText('button', 'en'));
    expect(updateText('latest', 'fr')).toContain('dernière');
  });
});
