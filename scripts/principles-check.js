#!/usr/bin/env node
'use strict';
// Principles RATCHET check. Fails only on NEW violations a diff introduces; existing debt is frozen in
// scripts/principles-baseline.json (counts per rule per file). See docs/solutions/tooling-decisions/principles-ratchet-check.md.
//
// Usage:
//   node scripts/principles-check.js --base origin/staging [--report] [--json out.json] [--require-jscpd] [--skip-jscpd]
//   node scripts/principles-check.js --update-baseline          (regenerate the baseline from the working tree)
//
// Rules (id: what):
//   P1-any            `any` type / `as any` / @ts-ignore / @ts-expect-error / eslint-disable in non-test TS
//   P2-raw-error      `throw new Error(` in backend/src (use AppError)
//   P2-apperror-literal  AppError whose message is not an i18n key present in backend/src/locales/en
//   P3-console        console.log/warn/error/debug/info in non-test src (logger util allowed)
//   P4-jsx-string     hardcoded user-facing string in frontend JSX outside i18n tables (// i18n-exempt: <reason>)
//   P5-route-auth / P5-route-validation / P5-route-ratelimit   Express route registration checks
//   P6-func-size / P6-file-size   total lines of oversized functions / file lines (only fails when it GROWS)
//   P7-duplication    jscpd clone involving added lines
//   P8-missing-test   new source file without a test (fails for services/controllers/hooks, warns otherwise)
//   P9-unused-export  newly added export with no other reference (warn only)
// Exemptions: `// principles-exempt: <rule> <reason>` on the line or the line above; or a commit-message
// trailer `Principles-Exempt: <rule> <reason>` / `Principles-Baseline-Raise: <reason>` in the PR's commits.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_REL = 'scripts/principles-baseline.json';
const CONFIG_REL = 'scripts/principles-config.json';
const ALLOWLIST_REL = 'scripts/principles-allowlist.json';
const COUNT_RULES = ['P1-any', 'P2-raw-error', 'P2-apperror-literal', 'P3-console', 'P4-jsx-string',
  'P5-route-auth', 'P5-route-validation', 'P5-route-ratelimit', 'P6-func-size', 'P6-file-size'];
const WARN_RULES = new Set(['P9-unused-export']);

// ---------- text helpers ----------

// Blanks // and /* */ comments (keeps newlines/columns) while respecting string and template literals.
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
    } else if (c === '"' || c === "'" || c === '`') {
      out += c; i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { out += src[i]; i++; }
        if (i < n) { out += src[i]; i++; }
        if (c !== '`' && src[i] === '\n') break;
      }
      if (i < n) { out += src[i]; i++; }
    } else { out += c; i++; }
  }
  return out;
}

function lineOf(text, offset) { return text.slice(0, offset).split('\n').length; }

function isTestPath(p, cfg) { return new RegExp(cfg.scope.testPathPattern).test(p); }
function isSourcePath(p, cfg) {
  return /\.(ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p) && cfg.scope.sourceRoots.some((r) => p.startsWith(r)) && !isTestPath(p, cfg);
}

function flattenKeys(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flattenKeys(v, key, out); else out.add(key);
  }
  return out;
}

// ---------- per-file scanners (return [{rule, line, text}]) ----------

const ANY_PATTERNS = [/:\s*any\b/, /\bas\s+any\b/, /<any\s*[,>\[]/, /\bany\[\]/, /,\s*any\s*>/, /\bArray<any>/, /=\s*any\s*[;,)]/];

function scanAny(raw, clean) {
  const found = [];
  const rawLines = raw.split('\n');
  const cleanLines = clean.split('\n');
  cleanLines.forEach((l, i) => {
    const hit = ANY_PATTERNS.some((p) => p.test(l)) || /@ts-ignore|@ts-expect-error|eslint-disable/.test(rawLines[i]);
    if (hit) found.push({ rule: 'P1-any', line: i + 1, text: rawLines[i].trim() });
  });
  return found;
}

