const { test } = require('node:test');
const assert = require('node:assert');
require('../src/progress.js');
const P = globalThis.GK.Progress;

test('ambang lulus adalah 60', () => {
  assert.equal(P.PASS_SCORE, 60);
});

test('progress awal hanya membuka level 1', () => {
  const p = P.blank();
  assert.equal(P.isUnlocked(p, 1), true);
  assert.equal(P.isUnlocked(p, 2), false);
  assert.equal(P.isUnlocked(p, 3), false);
});

test('skor 50 tidak membuka level berikutnya', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 50);
  assert.equal(P.isPassed(p, 1), false);
  assert.equal(P.isUnlocked(p, 2), false);
});

test('skor tepat 60 membuka level berikutnya', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 60);
  assert.equal(P.isPassed(p, 1), true);
  assert.equal(P.isUnlocked(p, 2), true);
  assert.equal(P.isUnlocked(p, 3), false);
});

test('skor 100 membuka level 2, bukan level 3', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 100);
  assert.equal(P.isUnlocked(p, 2), true);
  assert.equal(P.isUnlocked(p, 3), false);
});

test('lulus level 1 lalu 2 membuka level 3', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 70);
  P.completeLevel(p, 2, 60);
  assert.equal(P.isUnlocked(p, 3), true);
});

test('gagal di level 2 tidak membuka level 3 walau level 1 lulus', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 90);
  P.completeLevel(p, 2, 40);
  assert.equal(P.isUnlocked(p, 2), true);
  assert.equal(P.isUnlocked(p, 3), false);
});

test('sudah lulus lalu dapat skor rendah tidak mengunci ulang', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 80);
  P.completeLevel(p, 1, 50);
  assert.equal(P.isPassed(p, 1), true);
  assert.equal(P.isUnlocked(p, 2), true);
  assert.equal(P.bestScore(p, 1), 80);
});

test('skor terbaik disimpan dan tidak turun', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 80);
  P.completeLevel(p, 1, 50);
  assert.equal(P.bestScore(p, 1), 80);
});

test('skor lebih tinggi menggantikan skor terbaik', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 60);
  P.completeLevel(p, 1, 100);
  assert.equal(P.bestScore(p, 1), 100);
});

test('skor 0 tetap tercatat sebagai skor terbaik pertama', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 0);
  assert.equal(P.bestScore(p, 1), 0);
  assert.equal(P.isPassed(p, 1), false);
});

test('level 3 lulus tidak membuat level 4 ada', () => {
  const p = P.blank();
  P.completeLevel(p, 1, 100);
  P.completeLevel(p, 2, 100);
  P.completeLevel(p, 3, 100);
  assert.equal(P.isUnlocked(p, 3), true);
  assert.equal(P.isUnlocked(p, 4), false);
});

test('progress rusak di localStorage tidak membuat crash', () => {
  globalThis.localStorage = {
    getItem: () => '{bukan json',
    setItem: () => {}
  };
  const p = P.safeRead();
  assert.equal(P.isUnlocked(p, 1), true);
  assert.equal(P.isUnlocked(p, 2), false);
});
