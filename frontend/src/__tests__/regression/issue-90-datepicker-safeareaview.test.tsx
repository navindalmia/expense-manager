/**
 * Issue #90: DatePickerModal imported the deprecated SafeAreaView from
 * 'react-native', which shows a LogBox warning when the picker opens.
 * react-native-web does not emit that warning in jsdom, so this is a
 * source-level check (multi-line-import aware) across non-test sources.
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

describe('issue 90: no deprecated SafeAreaView from react-native', () => {
  it('should import SafeAreaView only from react-native-safe-area-context', () => {
    const offenders = sourceFiles(SRC).filter((f) => {
      const re = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/g;
      const text = fs.readFileSync(f, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (/\bSafeAreaView\b/.test(m[1] ?? '')) return true;
      }
      return false;
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
