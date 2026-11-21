'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const pc = require('../principles-check.js');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'principles-config.json'), 'utf8'));
const ctx = { cfg, keys: new Set(['EXPENSE.NOT_FOUND']), allowlist: { publicRoutes: ['authRoutes.ts POST /login'] }, readFile: () => null };
const rules = (file, src, c) => pc.scanFile(file, src, c || ctx).map((f) => f.rule);

test('P1 flags any, as any, ts-ignore, eslint-disable and ignores comments/strings', () => {
  assert.deepEqual(rules('backend/src/a.ts', 'const x: any = 1;\n'), ['P1-any']);
  assert.deepEqual(rules('backend/src/a.ts', 'const x = y as any;\n'), ['P1-any']);
  assert.deepEqual(rules('backend/src/a.ts', '// @ts-ignore\nconst x = 1;\n'), ['P1-any']);
  assert.deepEqual(rules('backend/src/a.ts', '/* eslint-disable */\n'), ['P1-any']);
  assert.deepEqual(rules('backend/src/a.ts', '// uses any value\nconst s = "any";\nconst anyone = 1;\n'), []);
});

test('P1-P3 do not apply to test files', () => {
  assert.deepEqual(rules('backend/src/__tests__/a.test.ts', 'const x: any = 1; console.log(1); throw new Error("x");\n'), []);
});

test('P2 flags raw Error in backend only and AppError English literals but accepts known i18n keys', () => {
  assert.deepEqual(rules('backend/src/s.ts', 'throw new Error("boom");\n'), ['P2-raw-error']);
  assert.deepEqual(rules('frontend/src/s.ts', 'throw new Error("boom");\n'), []);
  assert.deepEqual(rules('backend/src/s.ts', "throw new AppError('Not found', 404, 'NF');\n"), ['P2-apperror-literal']);
  assert.deepEqual(rules('backend/src/s.ts', "throw new AppError(\n  'EXPENSE.NOT_FOUND', 404, 'NF');\n"), []);
  assert.deepEqual(rules('backend/src/s.ts', "throw new AppError('EXPENSE.UNKNOWN_KEY', 404, 'NF');\n"), ['P2-apperror-literal']);
});

test('P3 flags console.* but allows the logger util', () => {
  assert.deepEqual(rules('frontend/src/a.ts', "console.log('x');\n"), ['P3-console']);
  assert.deepEqual(rules('frontend/src/utils/logger.ts', "console.log('x');\n"), []);
  assert.deepEqual(rules('frontend/src/a.ts', "// console.log('x')\n"), []);
});

test('P4 flags hardcoded JSX text/attributes, honours i18n-exempt and skips i18n tables', () => {
  assert.deepEqual(rules('frontend/src/screens/A.tsx', 'const a = <Text>Save expense</Text>;\n'), ['P4-jsx-string']);
  assert.deepEqual(rules('frontend/src/screens/A.tsx', 'const a = <Input placeholder="Enter amount" />;\n'), ['P4-jsx-string']);
  assert.deepEqual(rules('frontend/src/screens/A.tsx', "Alert.alert('Oops', t('x'));\n"), ['P4-jsx-string']);
  assert.deepEqual(rules('frontend/src/screens/A.tsx', '// i18n-exempt: brand name\nconst a = <Text>Splitwise</Text>;\n'), []);
  assert.deepEqual(rules('frontend/src/screens/A.tsx', 'const a = <Text>{t("save")}</Text>;\n'), []);
  assert.deepEqual(rules('frontend/src/i18n/s.tsx', 'const a = <Text>Save expense</Text>;\n'), []);
});

test('P5 flags unauthenticated, unvalidated and unlimited routes; allowlist and middleware satisfy them', () => {
  const f = 'backend/src/routes/authRoutes.ts';
  assert.deepEqual(rules(f, "router.get('/secret', ctl.get);\n"), ['P5-route-auth']);
  assert.deepEqual(rules(f, "router.post('/login', ctl.login);\n").sort(), ['P5-route-ratelimit', 'P5-route-validation']);
  assert.deepEqual(rules(f, "router.post('/login', loginLimiter, validate(s), ctl.login);\n"), []);
  assert.deepEqual(rules('backend/src/routes/g.ts', "router.use(authMiddleware);\nrouter.get('/x', c.x);\n"), []);
  const validating = { ...ctx, readFile: (p) => (p.endsWith('gController.ts') ? 'export const make = async () => { S.parse(req.body); };' : "import * as gController from '../controllers/gController';") };
  assert.deepEqual(rules('backend/src/routes/g.ts', "router.post('/', authMiddleware, gController.make);\n", validating), []);
});

