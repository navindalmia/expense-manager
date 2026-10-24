import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CREATE_GROUP_MIN_BOTTOM_CLEARANCE } from '../../screens/createGroupLayout';
import CreateGroupScreen from '../../screens/CreateGroupScreen';

// Regression: on a Samsung phone the Create button on Create Group sat under the system navigation
// buttons although it was fine on another phone. The screen relied only on the reported bottom
// inset, which is 0 in some Samsung nav-bar modes (the test setup mocks insets as 0 too). The
// scroll content must keep a fixed floor of space below the button regardless of the inset.
vi.mock('../../services/themeService', () => ({ getThemes: vi.fn().mockResolvedValue([]), createTheme: vi.fn() }));
vi.mock('../../api/http', () => ({ http: { post: vi.fn(), get: vi.fn().mockResolvedValue({ data: [] }) } }));

describe('Create Group bottom clearance (Samsung nav bar)', () => {
  it('should keep a minimum paddingBottom under the form even when the safe-area inset is 0', () => {
    const navigation = { goBack: vi.fn(), navigate: vi.fn() } as never;
    const { container } = render(<CreateGroupScreen navigation={navigation} route={{} as never} />);
    const scroller = container.querySelector('[data-content-padding-bottom]');
    expect(CREATE_GROUP_MIN_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(48);
    expect(Number(scroller?.getAttribute('data-content-padding-bottom'))).toBeGreaterThanOrEqual(CREATE_GROUP_MIN_BOTTOM_CLEARANCE);
  });
});
