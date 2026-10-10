'use strict';

// Sharding + aggregation helpers for the e2e-mobile CI jobs.
//   node scripts/maestro-shards.js matrix <count>              -> {"shard":[1..count]}
//   node scripts/maestro-shards.js list <shard> <count> <dir>  -> flow files for that shard
//   node scripts/maestro-shards.js aggregate <result>...       -> exit 1 unless all are "success"
// Flows are sorted by filename and dealt round-robin, so a given flow always
// lands on the same shard for a given count.
const fs = require('node:fs');
const path = require('node:path');

function splitFlows(files, count) {
  const sorted = [...files].sort();
  const shards = Array.from({ length: count }, () => []);
  sorted.forEach((f, i) => shards[i % count].push(f));
  return shards;
}

function shardFlows(files, shard, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`invalid shard count: ${count}`);
  if (!Number.isInteger(shard) || shard < 1 || shard > count) throw new Error(`invalid shard ${shard} of ${count}`);
  return splitFlows(files, count)[shard - 1];
}

// No silent pass: anything other than an explicit "success" (failure,
// cancelled, skipped, empty) fails the aggregate.
function aggregate(results) {
  return results.length > 0 && results.every((r) => r === 'success');
}

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === 'matrix') {
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 1) throw new Error(`invalid shard count: ${args[0]}`);
    console.log(JSON.stringify({ shard: Array.from({ length: count }, (_, i) => i + 1) }));
  } else if (cmd === 'list') {
    const [shard, count, dir] = [Number(args[0]), Number(args[1]), args[2]];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => path.join(dir, f));
    console.log(shardFlows(files, shard, count).join('\n'));
  } else if (cmd === 'aggregate') {
    if (!aggregate(args)) {
      console.error(`e2e-mobile shard results: ${args.join(', ') || '(none)'} - failing`);
      process.exit(1);
    }
    console.log(`e2e-mobile shard results: ${args.join(', ')} - all passed`);
  } else {
    throw new Error(`unknown command: ${cmd}`);
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { splitFlows, shardFlows, aggregate };
