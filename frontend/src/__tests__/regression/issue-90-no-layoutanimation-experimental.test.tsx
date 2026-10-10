/**
 * Issue #90: setLayoutAnimationEnabledExperimental is a no-op under the New
 * Architecture (app.json newArchEnabled: true) and logs a LogBox warning at
 * app open. Source-level scan (the warning is native-only, not reproducible
 * in jsdom) across non-test sources.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe('issue 90: no no-op setLayoutAnimationEnabledExperimental', () => {
  it('should not call setLayoutAnimationEnabledExperimental in app sources', () => {
    const offenders = sourceFiles(SRC).filter((f) =>
      /setLayoutAnimationEnabledExperimental/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
