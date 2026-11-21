const COMMENTS: RegExp = /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm;

/** Removes // and block comments (keeps URLs like https://) so source scans ignore commented-out code. */
export function stripComments(source: string): string {
  return source.replace(COMMENTS, '$1');
}
