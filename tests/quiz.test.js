const { test } = require('node:test');
const assert = require('node:assert');
require('../src/quiz.js');
const Z = globalThis.GK.Quiz;

const QS = [
  { id: 'a', prompt: 'q1', options: ['x', 'y'], correct: 0, explain: 'e1' },
  { id: 'b', prompt: 'q2', options: ['x', 'y'], correct: 1, explain: 'e2' }
];

test('create memulai di soal pertama, tertutup', () => {
  const s = Z.create(1, QS);
  assert.equal(s.index, 0);
  assert.equal(s.open, false);
  assert.equal(Z.current(s).id, 'a');
  assert.equal(Z.score(s), 0);
});

test('jawaban benar menambah 10 poin', () => {
  const s = Z.create(1, QS);
  s.open = true;
  Z.answer(s, 0);
  assert.equal(Z.score(s), 10);
  assert.equal(Z.correctCount(s), 1);
  assert.equal(Z.wrongCount(s), 0);
});

test('jawaban salah bernilai 0 tapi tetap tercatat', () => {
  const s = Z.create(1, QS);
  s.open = true;
  Z.answer(s, 1);
  assert.equal(Z.score(s), 0);
  assert.equal(Z.wrongCount(s), 1);
  assert.equal(s.answers.length, 1);
  assert.equal(s.answers[0].correct, false);
});

test('satu soal hanya bisa dijawab sekali', () => {
  const s = Z.create(1, QS);
  s.open = true;
  Z.answer(s, 0);
  Z.answer(s, 0);
  assert.equal(s.answers.length, 1);
  assert.equal(Z.score(s), 10);
});

test('next membuka soal berikutnya', () => {
  const s = Z.create(1, QS);
  s.open = true;
  Z.answer(s, 0);
  Z.next(s);
  assert.equal(s.open, true);
  assert.equal(s.locked, false);
  assert.equal(Z.current(s).id, 'b');
});

test('menjawab semua soal menandai done dengan skor maksimal', () => {
  const s = Z.create(1, QS);
  s.open = true;
  Z.answer(s, 0);
  Z.next(s);
  Z.answer(s, 1);
  assert.equal(s.done, true);
  assert.equal(Z.score(s), 20);
  assert.equal(Z.correctCount(s), 2);
});

test('summary memuat skor, benar, salah, dan rincian', () => {
  const s = Z.create(2, QS);
  s.open = true;
  Z.answer(s, 1);
  const sum = Z.summary(s);
  assert.equal(sum.levelId, 2);
  assert.equal(sum.score, 0);
  assert.equal(sum.max, 20);
  assert.equal(sum.correct, 0);
  assert.equal(sum.wrong, 1);
  assert.equal(sum.answers.length, 1);
  assert.equal(sum.answers[0].explain, 'e1');
});

test('skor 10 soal benar = 100', () => {
  const ten = [];
  for (let i = 0; i < 10; i++) ten.push({ id: 'q' + i, prompt: 'p' + i, options: ['a', 'b'], correct: 0, explain: 'e' });
  const s = Z.create(3, ten);
  for (let i = 0; i < 10; i++) { s.open = true; Z.answer(s, 0); Z.next(s); }
  assert.equal(Z.score(s), 100);
  assert.equal(s.done, true);
});
