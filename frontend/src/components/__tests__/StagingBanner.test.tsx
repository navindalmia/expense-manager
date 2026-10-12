import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const state = vi.hoisted(() => ({ staging: false }));
vi.mock('../../utils/appVariant', () => ({ isStaging: () => state.staging }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}));

import StagingBanner, { StagingFrame, STAGING_BANNER_TEXT } from '../StagingBanner';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StagingBanner', () => {
  beforeEach(() => { state.staging = false; });

  it('should render the staging text and testID when staging', () => {
    state.staging = true;
    const { container } = render(<StagingBanner />);
    expect(container.querySelector('[testid="staging-banner"]')).not.toBeNull();
    expect(container.textContent).toBe(STAGING_BANNER_TEXT);
  });
  it('should render nothing when not staging', () => {
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });
  it('should leave children untouched in production', () => {
    const { container } = render(<StagingFrame><span>child</span></StagingFrame>);
    expect(container.innerHTML).toBe('<span>child</span>');
  });
  it('should show banner above children when staging', () => {
    state.staging = true;
    const { container } = render(<StagingFrame><span>child</span></StagingFrame>);
    expect(container.querySelector('[testid="staging-banner"]')).not.toBeNull();
    expect(container.textContent).toContain('child');
  });
});
