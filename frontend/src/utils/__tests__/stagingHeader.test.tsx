import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const state = vi.hoisted(() => ({ staging: false }));
vi.mock('../appVariant', () => ({ isStaging: () => state.staging }));

import { getStagingScreenOptions } from '../stagingHeader';
import { STAGING_ORANGE } from '../../components/StagingBanner';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('getStagingScreenOptions', () => {
  beforeEach(() => { state.staging = false; });

  it('should return no options in production so the navigator is unchanged', () => {
    expect(getStagingScreenOptions()).toEqual({});
  });

  it('should colour the header orange and tag the title when staging', () => {
    state.staging = true;
    const options = getStagingScreenOptions();
    expect(options.headerStyle).toEqual({ backgroundColor: STAGING_ORANGE });
    expect(options.headerTintColor).toBe('#FFFFFF');
    const Title = options.headerTitle as React.ComponentType<{ children: string }>;
    const { container } = render(<Title>Create Group</Title>);
    expect(container.textContent).toContain('Create Group');
    expect(container.textContent).toContain('STAGING');
  });
});
