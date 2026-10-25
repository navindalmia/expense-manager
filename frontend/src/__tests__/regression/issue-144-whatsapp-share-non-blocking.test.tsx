/**
 * Regression test for issue #144.
 *
 * ROOT CAUSE: the Share button called Linking.canOpenURL('whatsapp://...')
 * and showed "WhatsApp is not installed" when it returned false. On
 * Android 11+ canOpenURL is false for apps not declared in manifest
 * <queries>, so installed WhatsApp looked missing. The button also sat
 * directly under the growing members list, so layout shift caused
 * accidental taps. Fix: never gate on canOpenURL, fall back to wa.me, and
 * show only a friendly, non-technical message if every attempt fails.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, Linking } from 'react-native';
import AddMemberModal from '../../components/AddMemberModal';
import { getAddMemberStrings } from '../../i18n/addMemberStrings';
import type { Group } from '../../services/groupService';

vi.mock('../../services/groupService', () => ({
  addMemberByEmail: vi.fn(),
  removeMemberFromGroup: vi.fn(),
}));

const group = { id: 1, name: 'Trip', members: [{ id: 1, name: 'A', email: 'a@x.com' }] } as Group;
const mockCanOpen = Linking.canOpenURL as ReturnType<typeof vi.fn>;
const mockOpen = Linking.openURL as ReturnType<typeof vi.fn>;
const mockAlert = Alert.alert as ReturnType<typeof vi.fn>;

async function tapShare(): Promise<void> {
  const { baseElement } = render(
    <AddMemberModal visible group={group} onClose={vi.fn()} onMemberAdded={vi.fn()} />
  );
  const btn = baseElement.querySelector('[testid="add-member-whatsapp-share-button"]') as HTMLElement;
  await userEvent.click(btn);
}

describe('issue #144: WhatsApp share does not block or falsely error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanOpen.mockResolvedValue(false);
    mockOpen.mockResolvedValue(undefined);
  });

  it('should open WhatsApp and show no alert when canOpenURL wrongly returns false', async () => {
    await tapShare();
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(mockOpen.mock.calls[0][0]).toMatch(/^whatsapp:\/\/send\?text=/);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('should fall back to wa.me when the whatsapp scheme fails', async () => {
    mockOpen.mockRejectedValueOnce(new Error('no handler'));
    await tapShare();
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
    expect(mockOpen.mock.calls[1][0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('should show a friendly localized message, not a technical error, when every attempt fails', async () => {
    mockOpen.mockRejectedValue(new Error('boom'));
    await tapShare();
    const en = getAddMemberStrings('en');
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(en.shareFailedTitle, en.shareFailedBody));
    expect(JSON.stringify(mockAlert.mock.calls)).not.toMatch(/not installed/i);
  });

  it('should provide French strings for the share flow', () => {
    const fr = getAddMemberStrings('fr-CA');
    expect(fr.shareViaWhatsApp).toMatch(/Partager/);
    expect(fr.inviteMessage('Voyage')).toContain('Voyage');
    expect(fr.shareFailedTitle).not.toBe(getAddMemberStrings('en').shareFailedTitle);
  });
});
