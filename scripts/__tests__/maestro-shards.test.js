'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitFlows, shardFlows, aggregate } = require('../maestro-shards');

const FLOWS = ['d.yaml', 'a.yaml', 'c.yaml', 'b.yaml', 'e.yaml'];

test('every flow lands in exactly one shard, none lost or duplicated', () => {
  const shards = splitFlows(FLOWS, 3);
  assert.equal(shards.length, 3);
  assert.deepEqual(shards.flat().sort(), [...FLOWS].sort());
});

test('split is deterministic by sorted filename regardless of input order', () => {
  assert.deepEqual(splitFlows(FLOWS, 2), splitFlows([...FLOWS].reverse(), 2));
  assert.deepEqual(shardFlows(FLOWS, 1, 2), ['a.yaml', 'c.yaml', 'e.yaml']);
  assert.deepEqual(shardFlows(FLOWS, 2, 2), ['b.yaml', 'd.yaml']);
});

test('more shards than flows yields empty shards, not an error', () => {
  assert.deepEqual(shardFlows(['a.yaml'], 2, 3), []);
});

test('invalid shard or count throws', () => {
  assert.throws(() => shardFlows(FLOWS, 0, 3));
  assert.throws(() => shardFlows(FLOWS, 4, 3));
  assert.throws(() => shardFlows(FLOWS, 1, 0));
});

test('aggregate passes only when every shard succeeded (no silent pass)', () => {
  assert.equal(aggregate(['success', 'success']), true);
  assert.equal(aggregate(['success', 'failure']), false);
  assert.equal(aggregate(['success', 'cancelled']), false);
  assert.equal(aggregate(['success', 'skipped']), false);
  assert.equal(aggregate([]), false);
});
