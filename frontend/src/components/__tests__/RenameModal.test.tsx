import React from 'react';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import RenameModal from '../RenameModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function q(id: string): HTMLElement | null {
  return document.querySelector(`[testid="rename-${id}"]`);
}
function input(): HTMLInputElement {
  return q('input') as HTMLInputElement;
}
function isDisabled(el: HTMLElement | null): boolean {
  return el?.getAttribute('aria-disabled') === 'true' || el?.hasAttribute('disabled') === true;
}

describe('RenameModal', () => {
  const onCancel = vi.fn();
  let onSave: Mock<(name: string) => Promise<void>>;

  function renderModal(props: Partial<React.ComponentProps<typeof RenameModal>> = {}) {
    return render(
      <RenameModal visible title="Rename" initialName="Old" onSave={onSave} onCancel={onCancel} {...props} />
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onSave = vi.fn<(name: string) => Promise<void>>().mockResolvedValue(undefined);
  });

  it('should seed the input with the initial name', () => {
    renderModal();
    expect(input().value).toBe('Old');
  });

  it('should block saving when the name is empty or whitespace', () => {
    renderModal();

    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.click(q('save-button') as HTMLElement);

    expect(isDisabled(q('save-button'))).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('should trim the name before calling onSave', async () => {
    renderModal();

    fireEvent.change(input(), { target: { value: '  New name  ' } });
    fireEvent.click(q('save-button') as HTMLElement);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('New name'));
  });

  it('should show the error on a rejected save and clear it when the user edits', async () => {
    onSave.mockRejectedValue(new Error('Name already exists'));
    renderModal();

    fireEvent.click(q('save-button') as HTMLElement);
    await waitFor(() => expect(q('error')).not.toBeNull());
    expect(q('error')?.textContent).toContain('Name already exists');
    expect(input().value).toBe('Old');

    fireEvent.change(input(), { target: { value: 'Other' } });

    expect(q('error')).toBeNull();
  });

  it('should disable the Cancel and Save buttons while submitting', async () => {
    let finish: () => void = () => undefined;
    onSave.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderModal();

    fireEvent.click(q('save-button') as HTMLElement);

    await waitFor(() => expect(isDisabled(q('save-button'))).toBe(true));
    expect(isDisabled(q('cancel-button'))).toBe(true);
    // (editable={false} is not reflected as a DOM attribute under the RN-web
    // test shim, so only the buttons are asserted here.)
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
    });
    await waitFor(() => expect(isDisabled(q('save-button'))).toBe(false));
  });

  it('should re-seed the name and clear the error when reopened for another item', async () => {
    onSave.mockRejectedValue(new Error('boom'));
    const { rerender } = renderModal();
    fireEvent.change(input(), { target: { value: 'Typed' } });
    fireEvent.click(q('save-button') as HTMLElement);
    await waitFor(() => expect(q('error')).not.toBeNull());

    rerender(<RenameModal visible={false} title="Rename" initialName="Old" onSave={onSave} onCancel={onCancel} />);
    rerender(<RenameModal visible title="Rename" initialName="Another" onSave={onSave} onCancel={onCancel} />);

    await waitFor(() => expect(input().value).toBe('Another'));
    expect(q('error')).toBeNull();
  });
});
