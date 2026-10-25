import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { Linking } from 'react-native';
import AddMemberModal from '../../components/AddMemberModal';
import * as groupService from '../../services/groupService';

vi.mock('../../services/groupService', () => ({
  addMemberByEmail: vi.fn(),
  removeMemberFromGroup: vi.fn(),
}));
vi.mock('../../hooks/useKeyboardInset', () => ({
  KeyboardInsetView: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));

// Regression #144: on real Android phones, with 3-4+ members, tapping Add fired WhatsApp Share
// ("WhatsApp is not installed"). Add, the members list and Share shared one ScrollView, so as the list
// grew the content shifted/scrolled under the tap. Structure now: fixed Add, bounded list scroll, fixed footer.
const makeGroup = (n: number): any => ({
  id: 1, name: 'Trip', members: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `M${i}`, email: `m${i}@x.com` })),
});
const renderModal = (n: number) =>
  render(<AddMemberModal visible group={makeGroup(n)} onClose={vi.fn()} onMemberAdded={vi.fn()} />);
const q = (c: HTMLElement, id: string): HTMLElement => c.querySelector(`[testid="${id}"]`) as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  (Linking.canOpenURL as any).mockResolvedValue(false);
  (Linking.openURL as any).mockResolvedValue(undefined);
});

describe('issue #144: Add Member modal layout', () => {
  it('should not put Add and Share inside the same ScrollView', () => {
    const { container } = renderModal(6);
    const scroll = q(container, 'add-member-members-scroll');
    expect(scroll).not.toBeNull();
    expect(scroll.contains(q(container, 'add-member-add-button'))).toBe(false);
    expect(scroll.contains(q(container, 'add-member-whatsapp-share-button'))).toBe(false);
  });

  it('should render the members list inside its own ScrollView', () => {
    const { container } = renderModal(6);
    expect(q(container, 'add-member-members-scroll').contains(q(container, 'add-member-remove-button-3'))).toBe(true);
  });

  it('should set keyboardShouldPersistTaps="handled" on every ScrollView in the modal', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../components/AddMemberModal.tsx'), 'utf8');
    const scrolls = (src.match(/<ScrollView/g) ?? []).length;
    const handled = (src.match(/keyboardShouldPersistTaps="handled"/g) ?? []).length;
    expect(scrolls).toBeGreaterThan(0);
    expect(handled).toBe(scrolls);
    const { container } = renderModal(6);
    expect(q(container, 'add-member-members-scroll').getAttribute('keyboardshouldpersisttaps')).toBe('handled');
  });

  it('should disable Share while an add is in flight', async () => {
    let resolve: (v: any) => void = () => {};
    (groupService.addMemberByEmail as any).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderModal(1);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.click(q(container, 'add-member-add-button'));
    await waitFor(() => expect((q(container, 'add-member-whatsapp-share-button') as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    expect(Linking.openURL).not.toHaveBeenCalled();
    await act(async () => { resolve({ data: makeGroup(2) }); });
  });
});

describe('issue #144: Add press never reaches WhatsApp', () => {
  it.each([1, 6])('should call addMemberByEmail and never openURL when Add is pressed with %i members', async (n) => {
    (groupService.addMemberByEmail as any).mockResolvedValue({ data: makeGroup(n + 1) });
    const { container } = renderModal(n);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.click(q(container, 'add-member-add-button'));
    await waitFor(() => expect(groupService.addMemberByEmail).toHaveBeenCalledWith(1, 'a@b.com'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should ignore a Share press right after an Add press completes', async () => {
    (groupService.addMemberByEmail as any).mockResolvedValue({ data: makeGroup(2) });
    const { container } = renderModal(1);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.click(q(container, 'add-member-add-button'));
    await waitFor(() => expect(groupService.addMemberByEmail).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe('issue #144: WhatsApp share does not depend on canOpenURL', () => {
  it('should open whatsapp:// without calling canOpenURL', async () => {
    const { container } = renderModal(1);
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
    expect((Linking.openURL as any).mock.calls[0][0]).toMatch(/^whatsapp:\/\/send/);
    expect(Linking.canOpenURL).not.toHaveBeenCalled();
  });

  it('should fall back to wa.me when the whatsapp scheme fails', async () => {
    (Linking.openURL as any).mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(undefined);
    const { container } = renderModal(1);
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(2));
    expect((Linking.openURL as any).mock.calls[1][0]).toMatch(/^https:\/\/wa\.me\//);
  });
});
