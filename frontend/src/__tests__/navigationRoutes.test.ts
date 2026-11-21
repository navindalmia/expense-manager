import fs from 'fs';
import path from 'path';
import { FRONTEND_ROOT, listAppSourceFiles } from './helpers/walkSourceFiles';
import { extractNavigationTargets, NavigationTargets } from './helpers/navigationTargets';

function registeredRoutes(): string[] {
  const app: string = fs.readFileSync(path.join(FRONTEND_ROOT, 'App.tsx'), 'utf8');
  return [...app.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)].map((m: RegExpMatchArray): string => m[1]);
}

function appNavigationTargets(): NavigationTargets {
  const all: NavigationTargets = { literals: [], dynamic: [] };
  for (const file of listAppSourceFiles()) {
    const found: NavigationTargets = extractNavigationTargets(fs.readFileSync(file, 'utf8'));
    all.literals.push(...found.literals);
    all.dynamic.push(...found.dynamic.map((d: string): string => `${path.relative(FRONTEND_ROOT, file)}: ${d}`));
  }
  return all;
}

describe('extractNavigationTargets', () => {
  it('should read literal targets from navigate, push and replace', () => {
    const src = "navigation.navigate('Home'); navigation.push(\"Login\"); navigation.replace('Settlement', { a: 1 });";
    expect(extractNavigationTargets(src)).toEqual({ literals: ['Home', 'Login', 'Settlement'], dynamic: [] });
  });

  it('should read the object form and reset routes', () => {
    const src = "navigation.navigate({ name: 'Home' }); navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });";
    expect(extractNavigationTargets(src).literals).toEqual(['Home', 'Login']);
  });

  it('should flag variable and template targets as dynamic instead of ignoring them', () => {
    const src = 'navigation.navigate(target); navigation.push(`Item${id}`); navigation.navigate({ name: route });';
    expect(extractNavigationTargets(src).dynamic).toHaveLength(3);
  });
});

describe('navigation routes', () => {
  it('should register a screen for every route the app navigates to', () => {
    const registered: string[] = registeredRoutes();
    expect(registered.length).toBeGreaterThan(0);
    const { literals } = appNavigationTargets();
    expect(literals).toContain('EditExpense');
    expect(literals.filter((r: string): boolean => !registered.includes(r))).toEqual([]);
  });

  it('should have no navigation target that cannot be verified statically', () => {
    expect(appNavigationTargets().dynamic).toEqual([]);
  });

  it('should use EditExpense (create mode) as the only expense form route', () => {
    expect(registeredRoutes()).toContain('EditExpense');
    expect(registeredRoutes()).not.toContain('CreateExpense');
    expect(appNavigationTargets().literals).not.toContain('CreateExpense');
  });
});
