'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { deriveRootUrl, HEALTH_MARKER } = require('../staging-health-url');

test('strips trailing /api', () => {
  assert.equal(deriveRootUrl('https://x.onrender.com/api'), 'https://x.onrender.com/');
});

test('strips trailing /api/', () => {
  assert.equal(deriveRootUrl('https://x.onrender.com/api/'), 'https://x.onrender.com/');
});

test('keeps a URL that has no /api suffix', () => {
  assert.equal(deriveRootUrl('https://x.onrender.com'), 'https://x.onrender.com/');
  assert.equal(deriveRootUrl('https://x.onrender.com/'), 'https://x.onrender.com/');
});

test('trims whitespace', () => {
  assert.equal(deriveRootUrl('  https://x.onrender.com/api \n'), 'https://x.onrender.com/');
});

test('throws on empty input', () => {
  assert.throws(() => deriveRootUrl(''), /STAGING_API_URL/);
  assert.throws(() => deriveRootUrl(undefined), /STAGING_API_URL/);
});

test('exposes the root health marker', () => {
  assert.equal(HEALTH_MARKER, 'Expense Manager API running');
});

test('CLI prints the root URL', () => {
  const out = execFileSync('node', [path.join(__dirname, '..', 'staging-health-url.js'), 'https://x.onrender.com/api'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'https://x.onrender.com/');
});
