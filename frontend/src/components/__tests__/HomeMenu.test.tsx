import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import HomeMenu, { type HomeMenuItem } from '../HomeMenu';

const q = (c: HTMLElement, id: string): HTMLElement | null => c.querySelector(`[testid="${id}"]`);

function makeItems(): { items: HomeMenuItem[]; fns: Record<string, ReturnType<typeof vi.fn>> } {
  const fns = { about: vi.fn(), themes: vi.fn(), labels: vi.fn(), logout: vi.fn() };
  const items: HomeMenuItem[] = [
    { key: 'about', label: 'About', testID: 'home-menu-about', onPress: fns.about },
    { key: 'themes', label: 'Themes', testID: 'home-menu-themes', onPress: fns.themes },
    { key: 'labels', label: 'Labels', testID: 'home-menu-labels', onPress: fns.labels },
    { key: 'logout', label: 'Logout', testID: 'home-menu-logout', onPress: fns.logout },
  ];
  return { items, fns };
}

// Note: the shared test setup mocks Modal and TouchableOpacity as plain DOM elements, so these
// tests cover item order, close-then-act and backdrop dismissal only. Real Modal behaviour
// (Android back button, fade timing, popover position under the button) is covered by the
// Maestro flows and the on-device check.
describe('HomeMenu', () => {
  it('should show only the menu button until it is pressed', () => {
    const { container } = render(<HomeMenu items={makeItems().items} />);
    expect(q(container, 'home-menu-button')).not.toBeNull();
    expect(q(container, 'home-menu')).toBeNull();
  });

  it('should list every item, in order, after the button is pressed', () => {
    const { container } = render(<HomeMenu items={makeItems().items} />);
    fireEvent.click(q(container, 'home-menu-button') as HTMLElement);
    const labels = Array.from(container.querySelectorAll('[testid^="home-menu-"]'))
      .filter((el) => el.getAttribute('testid') !== 'home-menu-button' && el.getAttribute('testid') !== 'home-menu-backdrop')
      .map((el) => el.textContent);
    expect(labels).toEqual(['About', 'Themes', 'Labels', 'Logout']);
  });

  it('should close the menu and run the action when an item is chosen', () => {
    const { items, fns } = makeItems();
    const { container } = render(<HomeMenu items={items} />);
    fireEvent.click(q(container, 'home-menu-button') as HTMLElement);
    fireEvent.click(q(container, 'home-menu-logout') as HTMLElement);
    expect(fns.logout).toHaveBeenCalledTimes(1);
    expect(fns.about).not.toHaveBeenCalled();
    expect(q(container, 'home-menu')).toBeNull();
  });

  it('should close without running any action when the backdrop is pressed', () => {
    const { items, fns } = makeItems();
    const { container } = render(<HomeMenu items={items} />);
    fireEvent.click(q(container, 'home-menu-button') as HTMLElement);
    fireEvent.click(q(container, 'home-menu-backdrop') as HTMLElement);
    expect(q(container, 'home-menu')).toBeNull();
    Object.values(fns).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});
