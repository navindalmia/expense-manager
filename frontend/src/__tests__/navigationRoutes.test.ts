import fs from 'fs';
import path from 'path';

const FRONTEND_ROOT: string = path.resolve(__dirname, '..', '..');
const SRC: string = path.join(FRONTEND_ROOT, 'src');

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: fs.Dirent): string[] => {
    const full: string = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function registeredRoutes(): string[] {
  const app: string = fs.readFileSync(path.join(FRONTEND_ROOT, 'App.tsx'), 'utf8');
  return [...app.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)].map((m: RegExpMatchArray): string => m[1]);
}

function navigatedRoutes(): string[] {
  const names: Set<string> = new Set<string>();
  for (const file of listSourceFiles(SRC)) {
    const text: string = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/navigate\(\s*['"](\w+)['"]/g)) names.add(m[1]);
  }
  return [...names];
}

describe('navigation routes', () => {
  it('should register a screen for every route the app navigates to', () => {
    const registered: string[] = registeredRoutes();
    const missing: string[] = navigatedRoutes().filter((r: string): boolean => !registered.includes(r));
    expect(missing).toEqual([]);
  });

  it('should use EditExpense (create mode) as the only expense form route', () => {
    const registered: string[] = registeredRoutes();
    expect(registered).toContain('EditExpense');
    expect(registered).not.toContain('CreateExpense');
    expect(navigatedRoutes()).not.toContain('CreateExpense');
  });
});
