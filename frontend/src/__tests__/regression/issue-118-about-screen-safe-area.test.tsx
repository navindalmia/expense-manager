import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { AboutInfo } from '../../utils/aboutInfo';

// Regression for issue #118 on the About screen: after merging the uniform-layout rule
// (every screen is rooted in ScreenContainer / a safe-area view), AboutScreen had a bare
// ScrollView root and its bottom rows could sit under the Android navigation bar.
const info: AboutInfo = {
  appName: 'Expense Manager', version: '1.0.0', buildNumber: '1', environment: 'production',
  updateId: null, updateCreatedAt: null, isEmbedded: true,
};
vi.mock('../../utils/aboutInfo', () => ({ getAboutInfo: () => info }));

import AboutScreen from '../../screens/AboutScreen';

describe('issue 118: About screen layout', () => {
  it('should render the About content inside a safe-area root', () => {
    const { container } = render(<AboutScreen />);
    const safeArea = container.querySelector('[data-rn-safe-area-view="true"]');
    expect(safeArea).not.toBeNull();
    expect(safeArea?.querySelector('[testid="about-screen"]')).not.toBeNull();
  });
});
