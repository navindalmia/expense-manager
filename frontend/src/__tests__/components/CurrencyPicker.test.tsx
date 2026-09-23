/**
 * CurrencyPicker tests (GitHub #51 review follow-up).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import CurrencyPicker from '../../components/CurrencyPicker';
import { getCurrencies, type Currency } from '../../services/currencyService';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/currencyService', () => ({ getCurrencies: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const list: Currency[] = [
  { id: 1, code: 'GBP', label: 'Pound' },
  { id: 2, code: 'SGD', label: 'Singapore Dollar' },
];
const PREFIX = 'cp-';
const option = (code: string): Element | null => document.querySelector(`[testid="${PREFIX}${code}"]`);

describe('CurrencyPicker', () => {
  beforeEach(() => {
    vi.mocked(getCurrencies).mockReset();
  });
  afterEach(cleanup);

  it('should show a loading spinner while currencies load', () => {
    vi.mocked(getCurrencies).mockReturnValue(new Promise<Currency[]>(() => undefined));
    render(<CurrencyPicker value="GBP" onChange={vi.fn()} testIDPrefix={PREFIX} />);
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('should show an error message and re-fetch when Retry is pressed', async () => {
    vi.mocked(getCurrencies).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(list);
    render(<CurrencyPicker value="GBP" onChange={vi.fn()} testIDPrefix={PREFIX} />);
    await waitFor(() => expect(screen.getByText('Could not load currencies.')).toBeTruthy());
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(option('SGD')).not.toBeNull());
    expect(getCurrencies).toHaveBeenCalledTimes(2);
  });

  it('should show the empty message when no currencies are returned', async () => {
    vi.mocked(getCurrencies).mockResolvedValue([]);
    render(<CurrencyPicker value="GBP" onChange={vi.fn()} testIDPrefix={PREFIX} />);
    await waitFor(() => expect(screen.getByText('No currencies are available.')).toBeTruthy());
  });

  it('should call onChange with the pressed currency', async () => {
    vi.mocked(getCurrencies).mockResolvedValue(list);
    const onChange = vi.fn();
    render(<CurrencyPicker value="GBP" onChange={onChange} testIDPrefix={PREFIX} />);
    await waitFor(() => expect(option('SGD')).not.toBeNull());
    fireEvent.click(option('SGD') as Element);
    expect(onChange).toHaveBeenCalledWith('SGD');
  });

  it('should not call onChange when disabled', async () => {
    vi.mocked(getCurrencies).mockResolvedValue(list);
    const onChange = vi.fn();
    render(<CurrencyPicker value="GBP" onChange={onChange} disabled testIDPrefix={PREFIX} />);
    await waitFor(() => expect(option('SGD')).not.toBeNull());
    fireEvent.click(option('SGD') as Element);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not update state or warn when unmounted before the fetch resolves', async () => {
    let resolve: (c: Currency[]) => void = () => undefined;
    vi.mocked(getCurrencies).mockReturnValue(new Promise<Currency[]>((r) => (resolve = r)));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = render(<CurrencyPicker value="GBP" onChange={vi.fn()} testIDPrefix={PREFIX} />);
    unmount();
    await act(async () => {
      resolve(list);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should fall back to the first loaded currency when value is not in the list', async () => {
    vi.mocked(getCurrencies).mockResolvedValue(list);
    const onChange = vi.fn();
    render(<CurrencyPicker value="CNY" onChange={onChange} testIDPrefix={PREFIX} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('GBP'));
  });

  it('should not call onChange when value is in the list', async () => {
    vi.mocked(getCurrencies).mockResolvedValue(list);
    const onChange = vi.fn();
    render(<CurrencyPicker value="SGD" onChange={onChange} testIDPrefix={PREFIX} />);
    await waitFor(() => expect(option('SGD')).not.toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });
});