function scanRawError(clean, raw) {
  const found = [];
  const re = /throw\s+new\s+Error\s*\(/g;
  let m;
  while ((m = re.exec(clean))) found.push({ rule: 'P2-raw-error', line: lineOf(clean, m.index), text: raw.split('\n')[lineOf(clean, m.index) - 1].trim() });
  return found;
}

function scanAppErrorLiteral(clean, raw, keys) {
  const found = [];
  const re = /new\s+AppError\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(clean))) {
    const msg = m[2];
    const isKey = /^[A-Za-z][\w-]*(\.[\w-]+)+$/.test(msg) && keys.has(msg);
    if (!isKey) {
      const line = lineOf(clean, m.index);
      found.push({ rule: 'P2-apperror-literal', line, text: raw.split('\n')[line - 1].trim() });
    }
  }
  return found;
}

function scanConsole(clean, raw) {
  const found = [];
  const re = /\bconsole\.(log|warn|error|debug|info)\s*\(/g;
  let m;
  while ((m = re.exec(clean))) {
    const line = lineOf(clean, m.index);
    found.push({ rule: 'P3-console', line, text: raw.split('\n')[line - 1].trim() });
  }
  return found;
}

const JSX_ATTR = /\b(title|label|placeholder|accessibilityLabel|headerTitle|helperText|errorText|description)=(["'])[^"'{}]*[A-Za-z]{2,}[^"'{}]*\2/;
const JSX_INLINE_TEXT = />\s*[A-Za-z][^<>{}=;]*[A-Za-z.!?:]\s*<\//;
const JSX_BARE_LINE = /^[A-Z][A-Za-z0-9'’,.!?&:\- ]{2,}$/;
const ALERT_LITERAL = /\bAlert\.alert\(\s*(['"`])[^'"`$]*[A-Za-z]{2,}/;

function scanJsxStrings(clean, raw) {
  const found = [];
  const lines = clean.split('\n');
  const rawLines = raw.split('\n');
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t || /^(import|export)\b/.test(t)) return;
    const ctx = `${rawLines[i - 1] || ''} ${rawLines[i]}`;
    if (/i18n-exempt:/.test(ctx)) return;
    const bare = JSX_BARE_LINE.test(t) && /<\//.test(lines.slice(i + 1, i + 4).join(' ')) && !/^(return|const|let|case|default|else)\b/.test(t);
    if (JSX_ATTR.test(t) || JSX_INLINE_TEXT.test(t) || ALERT_LITERAL.test(t) || bare) {
      found.push({ rule: 'P4-jsx-string', line: i + 1, text: rawLines[i].trim() });
    }
  });
  return found;
}

// Route statements: router.get('/x', a, b, handler);  (also app.get for health-style routes)
function scanRoutes(raw, clean, file, ctx) {
  const found = [];
  const base = path.basename(file);
  const allow = ctx.allowlist || {};
  const re = /\b(router|app)\.(get|post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = re.exec(clean))) {
    let depth = 0; let j = m.index + m[0].length - 1; let end = j;
    for (; j < clean.length; j++) {
      if (clean[j] === '(') depth++;
      else if (clean[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
    }
    const call = clean.slice(m.index, end + 1);
    const line = lineOf(clean, m.index);
    const pm = /\(\s*(['"`])([^'"`]*)\1/.exec(call);
    const rpath = pm ? pm[2] : '?';
    const method = m[2].toUpperCase();
    const key = `${base} ${method} ${rpath}`;
    const before = clean.slice(0, m.index);
    const text = raw.split('\n')[line - 1].trim();
    const fileAuth = /\b(router|app)\.use\(\s*(['"`][^'"`]*['"`]\s*,\s*)?\w*[aA]uth\w*\b/.test(before);
    const hasAuth = /\b(authMiddleware|requireAuth|authenticate\w*)\b/.test(call) || fileAuth;
    if (!hasAuth && !(allow.publicRoutes || []).includes(key)) found.push({ rule: 'P5-route-auth', line, text });
    if (['POST', 'PUT', 'PATCH'].includes(method) && !(allow.unvalidatedRoutes || []).includes(key) && !routeValidates(call, file, ctx)) {
      found.push({ rule: 'P5-route-validation', line, text });
    }
    const authType = /auth/i.test(base) || /login|signup|password|otp|reset|verify|forgot/i.test(rpath);
    const fileLimiter = /\brouter\.use\([^)]*([lL]imiter|rateLimit)/.test(before);
    if (authType && method !== 'GET' && !fileLimiter && !/[lL]imiter|rateLimit/.test(call) && !(allow.unlimitedRoutes || []).includes(key)) {
      found.push({ rule: 'P5-route-ratelimit', line, text });
    }
  }
  return found;
}

// A route validates when the call mentions a validate/schema middleware, or its controller handler parses with Zod.
function routeValidates(call, file, ctx) {
  if (/\bvalidate\w*\b|\bschema\b/i.test(call.replace(/^[^(]*\(\s*(['"`])[^'"`]*\1/, ''))) return true;
  const h = /(\w+)\.(\w+)\s*\)\s*$/.exec(call);
  if (!h || !ctx.readFile) return false;
  const ctrlFile = `backend/src/controllers/${h[1]}.ts`;
  const body = ctx.readFile(ctrlFile) || ctx.readFile(path.posix.join('backend/src/controllers', `${h[1].replace(/Controller$/, '')}Controller.ts`));
  const src = body || findControllerFor(h[1], file, ctx);
  if (!src) return false;
  const idx = src.search(new RegExp(`(function\\s+${h[2]}\\b|const\\s+${h[2]}\\s*=)`));
  if (idx < 0) return false;
  return /\.(safeParse|parse|parseAsync)\(|validate\w*\(/.test(src.slice(idx, idx + 4000));
}

// `import * as groupController from '../controllers/groupController'` -> read that file.
function findControllerFor(ns, file, ctx) {
  const imp = ctx.readFile(file) || '';
  const m = new RegExp(`import\\s+\\*\\s+as\\s+${ns}\\s+from\\s+['"]\\.\\./controllers/(\\w+)['"]`).exec(imp);
  return m ? ctx.readFile(`backend/src/controllers/${m[1]}.ts`) : null;
}

// Function boundaries by brace matching on comment-stripped source; returns [{name,start,end,lines}].
function findFunctions(clean) {
  const lines = clean.split('\n');
  const fns = [];
  const startRe = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>\s*\{?|(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)/;
  for (let i = 0; i < lines.length; i++) {
    const m = startRe.exec(lines[i]);
    if (!m) continue;
    const name = m[1] || m[2] || m[3];
    if (!name || /^(if|for|while|switch|catch|return)$/.test(name)) continue;
    // find first '{' at/after this line whose body we measure
    let depth = 0; let opened = false; let end = -1;
    for (let k = i; k < Math.min(lines.length, i + 2000); k++) {
      const seg = lines[k];
      for (const ch of seg) {
        if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--;
      }
      if (opened && depth <= 0) { end = k; break; }
      if (!opened && k > i + 3) break; // expression-bodied arrow: not measured
    }
    if (end >= i && opened) fns.push({ name, start: i + 1, end: end + 1, lines: end - i + 1 });
  }
  return fns;
}

function scanSize(clean, cfg) {
  const found = [];
  const total = clean.split('\n').length;
  if (total > cfg.thresholds.fileLines) found.push({ rule: 'P6-file-size', line: 1, text: `${total} lines (threshold ${cfg.thresholds.fileLines})`, weight: total });
  // Only outermost-most measured entries: nested functions count on their own, acceptable.
  for (const f of findFunctions(clean)) {
    if (f.lines > cfg.thresholds.functionLines) {
      found.push({ rule: 'P6-func-size', line: f.start, text: `${f.name}: ${f.lines} lines (threshold ${cfg.thresholds.functionLines})`, weight: f.lines });
    }
  }
  return found;
}

// Master per-file scan. ctx: { cfg, keys:Set, allowlist, readFile }
function scanFile(file, raw, ctx) {
  const cfg = ctx.cfg;
  const inRoutes = /^backend\/src\/routes\/.+\.ts$/.test(file) || file === 'backend/src/app.ts';
  if (!isSourcePath(file, cfg) && !inRoutes) return [];
  if (isTestPath(file, cfg)) return [];
  const clean = stripComments(raw);
  const out = [];
  const backend = file.startsWith('backend/src/');
  const frontendTsx = file.startsWith('frontend/src/') && file.endsWith('.tsx') && !new RegExp(cfg.scope.i18nTablePattern).test(file);
  out.push(...scanAny(raw, clean));
  if (backend) {
    out.push(...scanRawError(clean, raw));
    out.push(...scanAppErrorLiteral(clean, raw, ctx.keys || new Set()));
  }
  if (!new RegExp(cfg.scope.loggerPattern).test(file)) out.push(...scanConsole(clean, raw));
  if (frontendTsx) out.push(...scanJsxStrings(clean, raw));
  if (inRoutes) out.push(...scanRoutes(raw, clean, file, ctx));
  out.push(...scanSize(clean, cfg));
  return applyInlineExemptions(out, raw);
}

function applyInlineExemptions(findings, raw) {
  const lines = raw.split('\n');
  return findings.filter((f) => {
    if (f.rule === 'P6-file-size') return true;
    const ctx = `${lines[f.line - 2] || ''}\n${lines[f.line - 1] || ''}`;
    const m = /principles-exempt:\s*([\w-]+)\s+\S+/.exec(ctx);
    return !(m && (m[1] === f.rule || m[1] === f.rule.split('-')[0]));
  });
}

// Counts per rule for the ratchet; size rules sum their weights, others count findings.
function countFindings(findings) {
  const c = {};
  for (const f of findings) c[f.rule] = (c[f.rule] || 0) + (f.weight !== undefined ? f.weight : 1);
  return c;
}

// ---------- git / io ----------

function git(args, opts) {
  const r = spawnSync('git', args, { cwd: (opts && opts.cwd) || ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
}

function makeIo(cwd, base) {
  const g = (a) => git(a, { cwd });
  return {
    cwd,
    mergeBase() {
      const r = g(['merge-base', base, 'HEAD']);
      return r.status === 0 ? r.out.trim() : base;
    },
    diffFiles(mb) {
      const r = g(['diff', '--name-status', '-M', '--no-color', mb]);
      if (r.status !== 0) throw new Error(`git diff failed: ${r.err}`);
      const files = r.out.split('\n').filter(Boolean).map((l) => {
        const p = l.split('\t');
        return p[0].startsWith('R') ? { status: 'R', oldPath: p[1], path: p[2] } : { status: p[0][0], path: p[1] };
      });
      for (const u of g(['ls-files', '--others', '--exclude-standard']).out.split('\n').filter(Boolean)) files.push({ status: 'A', path: u });
      return files;
    },
    addedLines(mb, file) {
      const r = g(['diff', '-U0', '--no-color', mb, '--', file]);
      const set = new Set();
      if (r.status === 0 && r.out) {
        let n = 0;
        for (const l of r.out.split('\n')) {
          const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l);
          if (h) { n = Number(h[1]); continue; }
          if (n && l.startsWith('+') && !l.startsWith('+++')) { set.add(n); n++; }
        }
      }
      return set;
    },
    readWork(rel) { try { return fs.readFileSync(path.join(cwd, rel), 'utf8'); } catch (_) { return null; } },
    readAt(ref, rel) { const r = g(['show', `${ref}:${rel}`]); return r.status === 0 ? r.out : null; },
    commitMessages(mb) { return g(['log', '--format=%B%x00', `${mb}..HEAD`]).out; },
    listTracked() { return g(['ls-files']).out.split('\n').filter(Boolean); },
    grepWord(word) { return g(['grep', '-lw', '-e', word, '--', 'backend/src', 'frontend/src', 'e2e']).out.split('\n').filter(Boolean); },
  };
}

function parseJson(s, fallback) { try { return JSON.parse(s); } catch (_) { return fallback; } }

function loadLocaleKeys(io) {
  const en = parseJson(io.readWork('backend/src/locales/en/translation.json') || '{}', {});
  return flattenKeys(en, '', new Set());
}

// ---------- baseline ----------

function computeBaseline(io, cfg, ctx) {
  const files = {};
  for (const f of io.listTracked()) {
    const raw = io.readWork(f);
    if (raw === null) continue;
    const counts = countFindings(scanFile(f, raw, ctx));
    if (Object.keys(counts).length) files[f] = counts;
  }
  const totals = {};
  for (const c of Object.values(files)) for (const [r, v] of Object.entries(c)) totals[r] = (totals[r] || 0) + v;
  return { version: 1, generatedFrom: (git(['rev-parse', 'HEAD'], { cwd: io.cwd }).out || '').trim(), thresholds: cfg.thresholds, totals, files };
}

// ---------- evaluation ----------

function exemptedRules(messages) {
  const set = new Set();
  const re = /^Principles-Exempt:\s*([\w-]+)\s+\S+/gm;
  let m;
  while ((m = re.exec(messages))) set.add(m[1]);
  return { set, raise: /^Principles-Baseline-Raise:\s*\S+/m.test(messages) };
}

function isRuleExempt(set, rule) { return set.has(rule) || set.has(rule.split('-')[0]); }

function evaluate(io, opts) {
  const cfgHead = parseJson(io.readWork(CONFIG_REL) || 'null', null);
  const mb = io.mergeBase();
  const baseCfgRaw = io.readAt(mb, CONFIG_REL);
  const cfg = parseJson(baseCfgRaw || 'null', null) || cfgHead; // thresholds come from BASE so a PR cannot loosen them
  if (!cfg) throw new Error(`${CONFIG_REL} missing`);
  const allowlist = parseJson(io.readWork(ALLOWLIST_REL) || '{}', {});
  const baseBaselineRaw = io.readAt(mb, BASELINE_REL);
  const baselineSource = baseBaselineRaw ? 'base' : 'worktree (bootstrap)';
  const baseline = parseJson(baseBaselineRaw || io.readWork(BASELINE_REL) || 'null', null);
  if (!baseline) throw new Error(`${BASELINE_REL} missing: run --update-baseline`);
  const headBaseline = parseJson(io.readWork(BASELINE_REL) || 'null', null);
  const ctx = { cfg, keys: loadLocaleKeys(io), allowlist, readFile: (p) => io.readWork(p) };
  const exempt = exemptedRules(io.commitMessages(mb));
  const changed = io.diffFiles(mb);
  const findings = []; const warnings = []; const improvements = [];

  for (const f of changed) {
    if (f.status === 'D') continue;
    const raw = io.readWork(f.path);
    if (raw === null) continue;
    const added = f.status === 'A' ? null : io.addedLines(mb, f.path);
    const all = scanFile(f.path, raw, ctx);
    const counts = countFindings(all);
    const baseKey = f.status === 'R' ? f.oldPath : f.path;
    const allowed = (baseline.files[baseKey] || {});
    for (const rule of Object.keys(counts)) {
      if (counts[rule] <= (allowed[rule] || 0)) continue;
      const mine = all.filter((x) => x.rule === rule);
      let hits = added ? mine.filter((x) => added.has(x.line)) : mine;
      if (!hits.length) hits = mine.slice(0, 1); // grown via edit of an existing line: still a growth
      for (const h of hits) findings.push({ file: f.path, line: h.line, rule, text: h.text, baseline: allowed[rule] || 0, now: counts[rule] });
    }
    for (const rule of Object.keys(allowed)) {
      if ((counts[rule] || 0) < allowed[rule]) improvements.push({ file: f.path, rule, from: allowed[rule], to: counts[rule] || 0 });
    }
    if (f.status === 'A' && isSourcePath(f.path, cfg)) missingTest(f, changed, io, cfg, findings, warnings);
    if (f.status !== 'R' && isSourcePath(f.path, cfg)) unusedExports(f, raw, added, io, warnings);
  }

  baselineRaised(baseBaselineRaw, headBaseline, exempt, findings);
  if (!opts.skipJscpd) duplication(io, cfg, changed, mb, findings, warnings, opts);

  const final = findings.filter((x) => !isRuleExempt(exempt.set, x.rule));
  return { base: mb, baselineSource, findings: final, exemptedCount: findings.length - final.length, warnings, improvements,
    exemptRules: [...exempt.set], ok: final.length === 0 };
}

function baselineRaised(baseRaw, head, exempt, findings) {
  if (!baseRaw || !head) return;
  const base = parseJson(baseRaw, null);
  if (!base || exempt.raise) return;
  for (const [file, counts] of Object.entries(head.files || {})) {
    for (const [rule, v] of Object.entries(counts)) {
      const was = ((base.files || {})[file] || {})[rule] || 0;
      if (v > was) findings.push({ file: BASELINE_REL, line: 1, rule: 'BASELINE-RAISED', text: `${file} ${rule}: ${was} -> ${v} (needs a 'Principles-Baseline-Raise: <reason>' commit trailer)`, baseline: was, now: v });
    }
  }
}

function missingTest(f, changed, io, cfg, findings, warnings) {
  const stem = path.basename(f.path).replace(/\.(ts|tsx)$/, '');
  if (stem === 'index' || /^(types?|constants?|config)$/i.test(stem)) return;
  const tracked = io.listTracked();
  const hasTracked = tracked.some((p) => isTestPath(p, cfg) && path.basename(p).startsWith(`${stem}.`) && /\.(test|spec)\./.test(p));
  const hasDiffTest = changed.some((c) => c.status !== 'D' && isTestPath(c.path, cfg) && /\.(test|spec)\./.test(c.path) &&
    new RegExp(`\\b${stem}\\b`).test(io.readWork(c.path) || ''));
  if (hasTracked || hasDiffTest) return;
  const must = cfg.scope.testRequiredDirs.some((d) => f.path.includes(d));
  (must ? findings : warnings).push({ file: f.path, line: 1, rule: 'P8-missing-test', text: `new file has no test (${stem}.test.*)` });
}

function unusedExports(f, raw, added, io, warnings) {
  const lines = raw.split('\n');
  const nums = added ? [...added] : lines.map((_, i) => i + 1);
  for (const n of nums) {
    const m = /^export\s+(?:async\s+)?(?:const|function|class|interface|type|enum)\s+(\w+)/.exec(lines[n - 1] || '');
    if (!m) continue;
    const users = io.grepWord(m[1]).filter((p) => p !== f.path);
    if (!users.length) warnings.push({ file: f.path, line: n, rule: 'P9-unused-export', text: `export ${m[1]} is not referenced anywhere else` });
  }
}

// jscpd reports file names relative to the scanned root, so each root is scanned on its own and re-prefixed
// (clones across backend and frontend are not a meaningful duplication anyway).
function runJscpd(io, cfg) {
  const duplicates = [];
  for (const root of cfg.jscpd.paths) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-'));
    const args = ['--yes', cfg.jscpd.package, root, '--min-tokens', String(cfg.thresholds.jscpdMinTokens), '--reporters', 'json',
      '--output', outDir, '--silent', '--ignore', '**/__tests__/**,**/*.test.*,**/*.spec.*,**/node_modules/**,**/locales/**'];
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: io.cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 5 * 60 * 1000 });
    const file = path.join(outDir, 'jscpd-report.json');
    const report = fs.existsSync(file) ? parseJson(fs.readFileSync(file, 'utf8'), null) : null;
    if (!report) return { error: `jscpd produced no report for ${root} (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}` };
    for (const d of report.duplicates || []) {
      duplicates.push({ ...d, firstFile: { ...d.firstFile, name: `${root}/${d.firstFile.name}` }, secondFile: { ...d.secondFile, name: `${root}/${d.secondFile.name}` } });
    }
  }
  return { report: { duplicates } };
}

function duplication(io, cfg, changed, mb, findings, warnings, opts) {
  const res = (opts.jscpdRunner || runJscpd)(io, cfg, opts);
  if (res.error || !res.report) {
    const msg = res.error || 'jscpd report unreadable';
    (opts.requireJscpd ? findings : warnings).push({ file: '-', line: 0, rule: 'P7-duplication', text: `duplication check could not run: ${msg}` });
    return;
  }
  const addedByFile = {};
  for (const f of changed) if (f.status !== 'D' && isSourcePath(f.path, cfg)) addedByFile[f.path] = f.status === 'A' ? null : io.addedLines(mb, f.path);
  const overlaps = (file, start, end) => {
    if (!(file in addedByFile)) return false;
    const set = addedByFile[file];
    if (set === null) return true;
    for (let l = start; l <= end; l++) if (set.has(l)) return true;
    return false;
  };
  const norm = (p) => path.relative(io.cwd, path.resolve(io.cwd, p)).split(path.sep).join('/');
  for (const d of res.report.duplicates || []) {
    const a = d.firstFile; const b = d.secondFile;
    const ra = overlaps(norm(a.name), a.start, a.end); const rb = overlaps(norm(b.name), b.start, b.end);
    if (ra || rb) {
      findings.push({ file: norm(ra ? a.name : b.name), line: ra ? a.start : b.start, rule: 'P7-duplication',
        text: `clone of ${norm(ra ? b.name : a.name)}:${ra ? b.start : a.start} (${d.lines} lines)` });
    }
  }
}

// ---------- output ----------

function formatText(res) {
  const out = [];
  for (const f of res.findings) out.push(`FAIL ${f.rule} ${f.file}:${f.line}  ${f.text}`);
  for (const w of res.warnings) out.push(`warn ${w.rule} ${w.file}:${w.line}  ${w.text}`);
  out.push(res.ok ? `principles-check: PASS (${res.warnings.length} warnings, ${res.improvements.length} improvements)` :
    `principles-check: FAIL (${res.findings.length} new violation(s)). Fix them, or exempt with a reason (docs/solutions/tooling-decisions/principles-ratchet-check.md).`);
  return out.join('\n');
}

function formatReport(res) {
  const L = [`### Principles ratchet: ${res.ok ? 'PASS' : 'FAIL'}`, '',
    `Base \`${res.base.slice(0, 10)}\`, baseline from ${res.baselineSource}. Only NEW violations fail; existing debt is frozen in the baseline.`, ''];
  if (res.findings.length || res.warnings.length) {
    L.push('| Level | Rule | Location | Detail |', '|---|---|---|---|');
    const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/`/g, "'");
    for (const f of res.findings) L.push(`| FAIL | ${f.rule} | \`${f.file}:${f.line}\` | ${esc(f.text)} |`);
    for (const w of res.warnings) L.push(`| warn | ${w.rule} | \`${w.file}:${w.line}\` | ${esc(w.text)} |`);
  } else L.push('No new violations and no warnings.');
  if (res.improvements.length) L.push('', `${res.improvements.length} count(s) improved below baseline; run \`node scripts/principles-check.js --update-baseline\` to lock them in.`);
  if (res.exemptRules.length) L.push('', `Exempt via commit trailer: ${res.exemptRules.join(', ')} (${res.exemptedCount} finding(s) suppressed).`);
  return L.join('\n');
}

function parseArgs(argv) {
  const o = { base: 'origin/staging' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') o.base = argv[++i];
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--report') o.report = true;
    else if (a === '--update-baseline') o.update = true;
    else if (a === '--require-jscpd') o.requireJscpd = true;
    else if (a === '--skip-jscpd') o.skipJscpd = true;
    else if (a === '--cwd') o.cwd = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv);
  const cwd = o.cwd ? path.resolve(o.cwd) : ROOT;
  const io = makeIo(cwd, o.base);
  if (o.update) {
    const cfg = parseJson(io.readWork(CONFIG_REL), null);
    const ctx = { cfg, keys: loadLocaleKeys(io), allowlist: parseJson(io.readWork(ALLOWLIST_REL) || '{}', {}), readFile: (p) => io.readWork(p) };
    const b = computeBaseline(io, cfg, ctx);
    fs.writeFileSync(path.join(cwd, BASELINE_REL), `${JSON.stringify(b, null, 2)}\n`);
    console.log(`wrote ${BASELINE_REL}: ${Object.keys(b.files).length} files; totals ${JSON.stringify(b.totals)}`);
    return 0;
  }
  const res = evaluate(io, o);
  if (o.json) fs.writeFileSync(o.json, `${JSON.stringify(res, null, 2)}\n`);
  console.log(o.report ? formatReport(res) : formatText(res));
  return res.ok ? 0 : 1;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`principles-check error: ${e.message}`); process.exitCode = 2; }
}

module.exports = { stripComments, scanFile, scanAny, scanRoutes, scanJsxStrings, scanAppErrorLiteral, scanConsole, scanRawError,
  findFunctions, scanSize, countFindings, evaluate, computeBaseline, formatReport, formatText, exemptedRules, makeIo, main, COUNT_RULES, WARN_RULES };
