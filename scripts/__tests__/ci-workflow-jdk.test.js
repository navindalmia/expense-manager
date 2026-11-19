'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '..', '.github', 'workflows');

// Drops YAML comment lines so a commented-out pin cannot satisfy the guard.
function stripComments(text) {
  return text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
}

// Splits a workflow into top-level job blocks (2-space-indented keys under `jobs:`).
function jobs(text) {
  const body = stripComments(text).split(/^jobs:\s*$/m)[1] || '';
  return body.split(/^(?=  [A-Za-z0-9_-]+:\s*$)/m).filter((b) => /^  [A-Za-z0-9_-]+:/.test(b));
}

// A job builds Android when it runs gradlew (except `--stop`) or `expo run:android`.
function buildsAndroid(job) {
  const gradle = job.split('\n').some((l) => /(^|[\s/])gradlew\b/.test(l) && !/gradlew\s+--stop/.test(l));
  return gradle || /expo\s+run:android/.test(job);
}

// Returns an error string, or null when the job pins JDK 17 before the build step.
function jdkProblem(job) {
  const pin = job.search(/uses:\s*actions\/setup-java@v\d+\.\d+\.\d+/);
  if (pin < 0) return 'lacks pinned setup-java';
  if (!/java-version:\s*"?17"?\s*$/m.test(job)) return 'must use JDK 17';
  const build = job.search(/(^|[\s/])gradlew\b(?!\s+--stop)|expo\s+run:android/m);
  return pin < build ? null : 'setup-java must precede the build step';
}

test('guard flags Android build jobs without a pinned JDK 17 (negative fixtures)', () => {
  const base = '  build:\n    steps:\n';
  const build = '      - run: ./gradlew assembleDebug\n';
  const pin = '      - uses: actions/setup-java@v5.2.0\n        with:\n          java-version: "17"\n';
  assert.equal(buildsAndroid(base + build), true);
  assert.equal(buildsAndroid(base + '      - run: ./android/gradlew --stop\n'), false);
  assert.equal(buildsAndroid(base + '      - run: cd android && gradlew assembleRelease\n'), true);
  assert.equal(buildsAndroid(base + '      - run: npx expo run:android\n'), true);
  assert.equal(jdkProblem(base + build), 'lacks pinned setup-java');
  assert.equal(jdkProblem(base + pin.replace('17', '21') + build), 'must use JDK 17');
  assert.equal(jdkProblem(base + build + pin), 'setup-java must precede the build step');
  assert.equal(jdkProblem(base + pin + build), null);
  const commented = jobs('jobs:\n  build:\n    steps:\n' + pin.replace(/^/gm, '#') + build);
  assert.equal(jdkProblem(commented[0]), 'lacks pinned setup-java');
});

test('every workflow job that builds Android pins JDK 17 via setup-java before the build', () => {
  let checked = 0;
  for (const f of fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    for (const job of jobs(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!buildsAndroid(job)) continue;
      checked += 1;
      const name = job.match(/^  ([^:\s]+):/)[1];
      assert.equal(jdkProblem(job), null, `${f}:${name} ${jdkProblem(job)}`);
    }
  }
  assert.ok(checked >= 1, 'expected at least one Android build job');
});
