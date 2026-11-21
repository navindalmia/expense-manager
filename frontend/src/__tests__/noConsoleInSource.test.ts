import fs from 'fs';
import path from 'path';

const FRONTEND_ROOT: string = path.resolve(__dirname, '..', '..');
const SOURCE_ROOTS: string[] = [path.join(FRONTEND_ROOT, 'src'), path.join(FRONTEND_ROOT, 'App.tsx')];
const ALLOWED: string = path.join('src', 'utils', 'logger.ts');

function listFiles(target: string): string[] {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry: fs.Dirent): string[] => {
    const full: string = path.join(target, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('logging discipline', () => {
  it('should route all diagnostics through utils/logger instead of raw console calls', () => {
    const offenders: string[] = SOURCE_ROOTS.flatMap(listFiles)
      .filter((file: string): boolean => !file.endsWith(ALLOWED))
      .filter((file: string): boolean => /\bconsole\.(log|warn|error|info|debug)\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file: string): string => path.relative(FRONTEND_ROOT, file));
    expect(offenders).toEqual([]);
  });
});
