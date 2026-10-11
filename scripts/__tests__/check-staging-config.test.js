'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkStagingConfig } = require('../check-staging-config');

const eas = (url) => ({ build: { staging: { env: { EXPO_PUBLIC_API_BASE_URL: url } } } });

test('placeholder URL fails', () => {
  assert.equal(checkStagingConfig(eas('https://REPLACE-WITH-STAGING-RENDER-HOST.onrender.com/api')).length, 1);
});

test('real staging URL passes', () => {
  assert.deepEqual(checkStagingConfig(eas('https://em-staging.onrender.com/api')), []);
});

test('production URL fails', () => {
  assert.equal(checkStagingConfig(eas('https://expense-manager-udoo.onrender.com/api')).length, 1);
});

test('missing profile fails', () => {
  assert.equal(checkStagingConfig({ build: {} }).length, 1);
});

test('empty or placeholder extra URL fails', () => {
  const ok = eas('https://em-staging.onrender.com/api');
  assert.equal(checkStagingConfig(ok, ['']).length, 1);
  assert.equal(checkStagingConfig(ok, ['https://REPLACE-x/api']).length, 1);
});

