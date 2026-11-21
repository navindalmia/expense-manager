import fs from 'fs';
import path from 'path';

export const FRONTEND_ROOT: string = path.resolve(__dirname, '..', '..', '..');

/**
 * Lists every non-test TypeScript source file under the given files or
 * directories (skips any `__tests__` directory). Shared by the static
 * source-scan tests so the exclusion rule lives in one place.
 */
export function walkSourceFiles(target: string): string[] {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry: fs.Dirent): string[] => {
    const full: string = path.join(target, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walkSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** All app source: `src/` plus the root `App.tsx`. */
export function listAppSourceFiles(): string[] {
  return [path.join(FRONTEND_ROOT, 'src'), path.join(FRONTEND_ROOT, 'App.tsx')].flatMap(walkSourceFiles);
}
