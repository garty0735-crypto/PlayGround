import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  damp,
  formatCompact,
  formatScore,
  seededRandom,
  shuffle,
} from '../src/utils.js';

test('clamp keeps values inside the requested range', () => {
  assert.equal(clamp(-4, 0, 10), 0);
  assert.equal(clamp(14, 0, 10), 10);
  assert.equal(clamp(6, 0, 10), 6);
});

test('damp is frame-rate independent and settles on the target', () => {
  const oneStep = damp(0, 10, 5, 1);
  const twoSteps = damp(damp(0, 10, 5, 0.5), 10, 5, 0.5);
  assert.ok(Math.abs(oneStep - twoSteps) < 1e-9);
  assert.ok(oneStep > 9.9);
});

test('formatScore always renders a six-digit score', () => {
  assert.equal(formatScore(0), '000000');
  assert.equal(formatScore(42.9), '000042');
  assert.equal(formatScore(-9), '000000');
  assert.equal(formatScore(1234567), '1234567');
});

test('formatCompact abbreviates large totals', () => {
  assert.equal(formatCompact(9999), '9,999');
  assert.equal(formatCompact(12000), '12K');
  assert.equal(formatCompact(2400000), '2.4M');
});

test('shuffle keeps every item and seededRandom is deterministic', () => {
  const source = [0, 1, 2, 3, 4];
  const shuffled = shuffle(source);
  assert.deepEqual([...shuffled].sort(), source);
  assert.deepEqual(source, [0, 1, 2, 3, 4]);

  const first = seededRandom(88);
  const second = seededRandom(88);
  assert.equal(first(), second());
  assert.equal(first(), second());
});
