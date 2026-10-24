/**
 * Issue #138: on a Samsung 3-button phone the Create Group Create/Cancel buttons sat under the system
 * navigation buttons. Cause: CreateGroupScreen still used KeyboardAvoidingView behavior='height' on
 * Android, which cannot work on edge-to-edge Android (the window never resizes) and left the layout
 * offset by the nav-bar height. The standard keyboard handling (#111) had been applied to some screens
 * only. Every scrolling-form screen now uses the shared KeyboardAwareScroll.
 *
 * Guards (source-level):
 *  1. no screen imports KeyboardAvoidingView / KeyboardInsetView directly (use KeyboardAwareScroll),
 *  2. nothing in src sets KeyboardAvoidingView behavior to 'height',
 *  3. the shared component itself uses 'padding' on iOS and nothing on Android.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const rel = (p: string): string => path.relative(SRC, p);

describe('keyboard handling standard (issue #138)', () => {
  const screens = sourceFiles(path.join(SRC, 'screens'));

  it('should not let any screen use KeyboardAvoidingView or KeyboardInsetView directly', () => {
    const offenders = screens.filter((f) => /KeyboardAvoidingView|KeyboardInsetView/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("should not use KeyboardAvoidingView behavior='height' anywhere (it breaks edge-to-edge Android)", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => /behavior=\{[^}]*'height'/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('should keep the shared component on padding for iOS and no behavior on Android', () => {
    const src = fs.readFileSync(path.join(SRC, 'components', 'KeyboardAwareScroll.tsx'), 'utf8');
    expect(src).toContain("Platform.OS === 'ios' ? 'padding' : undefined");
  });

  it('should use KeyboardAwareScroll on the scrolling-form screens', () => {
    for (const name of ['CreateGroupScreen', 'CreateExpenseScreen', 'EditExpenseScreen', 'LoginScreen', 'VerifyEmailScreen', 'CheckEmailScreen']) {
      expect(fs.readFileSync(path.join(SRC, 'screens', `${name}.tsx`), 'utf8')).toContain('<KeyboardAwareScroll');
    }
  });
});
