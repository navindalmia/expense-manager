import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert, Linking } from 'react-native';
import AddMemberModal, { SHARE_AFTER_ADD_GUARD_MS } from '../../components/AddMemberModal';
import * as groupService from '../../services/groupService';
import type { Group } from '../../services/groupService';
import { getAddMemberStrings } from '../../i18n/addMemberStrings';

vi.mock('../../services/groupService', () => ({
  addMemberByEmail: vi.fn(),
  removeMemberFromGroup: vi.fn(),
}));
vi.mock('../../hooks/useKeyboardInset', () => ({
  KeyboardInsetView: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => <div {...p}>{children}</div>,
}));

// Regression #144: on real Android phones, with 3-4+ members, tapping Add fired WhatsApp Share
// ("WhatsApp is not installed"). Add, the members list and Share shared one ScrollView, so as the list
// grew the content shifted/scrolled under the tap. Structure now: fixed Add, bounded list scroll, fixed footer.
const makeGroup = (n: number): Group => ({
  id: 1, name: 'Trip', currency: { id: 1, code: 'USD', label: 'US Dollar' }, members: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `M${i}`, email: `m${i}@x.com` })),
} as unknown as Group); // only the fields the modal reads
type AddResult = Awaited<ReturnType<typeof groupService.addMemberByEmail>>;
const addResult = (n: number): AddResult => ({ data: makeGroup(n), addedMember: { id: 99, name: 'New', email: 'a@b.com' } });
const renderModal = (n: number) =>
  render(<AddMemberModal visible group={makeGroup(n)} onClose={vi.fn()} onMemberAdded={vi.fn()} />);
