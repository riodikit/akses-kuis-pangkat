const { test } = require('node:test');
const assert = require('node:assert');
// Urutan penting: story.js harus dimuat SEBELUM questions.js dipakai,
// supaya generateLevel menemukan GK.Story.STORY dan memakai jalur story:*.
require('../src/story.js');
require('../src/questions.js');
const Q = globalThis.GK.Questions;

test('SETIAP level punya tepat 3 soal cerita', () => {
  for (const lvl of [1, 2, 3]) {
    for (const seed of [1, 5, 42, 777]) {
      const stories = Q.generateLevel(lvl, seed).filter(q => q.isStory);
      assert.equal(stories.length, 3, 'level ' + lvl + ' seed ' + seed + ' -> ' + stories.length);
    }
  }
});

test('soal cerita punya teks cerita, soal biasa tidak', () => {
  for (const lvl of [1, 2, 3]) {
    for (const q of Q.generateLevel(lvl, 42)) {
      if (q.isStory) assert.ok(q.story && q.story.length > 20, 'cerita kosong: ' + q.prompt);
      else assert.equal(q.story, '', 'soal biasa tidak boleh punya cerita');
    }
  }
});

test('soal cerita tersebar, tidak menumpuk di awal/akhir dan tidak berurutan', () => {
  for (const lvl of [1, 2, 3]) {
    const idx = Q.generateLevel(lvl, 42).map((q, i) => q.isStory ? i : -1).filter(i => i >= 0);
    assert.equal(idx.length, 3);
    assert.ok(idx[0] >= 1, 'level ' + lvl + ' cerita di soal pertama');
    for (let i = 1; i < idx.length; i++) {
      assert.ok(idx[i] - idx[i - 1] >= 2, 'level ' + lvl + ' dua cerita berurutan: ' + idx.join(','));
    }
  }
});

test('soal cerita tetap punya 2 opsi berbeda dan tepat satu benar', () => {
  for (const lvl of [1, 2, 3]) {
    for (const q of Q.generateLevel(lvl, 42).filter(q => q.isStory)) {
      assert.equal(q.options.length, 2);
      assert.notEqual(q.options[0], q.options[1], 'opsi kembar: ' + q.prompt);
      assert.ok(q.correct === 0 || q.correct === 1);
      assert.ok(q.explain && q.explain.length > 20, 'penjelasan cerita kosong: ' + q.prompt);
    }
  }
});
