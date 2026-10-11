#!/usr/bin/env node
// Fails (exit 1) if the staging EAS profile still carries an unfilled
// placeholder or points at the production API.
//   node scripts/check-staging-config.js [path/to/eas.json] [extra-url ...]
// Extra URLs (e.g. vars.STAGING_API_URL) get the same checks; an empty extra
// URL is an error because OTA updates would be built against no backend.
'use strict';

const fs = require('node:fs');

const PRODUCTION_HOST = 'expense-manager-udoo';

function checkUrl(label, url) {
  if (!url) return [`${label} is empty`];
  const problems = [];
  if (url.includes('REPLACE-')) problems.push(`${label} still contains a REPLACE- placeholder`);
  if (url.includes(PRODUCTION_HOST)) problems.push(`${label} points at the production API`);
  return problems;
}

function checkStagingConfig(easJson, extraUrls = []) {
  const url = easJson?.build?.staging?.env?.EXPO_PUBLIC_API_BASE_URL;
  return [
    ...checkUrl('eas.json build.staging.env.EXPO_PUBLIC_API_BASE_URL', url),
    ...extraUrls.flatMap((u, i) => checkUrl(`extra URL #${i + 1}`, u)),
  ];
}

if (require.main === module) {
  const [file = 'frontend/eas.json', ...extra] = process.argv.slice(2);
  const problems = checkStagingConfig(JSON.parse(fs.readFileSync(file, 'utf8')), extra);
  problems.forEach((p) => process.stderr.write(`::error::${p}\n`));
  process.exit(problems.length ? 1 : 0);
}

module.exports = { checkStagingConfig };
