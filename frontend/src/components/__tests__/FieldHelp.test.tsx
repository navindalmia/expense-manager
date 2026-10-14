/**
 * FieldHelp Tests (R10): the info affordance next to Category/Label/Theme.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FieldHelp, { HELP_TEXT, type HelpTopic } from '../FieldHelp';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function byTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`);
}

const TOPICS: HelpTopic[] = ['Label', 'Theme', 'Category'];

describe('FieldHelp', () => {
  it.each(TOPICS)('should expose an accessible "What is a %s?" button', (topic) => {
    const { container } = render(<FieldHelp topic={topic} testIDPrefix="f" />);

    const button = byTestId(container, 'f-help-button');
    expect(button).not.toBeNull();
    // The RN mock passes accessibilityLabel through as a lowercase DOM attribute.
    expect(button?.getAttribute('accessibilitylabel')).toBe(`What is a ${topic}?`);
  });

  it.each(TOPICS)('should open distinct explanatory text for %s and dismiss on outside tap', (topic) => {
    const { container } = render(<FieldHelp topic={topic} testIDPrefix="f" />);
    expect(byTestId(container, 'f-help-popover')).toBeNull();

    fireEvent.click(byTestId(container, 'f-help-button') as HTMLElement);
    expect(screen.getByText(HELP_TEXT[topic])).toBeTruthy();

    fireEvent.click(byTestId(container, 'f-help-backdrop') as HTMLElement);
    expect(byTestId(container, 'f-help-popover')).toBeNull();
  });

  it('should have a different explainer for each field', () => {
    expect(new Set(Object.values(HELP_TEXT)).size).toBe(TOPICS.length);
  });
});
