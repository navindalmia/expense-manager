import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import KeyboardAwareScroll from '../KeyboardAwareScroll';

describe('KeyboardAwareScroll', () => {
  it('should render its header above the content, both inside the scroll wrapper', () => {
    const { container, getByText } = render(
      <KeyboardAwareScroll header={<span>header</span>}>
        <span>body</span>
      </KeyboardAwareScroll>
    );
    expect(getByText('header')).toBeTruthy();
    expect(getByText('body')).toBeTruthy();
    const html = container.innerHTML;
    expect(html.indexOf('header')).toBeLessThan(html.indexOf('body'));
  });
});