test('P6 counts function and file size and weights growth', () => {
  const body = Array.from({ length: 85 }, (_, i) => `  const v${i} = ${i};`).join('\n');
  const big = `export function huge() {\n${body}\n}\n`;
  const f = pc.scanFile('backend/src/s.ts', big, ctx);
  assert.equal(f.filter((x) => x.rule === 'P6-func-size').length, 1);
  assert.ok(pc.countFindings(f)['P6-func-size'] >= 86);
  assert.deepEqual(rules('backend/src/s.ts', 'export function small() {\n  return 1;\n}\n'), []);
  const file = Array.from({ length: 401 }, (_, i) => `const a${i} = ${i};`).join('\n');
  assert.deepEqual(rules('backend/src/s.ts', file), ['P6-file-size']);
});

test('inline principles-exempt suppresses a line rule', () => {
  assert.deepEqual(rules('backend/src/s.ts', '// principles-exempt: P3-console legacy debug\nconsole.log(1);\n'), []);
});

// ---------- integration against a real temp git repo ----------

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'principles-'));
  const run = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  run('init', '-q', '-b', 'staging');
  run('config', 'user.email', 't@t'); run('config', 'user.name', 't'); run('config', 'commit.gpgsign', 'false');
  const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), s); };
  w('scripts/principles-config.json', JSON.stringify(cfg));
  w('scripts/principles-allowlist.json', JSON.stringify({ publicRoutes: [] }));
  w('backend/src/locales/en/translation.json', JSON.stringify({ EXPENSE: { NOT_FOUND: 'x' } }));
  w('backend/src/legacy.ts', 'export const old: any = 1;\nconsole.log("legacy");\n');
  w('backend/src/routes/gRoutes.ts', "import { Router } from 'express';\nconst router = Router();\nrouter.get('/', authMiddleware, c.list);\nexport default router;\n");
  w('backend/src/services/clean.ts', 'export const clean = (a: number): number => a;\n');
  w('backend/src/__tests__/clean.test.ts', "import { clean } from '../services/clean';\n");
  w('scripts/principles-baseline.json', '{}');
  const ctxR = { cfg, keys: new Set(), allowlist: {}, readFile: (p) => { try { return fs.readFileSync(path.join(dir, p), 'utf8'); } catch (_) { return null; } } };
  const base = pc.computeBaseline(pc.makeIo(dir, 'HEAD'), cfg, ctxR); // before first commit: ls-files empty, so stage first
  run('add', '-A');
  const b2 = pc.computeBaseline(pc.makeIo(dir, 'HEAD'), cfg, ctxR);
  w('scripts/principles-baseline.json', JSON.stringify(b2));
  assert.ok(base);
  run('add', '-A'); run('commit', '-q', '-m', 'base'); run('branch', 'baseref'); run('checkout', '-q', '-b', 'feat');
  const check = (msg) => {
    run('add', '-A'); run('commit', '-q', '-m', msg || 'change');
    return pc.evaluate(pc.makeIo(dir, 'baseref'), { skipJscpd: true });
  };
  return { dir, w, run, check };
}

test('baseline records legacy debt and a clean change passes', () => {
  const { w, check } = makeRepo();
  w('backend/src/services/clean.ts', 'export const clean = (a: number): number => a + 1;\n');
  const r = check();
  assert.equal(r.ok, true, JSON.stringify(r.findings));
});

test('editing a legacy file without adding violations passes (debt is frozen, not blocking)', () => {
  const { w, check } = makeRepo();
  w('backend/src/legacy.ts', 'export const old: any = 2;\nconsole.log("legacy");\nexport const fine = 1;\n');
  assert.equal(check().ok, true);
});

