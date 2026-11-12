const { test } = require('node:test');
const assert = require('node:assert');
require('../src/questions.js');
const Q = globalThis.GK.Questions;

test('generateLevel menghasilkan tepat 10 soal per level', () => {
  for (const lvl of [1, 2, 3]) assert.equal(Q.generateLevel(lvl, 42).length, 10);
});

test('setiap soal punya 2 opsi berbeda dan tepat satu benar', () => {
  for (const lvl of [1, 2, 3]) {
    for (const q of Q.generateLevel(lvl, 7)) {
      assert.equal(q.options.length, 2, q.prompt);
      assert.ok(q.correct === 0 || q.correct === 1, q.prompt);
      assert.notEqual(q.options[0], q.options[1], 'opsi kembar: ' + q.prompt);
    }
  }
});

test('deterministik untuk seed yang sama', () => {
  const a = Q.generateLevel(2, 99).map(q => q.prompt).join('|');
  const b = Q.generateLevel(2, 99).map(q => q.prompt).join('|');
  assert.equal(a, b);
});

test('seed berbeda menghasilkan variasi', () => {
  const a = Q.generateLevel(1, 1).map(q => q.prompt).join('|');
  const b = Q.generateLevel(1, 2).map(q => q.prompt).join('|');
  assert.notEqual(a, b);
});

test('tidak ada soal duplikat dalam satu level', () => {
  for (const lvl of [1, 2, 3]) {
    for (const seed of [1, 5, 42, 777]) {
      const p = Q.generateLevel(lvl, seed).map(q => (q.story || '') + '|' + q.prompt);
      assert.equal(new Set(p).size, 10, 'level ' + lvl + ' seed ' + seed);
    }
  }
});

test('generator tidak crash walau Story belum dimuat (jalur fallback)', () => {
  // File test ini sengaja TIDAK me-require src/story.js. node --test menjalankan
  // tiap file di proses terpisah, jadi GK.Story memang tidak ada di sini —
  // ini satu-satunya test yang benar-benar menguji cabang fallback di build().
  const qs = Q.generateLevel(1, 5);
  assert.equal(qs.length, 10);
  for (const q of qs) {
    assert.equal(q.isStory, false, 'belum ada story, jadi tidak ada isStory');
    assert.equal(q.story, '');
  }
});

test('level 2 memuat pangkat negatif dan pangkat nol', () => {
  const all = Q.generateLevel(2, 11).map(q => q.prompt).join(' ');
  assert.ok(/<sup>-/.test(all), 'ada pangkat negatif');
  assert.ok(/<sup>0<\/sup>/.test(all), 'ada pangkat nol');
});

test('level 3 memuat pangkat dari pangkat', () => {
  const all = Q.generateLevel(3, 12).map(q => q.prompt).join(' ');
  assert.ok(/\)<sup>/.test(all), 'ada bentuk (a^m)^n');
});

test('kesulitan naik di dalam satu level', () => {
  for (const lvl of [1, 2, 3]) {
    const qs = Q.generateLevel(lvl, 3);
    assert.ok(qs[9].tier >= qs[0].tier, 'level ' + lvl);
  }
});

test('setiap soal punya penjelasan tidak kosong', () => {
  for (const q of Q.generateLevel(1, 4)) {
    assert.ok(q.explain && q.explain.length > 10, q.prompt);
  }
});

test('semua prompt memakai <sup> (bukan karakter unicode pangkat)', () => {
  const all = Q.generateLevel(3, 8).map(q => q.prompt).join(' ');
  assert.ok(!/[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(all), 'jangan pakai unicode superscript');
});
