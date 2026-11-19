'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', '..', '.github', 'workflows');

// Splits a workflow into top-level job blocks (2-space-indented keys under `jobs:`).
function jobs(text) {
  const body = text.split(/^jobs:\s*$/m)[1] || '';
  return body.split(/^(?=  [A-Za-z0-9_-]+:\s*$)/m).filter((b) => /^  [A-Za-z0-9_-]+:/.test(b));
}

test('every job that runs ./gradlew assembleDebug pins JDK 17 via setup-java', () => {
  let checked = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
    for (const job of jobs(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!/\.\/gradlew\s+(assemble|bundle|build)/.test(job)) continue;
      checked += 1;
      const name = job.match(/^  ([^:\s]+):/)[1];
      assert.match(job, /uses:\s*actions\/setup-java@v\d+\.\d+\.\d+/, `${f}:${name} lacks pinned setup-java`);
      assert.match(job, /java-version:\s*"?17"?/, `${f}:${name} must use JDK 17`);
    }
  }
  assert.ok(checked >= 1, 'expected at least one gradle build job');
});
