import { stripComments } from './stripComments';

export interface NavigationTargets {
  /** Route names written as string literals. */
  literals: string[];
  /** Call sites whose route cannot be read statically (variables, templates, spreads). */
  dynamic: string[];
}

// `navigate` is unambiguous, so it is matched on any receiver (including
// getParent()?.) and when destructured. push/replace/popTo/reset also exist on
// arrays and strings, so they are only matched on navigation-like receivers
// and on the CommonActions/StackActions helpers.
const NAVIGATE_CALL: RegExp = /(?:\bnavigate|\.navigate)\s*\(/g;
const OTHER_CALL: RegExp =
  /(?:\b(?:navigation\w*|nav|navRef\w*)(?:\.current)?(?:\??\.getParent\(\))?\??|\b(?:CommonActions|StackActions))\.(push|replace|popTo|reset)\s*\(/g;
const NAME_PATTERN: RegExp = /\bname:\s*(['"`])([^'"`$]*)\1/g;

/** Returns the text of the balanced (...) group starting after `openIndex`, ignoring parens in strings and comments. */
function readBalanced(text: string, openIndex: number): string {
  let depth = 1;
  let quote: string | null = null;
  let i: number = openIndex;
  while (i < text.length && depth > 0) {
    const ch: string = text[i];
    const next: string = text[i + 1];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (ch === '/' && next === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) i = text.length;
      i += 1;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
    }
    i += 1;
  }
  if (depth !== 0) throw new Error(`Unbalanced navigation call near: ${text.slice(openIndex, openIndex + 60)}`);
  return text.slice(openIndex, i - 1);
}

/** The text of the first top-level argument (up to the first top-level comma). */
function firstArgument(args: string): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const ch: string = args[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) return args.slice(0, i);
  }
  return args;
}

/** Removes `params: { ... }` blocks so a `name` key inside route params is not read as a route name. */
function stripParams(args: string): string {
  let out: string = args;
  for (;;) {
    const at: number = out.search(/\bparams:\s*\{/);
    if (at === -1) return out;
    let i: number = out.indexOf('{', at);
    let depth = 0;
    do {
      if (out[i] === '{') depth += 1;
      else if (out[i] === '}') depth -= 1;
      i += 1;
    } while (i < out.length && depth > 0);
    out = out.slice(0, at) + out.slice(i);
  }
}

function collect(source: string, pattern: RegExp, methodOf: (m: RegExpMatchArray) => string, out: NavigationTargets): void {
  for (const call of source.matchAll(pattern)) {
    const method: string = methodOf(call);
    const args: string = readBalanced(source, (call.index ?? 0) + call[0].length);
    const label: string = `${method}(${args.slice(0, 60).replace(/\s+/g, ' ')})`;
    if (method === 'reset' || args.trim().startsWith('{')) {
      const scanned: string = stripParams(args);
      const names: RegExpMatchArray[] = [...scanned.matchAll(NAME_PATTERN)];
      const hasDynamicName: boolean = /\bname:\s*[^\s'"`]/.test(scanned) || /\bname:\s*`[^`]*\$\{/.test(scanned);
      if (names.length === 0 || hasDynamicName) out.dynamic.push(label);
      names.forEach((m: RegExpMatchArray): number => out.literals.push(m[2]));
      continue;
    }
    const literal: RegExpMatchArray | null = firstArgument(args).trim().match(/^(['"])(\w+)\1$/);
    if (literal) out.literals.push(literal[2]);
    else out.dynamic.push(label);
  }
}

/**
 * Extracts route targets from navigation calls: navigate (any receiver),
 * push/replace/popTo/reset on navigation-like receivers, with a string or
 * `{ name }` argument, and reset({ routes: [{ name }] }). Anything that is
 * not a standalone string literal is reported as dynamic so a human must
 * review it instead of the scan silently ignoring it.
 */
export function extractNavigationTargets(rawSource: string): NavigationTargets {
  const source: string = stripComments(rawSource);
  const found: NavigationTargets = { literals: [], dynamic: [] };
  collect(source, NAVIGATE_CALL, (): string => 'navigate', found);
  collect(source, OTHER_CALL, (m: RegExpMatchArray): string => m[1], found);
  return found;
}
