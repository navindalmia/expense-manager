import fs from 'fs';
import path from 'path';
import { stripComments } from './helpers/stripComments';
import { FRONTEND_ROOT, listAppSourceFiles } from './helpers/walkSourceFiles';

const ALLOWED: string = path.join('src', 'utils', 'logger.ts');
// Any mention of the console identifier in code (every method, bracket access,
// aliasing, passing it as a value). Comments are ignored.
const CONSOLE_USE: RegExp = /\bconsole\b/;

function usesConsole(source: string): boolean {
  return CONSOLE_USE.test(stripComments(source));
}

describe('logging discipline', () => {
  it('should route all diagnostics through utils/logger instead of the console object', () => {
    const files: string[] = listAppSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = files
      .filter((file: string): boolean => !file.endsWith(ALLOWED))
      .filter((file: string): boolean => usesConsole(fs.readFileSync(file, 'utf8')))
      .map((file: string): string => path.relative(FRONTEND_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('should detect every console form, including aliasing', () => {
    for (const sample of ['console.trace()', 'console.table(x)', "console['log'](1)", 'console . group()', 'const c = console;', 'const { log } = console;']) {
      expect(usesConsole(sample)).toBe(true);
    }
  });

  it('should ignore console mentions in comments', () => {
    expect(usesConsole('// console.log removed\n/* console.warn */ const a = 1;')).toBe(false);
  });
});
