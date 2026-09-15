'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getCurrentCycleStart,
  getReferenceDate,
} = require('../src/services/creditCardRewardCycles');

test('getCurrentCycleStart: selected month uses the matching cycle year', () => {
  const referenceDate = getReferenceDate('2026-09');

  assert.equal(
    getCurrentCycleStart('2000-09-01', referenceDate),
    '2026-09-01',
  );
});

test('getCurrentCycleStart: selected month before effective month uses previous cycle year', () => {
  const referenceDate = getReferenceDate('2026-09');

  assert.equal(
    getCurrentCycleStart('2000-10-01', referenceDate),
    '2025-10-01',
  );
});

test('getCurrentCycleStart: date objects are read as stored calendar months', () => {
  const referenceDate = getReferenceDate('2026-02');

  assert.equal(
    getCurrentCycleStart(new Date('2000-03-01T00:00:00.000Z'), referenceDate),
    '2025-03-01',
  );
});
