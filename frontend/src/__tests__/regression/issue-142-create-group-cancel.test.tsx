/**
 * Regression test for GitHub issue #142: the Cancel button on Create Group did nothing.
 * Cancel must always leave the screen: via goBack when there is history, otherwise by navigating
 * Home (a screen opened with no back stack, e.g. after a web reload, made goBack a silent no-op),
 * and it must stay usable while a create request is in flight or hung.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import CreateGroupScreen from '../../screens/CreateGroupScreen';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPost = vi.fn();
vi.mock('../../api/http', () => ({ http: { post: (...a: unknown[]) => mockPost(...a) } }));
vi.mock('../../services/themeService', () => ({
  getThemes: vi.fn().mockResolvedValue([]),
  createTheme: vi.fn(),
}));
vi.mock('../../components/AddMemberModal', () => ({
  default: ({ visible }: { visible?: boolean }) => (visible ? <div id="member-modal" /> : null),
}));
vi.mock('../../components/CurrencyPicker', () => ({ default: () => null }));

interface NavMock {
  goBack: ReturnType<typeof vi.fn>;
  canGoBack: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
}

const makeNav = (canGoBack: boolean): NavMock => ({
  goBack: vi.fn(),
  canGoBack: vi.fn().mockReturnValue(canGoBack),
  reset: vi.fn(),
});

const renderScreen = (nav: NavMock): HTMLElement => {
  const props = { navigation: nav, route: { key: 'k', name: 'CreateGroup' } } as unknown as React.ComponentProps<typeof CreateGroupScreen>;
  return render(<CreateGroupScreen {...props} />).container;
};

const byTestId = (id: string): Element => document.querySelector(`[testid="${id}"]`) as Element;

describe('issue #142: Create Group Cancel always leaves the screen', () => {
  beforeEach(() => {
    cleanup();
    mockPost.mockReset();
  });

  it('should go back when there is history', () => {
    const nav = makeNav(true);
    renderScreen(nav);
    fireEvent.click(byTestId('cancel-button'));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('should navigate Home when there is no back stack', () => {
    const nav = makeNav(false);
    renderScreen(nav);
    fireEvent.click(byTestId('cancel-button'));
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Home' }] });
  });

  it('should still cancel while a create request is in flight', async () => {
    mockPost.mockReturnValue(new Promise(() => {}));
    const nav = makeNav(true);
    renderScreen(nav);
    fireEvent.change(byTestId('group-name-input'), {
      target: { value: 'Trip' },
    });
    fireEvent.click(byTestId('create-button'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    fireEvent.click(byTestId('cancel-button'));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  describe('late create result after Cancel', () => {
    const startCreateThenCancel = async (nav: NavMock, deferred: { resolve: (v: unknown) => void; reject: (e: unknown) => void }) => {
      mockPost.mockReturnValue(new Promise((resolve, reject) => { deferred.resolve = resolve; deferred.reject = reject; }));
      renderScreen(nav);
      fireEvent.change(byTestId('group-name-input'), { target: { value: 'Trip' } });
      fireEvent.click(byTestId('create-button'));
      await waitFor(() => expect(mockPost).toHaveBeenCalled());
      fireEvent.click(byTestId('cancel-button'));
    };

    it('should not open the member modal or navigate further when the POST resolves after Cancel', async () => {
      const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
      const nav = makeNav(true);
      const d = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
      await startCreateThenCancel(nav, d);
      await act(async () => { d.resolve({ data: { data: { id: 7, name: 'Trip' } } }); });
      expect(document.querySelector('#member-modal')).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
      expect(nav.goBack).toHaveBeenCalledTimes(1);
      expect(nav.reset).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('should not show an error Alert when the POST rejects after Cancel', async () => {
      const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
      const nav = makeNav(true);
      const d = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
      await startCreateThenCancel(nav, d);
      await act(async () => { d.reject(new Error('boom')); });
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('normal create and abort behaviour', () => {
    const typeNameAndCreate = async (): Promise<void> => {
      fireEvent.change(byTestId('group-name-input'), { target: { value: 'Trip' } });
      fireEvent.click(byTestId('create-button'));
      await waitFor(() => expect(mockPost).toHaveBeenCalled());
    };
    const okResponse = { data: { data: { id: 7, name: 'Trip' } } };

    it('should open the member modal and clear loading on a normal create', async () => {
      let resolve: (v: unknown) => void = () => {};
      mockPost.mockReturnValue(new Promise((r) => { resolve = r; }));
      renderScreen(makeNav(true));
      await typeNameAndCreate();
      await act(async () => { resolve(okResponse); });
      expect(document.querySelector('#member-modal')).not.toBeNull();
      expect(byTestId('create-button').textContent).toBe('Create');
    });

    it('should open the member modal on a normal create under StrictMode', async () => {
      let resolve: (v: unknown) => void = () => {};
      mockPost.mockReturnValue(new Promise((r) => { resolve = r; }));
      const props = { navigation: makeNav(true), route: { key: 'k', name: 'CreateGroup' } } as unknown as React.ComponentProps<typeof CreateGroupScreen>;
      render(<React.StrictMode><CreateGroupScreen {...props} /></React.StrictMode>);
      await typeNameAndCreate();
      await act(async () => { resolve(okResponse); });
      expect(document.querySelector('#member-modal')).not.toBeNull();
    });

    it('should still open the member modal when Create follows a Cancel on a screen that stayed mounted', async () => {
      mockPost.mockResolvedValue(okResponse);
      renderScreen(makeNav(true));
      fireEvent.click(byTestId('cancel-button'));
      await act(async () => { fireEvent.change(byTestId('group-name-input'), { target: { value: 'Trip' } }); });
      await act(async () => { fireEvent.click(byTestId('create-button')); });
      await waitFor(() => expect(document.querySelector('#member-modal')).not.toBeNull());
      expect(byTestId('create-button').textContent).toBe('Create');
    });

    it('should abort the request signal when Cancel is pressed', async () => {
      mockPost.mockReturnValue(new Promise(() => {}));
      renderScreen(makeNav(true));
      await typeNameAndCreate();
      const signal = mockPost.mock.calls[0][2].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      fireEvent.click(byTestId('cancel-button'));
      expect(signal.aborted).toBe(true);
    });

    it('should stay silent when the aborted request rejects with a cancel error', async () => {
      const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
      let reject: (e: unknown) => void = () => {};
      mockPost.mockReturnValue(new Promise((_r, j) => { reject = j; }));
      renderScreen(makeNav(true));
      await typeNameAndCreate();
      fireEvent.click(byTestId('cancel-button'));
      await act(async () => { reject(Object.assign(new Error('canceled'), { name: 'CanceledError' })); });
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('should not open the modal or alert when unmounted mid-request without Cancel', async () => {
      const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
      let resolve: (v: unknown) => void = () => {};
      mockPost.mockReturnValue(new Promise((r) => { resolve = r; }));
      const props = { navigation: makeNav(true), route: { key: 'k', name: 'CreateGroup' } } as unknown as React.ComponentProps<typeof CreateGroupScreen>;
      const view = render(<CreateGroupScreen {...props} />);
      await typeNameAndCreate();
      view.unmount();
      await act(async () => { resolve(okResponse); });
      expect(document.querySelector('#member-modal')).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  it('should ignore a second Cancel press so only one screen is popped', () => {
    const nav = makeNav(true);
    renderScreen(nav);
    fireEvent.click(byTestId('cancel-button'));
    fireEvent.click(byTestId('cancel-button'));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });
});
