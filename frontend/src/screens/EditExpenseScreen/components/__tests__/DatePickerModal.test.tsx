/**
 * DatePickerModal tests: an invalid selectedDate must fall back to today and
 * report through the logger (not the console).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { logger } from '../../../../utils/logger';
import { DatePickerModal } from '../DatePickerModal';

function renderPicker(selectedDate: string) {
  return render(<DatePickerModal visible selectedDate={selectedDate} onSelectDate={vi.fn()} onClose={vi.fn()} />);
}

describe('DatePickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should warn through the logger when selectedDate is not YYYY-MM-DD', () => {
    renderPicker('not-a-date');

    expect(logger.warn).toHaveBeenCalledWith('Invalid date format, expected YYYY-MM-DD', { dateStr: 'not-a-date' });
  });

  it('should not warn when selectedDate is a valid YYYY-MM-DD string', () => {
    renderPicker('2026-04-11');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
