import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { AboutInfo } from '../../utils/aboutInfo';

const mockInfo: { value: AboutInfo } = { value: {} as AboutInfo };
vi.mock('../../utils/aboutInfo', () => ({ getAboutInfo: () => mockInfo.value }));

import AboutScreen from '../AboutScreen';

const base: AboutInfo = {
  appName: 'expense-manager', version: '1.0.0', buildNumber: null, environment: 'production',
  updateId: null, updateCreatedAt: null, isEmbedded: true,
};
const text = (c: HTMLElement, id: string): string | null =>
  c.querySelector(`[testid="${id}"]`)?.textContent ?? null;

describe('AboutScreen', () => {
  it('should render production version, environment and embedded build', () => {
    mockInfo.value = base;
    const { container } = render(<AboutScreen />);
    expect(text(container, 'about-version')).toBe('Version 1.0.0');
    expect(text(container, 'about-environment')).toBe('Environment: Production');
    expect(text(container, 'about-update')).toBe('Embedded build');
    expect(text(container, 'about-backend')).toBeNull();
    expect(text(container, 'about-build')).toBeNull();
  });

  it('should render staging with build number', () => {
    mockInfo.value = { ...base, environment: 'staging', buildNumber: '77' };
    const { container } = render(<AboutScreen />);
    expect(text(container, 'about-environment')).toBe('Environment: Staging');
    expect(text(container, 'about-build')).toBe('77');
  });

  it('should render OTA update id and date', () => {
    mockInfo.value = { ...base, isEmbedded: false, updateId: 'abcdef1', updateCreatedAt: '2026-10-01' };
    const { container } = render(<AboutScreen />);
    expect(text(container, 'about-update')).toBe('abcdef1 (2026-10-01)');
  });

  it('should render inside a safe-area view so content clears the system nav bar', () => {
    mockInfo.value = base;
    const { container } = render(<AboutScreen />);
    expect(container.querySelector('[data-rn-safe-area-view="true"] [testid="about-screen"]')).not.toBeNull();
  });
});
