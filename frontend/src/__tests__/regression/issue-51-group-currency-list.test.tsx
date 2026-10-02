/**
 * Regression test for GitHub issue #51.
 *
 * The group Create screen offered a hardcoded currency list (including
 * CNY, which the DB does not have, and missing SGD/HKD/CHF/NZD/SEK) while
 * the Edit group modal listed the currencies fetched from the backend.
 * Both must now show the backend's list.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import CreateGroupScreen from '../../screens/CreateGroupScreen';
import EditGroupModal from '../../components/EditGroupModal';
import type { Group } from '../../services/groupService';
import { getCurrencies } from '../../services/currencyService';
import { http } from '../../api/http';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const backendCodes = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'NZD', 'SEK', 'SGD', 'USD'];
const backendCurrencies = backendCodes.map((code, i) => ({ id: i + 1, code, label: code }));

vi.mock('../../services/currencyService', () => ({
  getCurrencies: vi.fn(),
}));
vi.mock('../../services/themeService', () => ({
  getThemes: vi.fn().mockResolvedValue([]),
  createTheme: vi.fn(),
}));
vi.mock('../../api/http', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const CREATE_PREFIX = 'currency-';
const EDIT_PREFIX = 'edit-group-currency-option-';

type CreateProps = React.ComponentProps<typeof CreateGroupScreen>;
const createProps = { navigation: { goBack: vi.fn() } } as unknown as CreateProps;

function codesIn(prefix: string): string[] {
  return Array.from(document.querySelectorAll('[testid]'))
    .map((el) => el.getAttribute('testid') ?? '')
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length))
    .sort();
}

const group = {
  id: 1,
  name: 'G',
  description: '',
  currency: { id: 1, code: 'GBP', label: 'GBP' },
  members: [],
} as unknown as Group;

describe('issue #51: group currency list is identical on create and edit', () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(getCurrencies).mockResolvedValue(backendCurrencies);
    vi.mocked(http.post).mockReset();
  });

  it('should list exactly the backend currencies on the create screen', async () => {
    render(<CreateGroupScreen {...createProps} />);
    await waitFor(() => expect(codesIn(CREATE_PREFIX)).toContain('SGD'));
    expect(codesIn(CREATE_PREFIX)).toEqual(backendCodes);
    expect(codesIn(CREATE_PREFIX)).not.toContain('CNY');
  });

  it('should list the same currencies on the create screen as on the edit modal', async () => {
    render(<EditGroupModal visible group={group} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(codesIn(EDIT_PREFIX)).toContain('SGD'));
    const editCodes = codesIn(EDIT_PREFIX);
    expect(editCodes).toEqual(backendCodes);
    cleanup();

    render(<CreateGroupScreen {...createProps} />);
    await waitFor(() => expect(codesIn(CREATE_PREFIX)).toContain('SGD'));
    expect(codesIn(CREATE_PREFIX)).toEqual(editCodes);
  });

  it('should submit the pressed currency in the create-group payload', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: { id: 9, name: 'Trip' } } });
    render(<CreateGroupScreen {...createProps} />);
    await waitFor(() => expect(codesIn(CREATE_PREFIX)).toContain('SGD'));

    fireEvent.change(document.querySelector('[testid="group-name-input"]') as Element, {
      target: { value: 'Trip' },
    });
    fireEvent.click(document.querySelector('[testid="currency-SGD"]') as Element);
    fireEvent.click(document.querySelector('[testid="create-button"]') as Element);

    await waitFor(() => expect(http.post).toHaveBeenCalled());
    expect(http.post).toHaveBeenCalledWith('/groups', expect.objectContaining({ currency: 'SGD' }));
  });
});
