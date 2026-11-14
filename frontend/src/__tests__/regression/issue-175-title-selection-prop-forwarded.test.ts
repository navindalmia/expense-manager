/**
 * Issue #175: the caret-at-end fix needs the Title TextInput to receive both
 * the `selection` prop and a ref (so the caret can be re-applied after
 * Android's native text update). Guard that they stay wired to the native
 * TextInput and that the imperative re-apply exists.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(path.resolve(__dirname, '../../screens/EditExpenseScreen.tsx'), 'utf8');

describe('issue #175: title input selection wiring', () => {
  it('should pass ref and selection straight to the title TextInput', () => {
    expect(src).toMatch(/<TextInput ref=\{titleInputRef\} selection=\{titleSelection\}[^>]*testID="edit-expense-title-input"/);
  });

  it('should re-apply the caret imperatively after the native text update', () => {
    expect(src).toMatch(/setSelection\?\.\(end, end\)/);
    expect(src).toMatch(/setNativeProps\?\.\(\{ selection: \{ start: end, end \} \}\)/);
    expect(src).toMatch(/requestAnimationFrame\(applyCaret\)/);
  });
});