const q = (c: HTMLElement, id: string): HTMLElement => c.querySelector(`[testid="${id}"]`) as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
  vi.mocked(Linking.openURL).mockResolvedValue(undefined);
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

  it('should configure every rendered scroll node with keyboardShouldPersistTaps=handled, and the members list as nested-scrollable', () => {
    const { container } = renderModal(6);
    const scrolls = Array.from(container.querySelectorAll<HTMLElement>('[data-rn-scroll="true"]'));
    expect(scrolls.length).toBe(1);
    scrolls.forEach((n) => expect(n.getAttribute('keyboardshouldpersisttaps')).toBe('handled'));
    const list = q(container, 'add-member-members-scroll');
    expect(scrolls[0]).toBe(list);
    expect(list.getAttribute('data-nested-scroll')).toBe('true');
    scrolls.forEach((n) => {
      expect(n.contains(q(container, 'add-member-add-button'))).toBe(false);
      expect(n.contains(q(container, 'add-member-whatsapp-share-button'))).toBe(false);
    });
  });

  it("should wrap the modal content in the modal's own SafeAreaView so the footer clears the nav bar", () => {
    const { container } = renderModal(6);
    const safe = q(container, 'add-member-footer').closest('[data-rn-safe-area-view]');
    expect(safe).not.toBeNull();
    expect(safe?.contains(q(container, 'add-member-close-button'))).toBe(true);
  });

  it('should disable Share while an add is in flight', async () => {
    let resolve: (v: AddResult) => void = () => {};
    vi.mocked(groupService.addMemberByEmail).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderModal(1);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.click(q(container, 'add-member-add-button'));
    await waitFor(() => expect((q(container, 'add-member-whatsapp-share-button') as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    expect(Linking.openURL).not.toHaveBeenCalled();
    await act(async () => { resolve(addResult(2)); });
  });
});

describe('issue #144: Add press never reaches WhatsApp', () => {
  it.each([1, 6])('should call addMemberByEmail and never openURL when Add is pressed with %i members', async (n) => {
    vi.mocked(groupService.addMemberByEmail).mockResolvedValue(addResult(n + 1));
    const { container } = renderModal(n);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.click(q(container, 'add-member-add-button'));
    await waitFor(() => expect(groupService.addMemberByEmail).toHaveBeenCalledWith(1, 'a@b.com'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should ignore a Share press right after an Add press completes', async () => {
    vi.mocked(groupService.addMemberByEmail).mockResolvedValue(addResult(2));
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
    expect(vi.mocked(Linking.openURL).mock.calls[0][0]).toMatch(/^whatsapp:\/\/send/);
    expect(Linking.canOpenURL).not.toHaveBeenCalled();
  });

  it('should fall back to wa.me when the whatsapp scheme fails', async () => {
    vi.mocked(Linking.openURL).mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(undefined);
    const { container } = renderModal(1);
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(2));
    expect(vi.mocked(Linking.openURL).mock.calls[1][0]).toMatch(/^https:\/\/wa\.me\//);
  });
});

const addAndFinish = async (container: HTMLElement, ok: boolean): Promise<void> => {
  if (ok) vi.mocked(groupService.addMemberByEmail).mockResolvedValue(addResult(2));
  else vi.mocked(groupService.addMemberByEmail).mockRejectedValue(new Error('boom'));
  fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
  await act(async () => { fireEvent.click(q(container, 'add-member-add-button')); });
};

describe('issue #144: stray-tap guard timing', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it.each([true, false])('should ignore Share at +599ms and open it at +600ms after Add (success=%s)', async (ok) => {
    const { container } = renderModal(1);
    await addAndFinish(container, ok);
    vi.setSystemTime(Date.now() + SHARE_AFTER_ADD_GUARD_MS - 1);
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    expect(Linking.openURL).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 1);
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });

  it('should reset the guard when the modal is hidden', async () => {
    const { container, rerender } = renderModal(1);
    await addAndFinish(container, false);
    rerender(<AddMemberModal visible={false} group={makeGroup(1)} onClose={vi.fn()} onMemberAdded={vi.fn()} />);
    rerender(<AddMemberModal visible group={makeGroup(1)} onClose={vi.fn()} onMemberAdded={vi.fn()} />);
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });
});

describe('issue #144: Share re-entry and failure', () => {
  it('should open WhatsApp only once on a double tap while openURL is pending', async () => {
    let finish: () => void = () => {};
    vi.mocked(Linking.openURL).mockReturnValue(new Promise<void>((r) => { finish = r; }));
    const { container } = renderModal(1);
    const share = q(container, 'add-member-whatsapp-share-button');
    fireEvent.click(share);
    fireEvent.click(share);
    await act(async () => { finish(); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });

  it('should alert with the failure strings when both openURL attempts reject', async () => {
    vi.mocked(Linking.openURL).mockRejectedValue(new Error('no'));
    const { container } = renderModal(1);
    fireEvent.click(q(container, 'add-member-whatsapp-share-button'));
    const s = getAddMemberStrings();
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(s.shareFailedTitle, s.shareFailedBody));
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });
});

describe('issue #144: hiding the modal mid-flow', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  const setup = () => {
    const onMemberAdded = vi.fn();
    const onClose = vi.fn();
    const ui = (visible: boolean) => (
      <AddMemberModal visible={visible} group={makeGroup(1)} onClose={onClose} onMemberAdded={onMemberAdded} />
    );
    const utils = render(ui(true));
    return { ...utils, ui, onMemberAdded, onClose };
  };
  const expectReset = (container: HTMLElement) => {
    expect((q(container, 'add-member-email-input') as HTMLInputElement).disabled).toBe(false);
    expect((q(container, 'add-member-email-input') as HTMLInputElement).value).toBe('');
    expect(container.textContent).not.toMatch(/successfully|added/i);
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'c@d.com' } });
    expect((q(container, 'add-member-add-button') as HTMLButtonElement).disabled).toBe(false);
  };

  it('should reset success state and notify parent once when hidden during the success window', async () => {
    const { container, rerender, ui, onMemberAdded } = setup();
    await addAndFinish(container, true);
    rerender(ui(false));
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
    expect(onMemberAdded).toHaveBeenCalledWith(addResult(2).data);
    rerender(ui(true));
    expectReset(container);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
  });

  it('should behave the same when handleClose runs during the success window', async () => {
    const { container, onMemberAdded, onClose } = setup();
    await addAndFinish(container, true);
    await act(async () => { fireEvent.click(q(container, 'add-member-close-button')); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
    expectReset(container);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
  });

  it('should notify parent but set no success state or timer when the add resolves after hide', async () => {
    let resolve: (v: AddResult) => void = () => {};
    vi.mocked(groupService.addMemberByEmail).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container, rerender, ui, onMemberAdded } = setup();
    fireEvent.change(q(container, 'add-member-email-input'), { target: { value: 'a@b.com' } });
    await act(async () => { fireEvent.click(q(container, 'add-member-add-button')); });
    rerender(ui(false));
    await act(async () => { resolve(addResult(2)); });
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    rerender(ui(true));
    expectReset(container);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
  });

  it('should not allow an overlapping share when hidden while a share is pending, and clear the flag after', async () => {
    let finish: () => void = () => {};
    vi.mocked(Linking.openURL).mockReturnValueOnce(new Promise<void>((r) => { finish = r; }));
    const { container, rerender, ui } = setup();
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    rerender(ui(false));
    rerender(ui(true));
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    vi.mocked(Linking.openURL).mockResolvedValue(undefined);
    await act(async () => { fireEvent.click(q(container, 'add-member-whatsapp-share-button')); });
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });
});