test('NEGATIVE: added any, console.log, raw Error and an unauthenticated route each FAIL', () => {
  const { w, check } = makeRepo();
  w('backend/src/services/clean.ts', 'export const clean = (a: any): number => a;\nconsole.log(1);\nexport function f(): void { throw new Error("x"); }\n');
  w('backend/src/routes/gRoutes.ts', "import { Router } from 'express';\nconst router = Router();\nrouter.get('/', authMiddleware, c.list);\nrouter.get('/open', c.open);\nexport default router;\n");
  const r = check();
  assert.equal(r.ok, false);
  const got = new Set(r.findings.map((f) => f.rule));
  for (const rule of ['P1-any', 'P3-console', 'P2-raw-error', 'P5-route-auth']) assert.ok(got.has(rule), rule);
});

test('NEGATIVE: growing legacy debt in an already-baselined file fails', () => {
  const { w, check } = makeRepo();
  w('backend/src/legacy.ts', 'export const old: any = 1;\nconsole.log("legacy");\nconsole.log("more");\n');
  const r = check();
  assert.equal(r.ok, false);
  assert.equal(r.findings[0].rule, 'P3-console');
  assert.equal(r.findings[0].line, 3);
});

test('a Principles-Exempt commit trailer suppresses that rule only', () => {
  const { w, check } = makeRepo();
  w('backend/src/services/clean.ts', 'export const clean = (a: any): number => a;\nconsole.log(1);\n');
  const r = check('change\n\nPrinciples-Exempt: P3-console temporary debug');
  assert.deepEqual(r.findings.map((f) => f.rule), ['P1-any']);
});

test('P8: a new service without a test fails; a new util without a test only warns', () => {
  const { w, check } = makeRepo();
  w('backend/src/services/newThing.ts', 'export const newThing = (): number => 1;\n');
  w('backend/src/lib/helper.ts', 'export const helper = (): number => 1;\n');
  const r = check();
  assert.deepEqual(r.findings.map((f) => f.rule), ['P8-missing-test']);
  assert.ok(r.warnings.some((x) => x.file.endsWith('helper.ts') && x.rule === 'P8-missing-test'));
});

test('P9 warns on a newly added export nobody references', () => {
  const { w, check } = makeRepo();
  w('backend/src/lib/orphan.ts', 'export const orphanThing = (): number => 1;\n');
  assert.ok(check().warnings.some((x) => x.rule === 'P9-unused-export'));
});

test('editing the baseline to raise a count fails unless Principles-Baseline-Raise is present', () => {
  const { dir, w, check } = makeRepo();
  const bp = path.join(dir, 'scripts/principles-baseline.json');
  const b = JSON.parse(fs.readFileSync(bp, 'utf8'));
  b.files['backend/src/legacy.ts']['P3-console'] += 5;
  w('scripts/principles-baseline.json', JSON.stringify(b));
  const r = check();
  assert.ok(r.findings.some((f) => f.rule === 'BASELINE-RAISED'));
});

test('P7: jscpd clone overlapping added lines fails; unavailable jscpd fails only with requireJscpd', () => {
  const { dir, w, run } = makeRepo();
  w('backend/src/lib/dup.ts', 'export const d = (): number => 1;\nexport const e = (): number => 2;\n');
  run('add', '-A'); run('commit', '-q', '-m', 'c');
  const io = pc.makeIo(dir, 'baseref');
  const report = { duplicates: [{ lines: 9, firstFile: { name: 'backend/src/lib/dup.ts', start: 1, end: 2 }, secondFile: { name: 'backend/src/legacy.ts', start: 1, end: 2 } }] };
  const hit = pc.evaluate(io, { jscpdRunner: () => ({ report }) });
  assert.ok(hit.findings.some((f) => f.rule === 'P7-duplication'));
  const soft = pc.evaluate(io, { jscpdRunner: () => ({ error: 'no network' }) });
  assert.equal(soft.findings.some((f) => f.rule === 'P7-duplication'), false);
  const hard = pc.evaluate(io, { requireJscpd: true, jscpdRunner: () => ({ error: 'no network' }) });
  assert.ok(hard.findings.some((f) => f.rule === 'P7-duplication'));
});

test('--report prints a markdown table naming the rule ids', () => {
  const { w, check } = makeRepo();
  w('backend/src/lib/x.ts', 'console.log(1);\n');
  const md = pc.formatReport(check());
  assert.match(md, /Principles ratchet: FAIL/);
  assert.match(md, /\| FAIL \| P3-console \|/);
});
