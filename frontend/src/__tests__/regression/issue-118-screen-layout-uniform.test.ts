/**
 * Issue #118: on the staging app the Create Group screen's Create/Cancel buttons were hidden
 * under the Android navigation bar. Cause: an app-root wrapper (StagingFrame) resized every
 * screen, and CreateGroupScreen had no bottom safe-area handling of its own.
 *
 * Guards (source-level, because CI never builds the staging variant):
 *  1. every screen root uses the shared ScreenContainer (or a safe-area SafeAreaView),
 *  2. no app-root layout wrapper around the navigator,
 *  3. the staging marker adds no layout wrapper (it is header options + in-flow banners only).
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '../..');
const APP = path.resolve(SRC, '../App.tsx');

/**
 * Headerless auth screens that predate ScreenContainer. Moving them needs their Maestro
 * baselines re-taken; tracked as follow-up. Add NO new entries: new screens must use ScreenContainer.
 */
const LEGACY_EXEMPT = new Set(['LoginScreen.tsx', 'CheckEmailScreen.tsx', 'VerifyEmailScreen.tsx']);

function screenFiles(): string[] {
  const dir = path.join(SRC, 'screens');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      if (e.isFile() && /Screen\.tsx$/.test(e.name)) return [path.join(dir, e.name)];
      if (e.isDirectory() && e.name !== '__tests__') {
        const main = path.join(dir, e.name, `${e.name}.tsx`);
        return fs.existsSync(main) ? [main] : [];
      }
      return [];
    })
    .filter((f) => !/\.test\./.test(f));
}

describe('issue 118: uniform, inset-safe screen layout', () => {
  it('should find the screens it is meant to guard', () => {
    expect(screenFiles().length).toBeGreaterThanOrEqual(10);
  });

  it('should use ScreenContainer or a safe-area SafeAreaView on every screen', () => {
    const offenders = screenFiles().filter((f) => {
      if (LEGACY_EXEMPT.has(path.basename(f))) return false;
      const text = fs.readFileSync(f, 'utf8');
      const usesContainer = /\bScreenContainer\b/.test(text);
      const usesSafeArea = /import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*['"]react-native-safe-area-context['"]/.test(text);
      return !(usesContainer || usesSafeArea);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('should keep the Create Group buttons inside ScreenContainer (hidden under the nav bar in #118)', () => {
    const text = fs.readFileSync(path.join(SRC, 'screens/CreateGroupScreen.tsx'), 'utf8');
    expect(text).toMatch(/<ScreenContainer\b/);
  });

  it('should not wrap the navigator in an app-root layout wrapper', () => {
    const text = fs.readFileSync(APP, 'utf8');
    expect(text).not.toMatch(/StagingFrame/);
    expect(text).toMatch(/getStagingScreenOptions\(\)/);
  });

  it('should not export a layout-wrapping StagingFrame from the banner module', () => {
    const text = fs.readFileSync(path.join(SRC, 'components/StagingBanner.tsx'), 'utf8');
    expect(text).not.toMatch(/StagingFrame|SafeAreaInsetsContext/);
  });
});
