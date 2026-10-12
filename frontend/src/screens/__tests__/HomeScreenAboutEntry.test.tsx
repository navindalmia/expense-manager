import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../api/http', () => ({ http: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: vi.fn() }));
vi.mock('../../components/EditGroupModal', () => ({ default: () => null }));

import HomeScreen from '../HomeScreen';

describe('HomeScreen About entry', () => {
  it('should register a top-right About button that navigates to About, keeping the existing buttons', () => {
    const navigate = vi.fn();
    const setOptions = vi.fn();
    render(<HomeScreen {...(({ navigation: { navigate, setOptions }, route: { params: undefined } }) as unknown as React.ComponentProps<typeof HomeScreen>)} />);
    const headerRight = setOptions.mock.calls[0][0].headerRight as () => React.ReactElement;
    const { container } = render(headerRight());
    const about = container.querySelector('[testid="home-about-button"]') as HTMLElement;
    expect(about).not.toBeNull();
    ['home-manage-themes-button', 'home-manage-labels-button', 'home-logout-button'].forEach((id) =>
      expect(container.querySelector(`[testid="${id}"]`)).not.toBeNull());
    about.click();
    expect(navigate).toHaveBeenCalledWith('About');
  });
});
