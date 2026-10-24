import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import KeyboardAwareScroll, { FORM_BOTTOM_CLEARANCE } from '../../components/KeyboardAwareScroll';

// Regression #139: on a Samsung 3-button phone the Create/Cancel row at the end of Create Group was
// still partly under the system navigation buttons after the keyboard fix (#138), keyboard closed.
// The shared form scroller now always leaves a floor of scrollable space below the last control, so
// the buttons can be scrolled clear on every form screen. A screen's own larger padding is kept.
const bottomPadding = (c: HTMLElement): number =>
  Number(c.querySelector('[data-content-padding-bottom]')?.getAttribute('data-content-padding-bottom'));

describe('form bottom clearance (Samsung nav buttons)', () => {
  it('should always leave at least the minimum clearance below the last control', () => {
    const { container } = render(<KeyboardAwareScroll><span>x</span></KeyboardAwareScroll>);
    expect(FORM_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(64);
    expect(bottomPadding(container)).toBe(FORM_BOTTOM_CLEARANCE);
  });

  it('should raise a smaller screen padding to the minimum but keep a larger one', () => {
    const small = render(<KeyboardAwareScroll contentContainerStyle={{ paddingBottom: 12 }}><span>x</span></KeyboardAwareScroll>);
    expect(bottomPadding(small.container)).toBe(FORM_BOTTOM_CLEARANCE);
    const large = render(<KeyboardAwareScroll contentContainerStyle={{ paddingBottom: 200 }}><span>x</span></KeyboardAwareScroll>);
    expect(bottomPadding(large.container)).toBe(200);
  });
});
