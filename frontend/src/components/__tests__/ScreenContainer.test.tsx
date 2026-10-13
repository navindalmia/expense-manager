import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const state = vi.hoisted(() => ({ staging: false, lastEdges: [] as string[] }));
vi.mock('../../utils/appVariant', () => ({ isStaging: () => state.staging }));
vi.mock('../../utils/updateInfo', () => ({ getUpdateLabel: () => null }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
  SafeAreaView: ({ edges, children }: { edges: string[]; children: React.ReactNode }) => {
    state.lastEdges = edges;
    return <div data-testid="safe-area">{children}</div>;
  },
}));

import ScreenContainer from '../ScreenContainer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScreenContainer', () => {
  beforeEach(() => { state.staging = false; state.lastEdges = []; });

  it('should inset bottom, left and right (not top) under a native header so buttons clear the nav bar', () => {
    const { getByText } = render(<ScreenContainer><span>content</span></ScreenContainer>);
    expect(getByText('content')).toBeTruthy();
    expect(state.lastEdges).toEqual(['bottom', 'left', 'right']);
  });

  it('should not render the staging banner in production', () => {
    const { container } = render(<ScreenContainer withHeader={false}><span>content</span></ScreenContainer>);
    expect(container.querySelector('[testid="staging-banner"]')).toBeNull();
  });

  it('should show the staging banner on headerless screens when staging', () => {
    state.staging = true;
    const { container } = render(<ScreenContainer withHeader={false}><span>content</span></ScreenContainer>);
    expect(container.querySelector('[testid="staging-banner"]')).not.toBeNull();
  });

  it('should not add a banner on screens that have a header (the header carries the marker)', () => {
    state.staging = true;
    const { container } = render(<ScreenContainer><span>content</span></ScreenContainer>);
    expect(container.querySelector('[testid="staging-banner"]')).toBeNull();
  });
});
