export interface NavigationTargets {
  /** Route names written as string literals. */
  literals: string[];
  /** Call sites whose route cannot be read statically (variables, templates, spreads). */
  dynamic: string[];
}

const CALL_PATTERN: RegExp = /\bnavigation\w*(?:\.current)?\??\.(navigate|push|replace|popTo|reset)\(/g;
const NAME_PATTERN: RegExp = /\bname:\s*(['"`])([^'"`$]*)\1/g;

function readBalanced(text: string, openIndex: number): string {
  let depth = 1;
  let i: number = openIndex;
  while (i < text.length && depth > 0) {
    const ch: string = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    i += 1;
  }
  return text.slice(openIndex, i - 1);
}

function isPlainLiteral(arg: string): RegExpMatchArray | null {
  return arg.trim().match(/^(['"])(\w+)\1/);
}

/**
 * Extracts route targets from navigation calls: navigate/push/replace/popTo
 * with a string or `{ name }` argument, and reset({ routes: [{ name }] }).
 * Anything that is not a plain string literal is reported as dynamic so a
 * human must review it instead of the scan silently ignoring it.
 */
export function extractNavigationTargets(source: string): NavigationTargets {
  const literals: string[] = [];
  const dynamic: string[] = [];
  for (const call of source.matchAll(CALL_PATTERN)) {
    const method: string = call[1];
    const args: string = readBalanced(source, (call.index ?? 0) + call[0].length);
    const label: string = `${method}(${args.slice(0, 60).replace(/\s+/g, ' ')})`;
    if (method === 'reset' || args.trim().startsWith('{')) {
      const names: RegExpMatchArray[] = [...args.matchAll(NAME_PATTERN)];
      const hasDynamicName: boolean = /\bname:\s*[^\s'"`]/.test(args) || /\bname:\s*`[^`]*\$\{/.test(args);
      if (names.length === 0 || hasDynamicName) dynamic.push(label);
      names.forEach((m: RegExpMatchArray): number => literals.push(m[2]));
      continue;
    }
    const literal: RegExpMatchArray | null = isPlainLiteral(args);
    if (literal) literals.push(literal[2]);
    else dynamic.push(label);
  }
  return { literals, dynamic };
}
