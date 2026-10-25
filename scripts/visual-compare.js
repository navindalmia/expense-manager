#!/usr/bin/env node
// Side-by-side report of Maestro visual baselines vs the screenshots a CI run produced.
//   node scripts/visual-compare.js <run-id> [out-dir]      (needs the gh CLI, logged in)
//   node scripts/visual-compare.js --dir <artifacts-dir> [out-dir]   (already downloaded)
// Writes <out-dir>/index.html (default /tmp/visual-compare-<run-id>) and opens it on macOS.
// Flags: --inline  embed images as data URIs (one self-contained index.html, shareable as a single
//                   file) and keep only flows that did not pass, unless --all is also given;
//        --all     keep passing flows too;   --no-open  do not open the page.
// Per flow: committed baseline (maestro-flows/visual/<flow>.png) on the left, the run's
// last assertScreenshot image on the right, with Maestro's similarity % when it failed.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINES = path.join(REPO_ROOT, 'maestro-flows', 'visual');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// <artifacts>/maestro-debug-output-N/<timestamp>/<flow>/screenshots/step-NNN-assertScreenshot.png
// Retries create several timestamp dirs per flow; the last one is the attempt that decided the result.
function collectRuns(artifactsDir) {
  const byFlow = new Map();
  for (const file of walk(artifactsDir)) {
    if (!/assertScreenshot\.png$/.test(file)) continue;
    const parts = file.split(path.sep);
    const i = parts.lastIndexOf('screenshots');
    if (i < 2) continue;
    const flow = parts[i - 1];
    const stamp = parts[i - 2];
    const prev = byFlow.get(flow);
    if (!prev || stamp > prev.stamp) byFlow.set(flow, { flow, stamp, file, flowDir: parts.slice(0, i).join(path.sep) });
  }
  return [...byFlow.values()].sort((a, b) => a.flow.localeCompare(b.flow));
}

function similarityFor(flowDir) {
  try {
    const cmds = JSON.parse(fs.readFileSync(path.join(flowDir, 'commands.json'), 'utf8'));
    for (const c of cmds) {
      const msg = c?.metadata?.error?.message ?? '';
      const m = /current: ([\d.]+)%/.exec(msg);
      if (c?.metadata?.status === 'FAILED' && m) return `${Number(m[1]).toFixed(2)}% similar (FAILED, threshold 95%)`;
      if (c?.metadata?.status === 'FAILED' && /not found/.test(msg)) return 'no baseline committed (FAILED)';
    }
  } catch { /* no commands.json: report no similarity */ }
  return 'passed';
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function dataUri(file) {
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function render(rows, title) {
  const cards = rows.map((r) => `
  <section class="${r.status.includes('FAILED') ? 'bad' : ''}">
    <h2>${esc(r.flow)} <small>${esc(r.status)}</small></h2>
    <div class="pair">
      <figure>${r.baseline ? `<img src="${esc(r.baseline)}">` : '<div class="none">no baseline</div>'}<figcaption>Baseline (committed)</figcaption></figure>
      <figure><img src="${esc(r.actual)}"><figcaption>This run</figcaption></figure>
    </div>
  </section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:14px system-ui;margin:16px;background:#fafafa}h1{font-size:18px}section{margin:0 0 24px;padding:12px;background:#fff;border:1px solid #ddd;border-radius:8px}
section.bad{border-color:#d33}h2{font-size:15px;margin:0 0 8px}small{color:#666;font-weight:400}.bad small{color:#d33}
.pair{display:flex;gap:12px}figure{margin:0;flex:1;text-align:center}img{max-width:100%;max-height:640px;border:1px solid #ccc}
.none{padding:80px 0;color:#d33;border:1px dashed #d33}figcaption{color:#555;margin-top:4px}</style>
<h1>${esc(title)}</h1>${cards}`;
}

function main(argv) {
  let artifacts;
  let runId = 'local';
  const flags = new Set(argv.filter((a) => ['--inline', '--all', '--no-open'].includes(a)));
  const args = argv.filter((a) => !flags.has(a));
  if (args[0] === '--dir') {
    artifacts = path.resolve(args[1] || '');
    args.splice(0, 2);
  } else if (args[0]) {
    runId = args.shift();
    artifacts = path.join(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vc-art-')), 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    execFileSync('gh', ['run', 'download', runId, '-p', 'maestro-debug-output-*', '-D', artifacts], { stdio: 'inherit' });
  } else {
    console.error('usage: visual-compare.js <run-id> [out-dir] | --dir <artifacts-dir> [out-dir]');
    return 1;
  }
  const out = path.resolve(args[0] || `/tmp/visual-compare-${runId}`);
  fs.mkdirSync(path.join(out, 'img'), { recursive: true });

  const inline = flags.has('--inline');
  let runs = collectRuns(artifacts).map((r) => ({ ...r, status: similarityFor(r.flowDir) }));
  if (inline && !flags.has('--all')) runs = runs.filter((r) => r.status !== 'passed');
  const rows = runs.map((r) => {
    const basePath = path.join(BASELINES, `${r.flow}.png`);
    const hasBase = fs.existsSync(basePath);
    if (inline) {
      return { flow: r.flow, baseline: hasBase ? dataUri(basePath) : null, actual: dataUri(r.file), status: r.status };
    }
    const actual = `img/${r.flow}.actual.png`;
    fs.copyFileSync(r.file, path.join(out, actual));
    let baseline = null;
    if (hasBase) {
      baseline = `img/${r.flow}.baseline.png`;
      fs.copyFileSync(basePath, path.join(out, baseline));
    }
    return { flow: r.flow, baseline, actual, status: r.status };
  });
  // Failures first, so the interesting ones are at the top.
  rows.sort((a, b) => Number(b.status.includes('FAILED')) - Number(a.status.includes('FAILED')));
  fs.writeFileSync(path.join(out, 'index.html'), render(rows, `Maestro screenshots, run ${runId}`));
  const bad = rows.filter((r) => r.status.includes('FAILED')).length;
  console.log(`${rows.length} flows (${bad} failed) -> ${path.join(out, 'index.html')}`);
  if (process.platform === 'darwin' && !flags.has('--no-open')) execFileSync('open', [path.join(out, 'index.html')]);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { collectRuns, similarityFor, render };
