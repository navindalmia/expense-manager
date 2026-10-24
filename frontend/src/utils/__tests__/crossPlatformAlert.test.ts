/**
 * confirmThenProceed: the web branch uses window.confirm (Alert.alert is a
 * silent no-op on web). Cancel must call onCancel so callers can reset state
 * set before the dialog opened (EditGroupModal's "confirming" flag), and
 * confirm must call onConfirm only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Alert, Platform } from 'react-native';
import { confirmThenProceed } from '../crossPlatformAlert';

describe('confirmThenProceed', () => {
  const originalOS = Platform.OS;
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    vi.unstubAllGlobals();
  });

  describe('on web', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'web';
    });

    it('should call onCancel and not onConfirm when the user cancels window.confirm', () => {
      const confirmSpy = vi.fn().mockReturnValue(false);
      vi.stubGlobal('window', { confirm: confirmSpy });

      confirmThenProceed('Delete Group', 'Sure?', 'Delete', onConfirm, onCancel);

      expect(confirmSpy).toHaveBeenCalledWith('Delete Group\n\nSure?');
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should call onConfirm and not onCancel when the user accepts window.confirm', () => {
      vi.stubGlobal('window', { confirm: vi.fn().mockReturnValue(true) });

      confirmThenProceed('Delete Group', 'Sure?', 'Delete', onConfirm, onCancel);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should not throw when the user cancels and no onCancel was given', () => {
      vi.stubGlobal('window', { confirm: vi.fn().mockReturnValue(false) });

      expect(() => confirmThenProceed('Delete Group', 'Sure?', 'Delete', onConfirm)).not.toThrow();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('on native', () => {
    it('should wire onCancel to the Cancel button and onConfirm to the confirm button', () => {
      (Platform as { OS: string }).OS = 'ios';

      confirmThenProceed('Delete Group', 'Sure?', 'Delete', onConfirm, onCancel);

      const buttons = (Alert.alert as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      buttons.find((b) => b.text === 'Cancel')?.onPress?.();
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();

      buttons.find((b) => b.text === 'Delete')?.onPress?.();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
