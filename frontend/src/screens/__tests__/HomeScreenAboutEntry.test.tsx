import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../../api/http', () => ({ http: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
const logout = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout }) }));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: vi.fn() }));
vi.mock('../../components/EditGroupModal', () => ({ default: () => null }));

import HomeScreen from '../HomeScreen';

function renderHeader(): { container: HTMLElement; navigate: ReturnType<typeof vi.fn> } {
  const navigate = vi.fn();
  const setOptions = vi.fn();
  render(<HomeScreen {...(({ navigation: { navigate, setOptions }, route: { params: undefined } }) as unknown as React.ComponentProps<typeof HomeScreen>)} />);
  const headerRight = setOptions.mock.calls[0][0].headerRight as () => React.ReactElement;
  return { container: render(headerRight()).container, navigate };
}
const q = (c: HTMLElement, id: string): HTMLElement | null => c.querySelector(`[testid="${id}"]`);

describe('HomeScreen header menu', () => {
  it('should show one menu button instead of separate header buttons', () => {
    const { container } = renderHeader();
    expect(q(container, 'home-menu-button')).not.toBeNull();
    ['home-about-button', 'home-manage-themes-button', 'home-manage-labels-button', 'home-logout-button'].forEach((id) =>
      expect(q(container, id)).toBeNull());
  });

  it.each([
    ['home-menu-about', 'About'],
    ['home-menu-themes', 'ManageThemes'],
    ['home-menu-labels', 'ManageLabels'],
  ])('should navigate when %s is chosen', (id, route) => {
    const { container, navigate } = renderHeader();
    fireEvent.click(q(container, 'home-menu-button') as HTMLElement);
    fireEvent.click(q(container, id) as HTMLElement);
    expect(navigate).toHaveBeenCalledWith(route);
  });

  it('should log out when Logout is chosen', () => {
    const { container } = renderHeader();
    fireEvent.click(q(container, 'home-menu-button') as HTMLElement);
    fireEvent.click(q(container, 'home-menu-logout') as HTMLElement);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
