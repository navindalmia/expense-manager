'use strict';

// Derives the staging host root from STAGING_API_URL (which ends in /api).
// The smoke check polls the root health route because /api/internal/* is not
// mounted when NODE_ENV=production (which staging runs).

const HEALTH_MARKER = 'Expense Manager API running';

function deriveRootUrl(apiUrl) {
  const trimmed = (apiUrl || '').trim();
  if (!trimmed) throw new Error('STAGING_API_URL is empty');
  const base = trimmed.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${base}/`;
}

if (require.main === module) {
  try {
    process.stdout.write(`${deriveRootUrl(process.argv[2] ?? process.env.STAGING_API_URL)}\n`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { deriveRootUrl, HEALTH_MARKER };
