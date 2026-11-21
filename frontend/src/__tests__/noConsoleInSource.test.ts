import fs from 'fs';
import path from 'path';
import { FRONTEND_ROOT, listAppSourceFiles } from './helpers/walkSourceFiles';

const ALLOWED: string = path.join('src', 'utils', 'logger.ts');
// Any use of the console object (log, warn, trace, table, dir, assert, group*,
// bracket access or aliasing), not just a fixed list of methods.
const CONSOLE_USE: RegExp = /\bconsole\s*(\.|\[)/;

describe('logging discipline', () => {
  it('should route all diagnostics through utils/logger instead of the console object', () => {
    const files: string[] = listAppSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = files
      .filter((file: string): boolean => !file.endsWith(ALLOWED))
      .filter((file: string): boolean => CONSOLE_USE.test(fs.readFileSync(file, 'utf8')))
      .map((file: string): string => path.relative(FRONTEND_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('should detect every console method form', () => {
    for (const sample of ['console.trace()', 'console.table(x)', 'console.assert(a)', "console['log'](1)", 'console . group()']) {
      expect(CONSOLE_USE.test(sample)).toBe(true);
    }
  });
});
