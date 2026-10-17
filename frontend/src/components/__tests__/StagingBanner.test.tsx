import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const state = vi.hoisted(() => ({ staging: false }));
vi.mock('../../utils/appVariant', () => ({ isStaging: () => state.staging }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('../../utils/updateInfo', () => ({ getUpdateLabel: () => 'upd a1b2c3d 12 Oct 19:04' }));

import StagingBanner, { STAGING_BANNER_TEXT } from '../StagingBanner';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StagingBanner', () => {
  beforeEach(() => { state.staging = false; });

  it('should render the staging text, update label and testID when staging', () => {
    state.staging = true;
    const { container } = render(<StagingBanner />);
    expect(container.querySelector('[testid="staging-banner"]')).not.toBeNull();
    expect(container.textContent).toBe(`${STAGING_BANNER_TEXT} | upd a1b2c3d 12 Oct 19:04`);
  });

  it('should render nothing in production', () => {
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing in production even when padTop is requested', () => {
    const { container } = render(<StagingBanner padTop />);
    expect(container.innerHTML).toBe('');
  });
});
