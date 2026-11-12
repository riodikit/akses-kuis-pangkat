const { test } = require('node:test');
const assert = require('node:assert');
require('../src/story.js');
const S = globalThis.GK.Story.STORY;

function rnd(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('setiap builder soal cerita menghasilkan right != wrong', () => {
  for (const [kind, fn] of Object.entries(S)) {
    for (let seed = 1; seed <= 60; seed++) {
      for (const tier of [1, 2, 3, 4]) {
        const q = fn(rnd(seed * 31 + tier), tier);
        assert.notEqual(q.right, q.wrong, kind + ' seed ' + seed + ' tier ' + tier);
      }
    }
  }
});

test('setiap builder punya story, prompt, explain yang tidak kosong', () => {
  for (const [kind, fn] of Object.entries(S)) {
    const q = fn(rnd(7), 2);
    assert.ok(q.story && q.story.length > 20, kind + ' story');
    assert.ok(q.prompt && q.prompt.length > 5, kind + ' prompt');
    assert.ok(q.explain && q.explain.length > 20, kind + ' explain');
  }
});

test('storyMul: jawaban = jumlah pangkat di cerita', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = S.mul(rnd(seed), 2);
    const basis = q.right.match(/^(\d+)<sup>/)[1];
    const exps = [...q.story.matchAll(/<sup>(\d+)<\/sup>/g)].map(m => +m[1]);
    assert.equal(exps.length, 2, 'cerita punya 2 pangkat');
    assert.equal(q.right, basis + '<sup>' + (exps[0] + exps[1]) + '</sup>');
  }
});

test('storyDiv: jawaban = selisih pangkat di cerita', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = S.div(rnd(seed), 2);
    const basis = q.right.match(/^(\d+)<sup>/)[1];
    const exps = [...q.story.matchAll(/<sup>(\d+)<\/sup>/g)].map(m => +m[1]);
    assert.equal(q.right, basis + '<sup>' + (exps[0] - exps[1]) + '</sup>');
  }
});

test('storyNeg: cerita memuat pangkat negatif, jawaban bentuk 1/a^n', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const q = S.neg(rnd(seed), 2);
    assert.ok(/<sup>-\d+<\/sup>/.test(q.story), 'cerita memuat pangkat negatif');
    assert.ok(/^1\//.test(q.right), 'jawaban bentuk pecahan');
    assert.ok(/^-/.test(q.wrong), 'distraktor berupa bilangan negatif');
  }
});

test('storyZero: jawaban selalu 1, distraktor bukan 1 dan bukan 0', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const q = S.zero(rnd(seed), 2);
    assert.equal(q.right, '1');
    assert.notEqual(q.wrong, '1');
    assert.notEqual(q.wrong, '0', 'distraktor 0 terlalu gampang ditebak');
  }
});

test('storyPow: jawaban = hasil kali pangkat di cerita', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = S.pow(rnd(seed), 2);
    const basis = q.right.match(/^(\d+)<sup>/)[1];
    const exps = [...q.story.matchAll(/<sup>(\d+)<\/sup>/g)].map(m => +m[1]);
    assert.equal(q.right, basis + '<sup>' + (exps[0] * exps[1]) + '</sup>');
  }
});

test('storyMix: jawaban = m + n - k', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = S.mix(rnd(seed), 2);
    const basis = q.right.match(/^(\d+)<sup>/)[1];
    const exps = [...q.story.matchAll(/<sup>(\d+)<\/sup>/g)].map(m => +m[1]);
    assert.equal(exps.length, 3, 'cerita punya 3 pangkat');
    assert.equal(q.right, basis + '<sup>' + (exps[0] + exps[1] - exps[2]) + '</sup>');
  }
});

test('teks cerita cukup pendek untuk kartu HP (maks 190 karakter)', () => {
  for (const [kind, fn] of Object.entries(S)) {
    for (let seed = 1; seed <= 40; seed++) {
      const q = fn(rnd(seed), 4);
      const plain = q.story.replace(/<[^>]+>/g, '');
      assert.ok(plain.length <= 190, kind + ' terlalu panjang: ' + plain.length);
    }
  }
});

test('tidak ada entity HTML asing di luar yang didukung', () => {
  const allowed = /&(times|divide|minus|rarr|hellip);/g;
  for (const [kind, fn] of Object.entries(S)) {
    for (let seed = 1; seed <= 20; seed++) {
      const q = fn(rnd(seed), 2);
      const stripped = (q.story + q.prompt + q.explain).replace(allowed, '');
      assert.ok(!/&[a-z]+;/.test(stripped), kind + ' punya entity asing');
    }
  }
});

test('basis tidak pernah 0 atau 1', () => {
  for (const [kind, fn] of Object.entries(S)) {
    for (let seed = 1; seed <= 40; seed++) {
      const q = fn(rnd(seed), 2);
      let basis;
      if (kind === 'neg') {
        basis = +q.right.match(/^1\/(\d+)/)[1];
      } else if (kind === 'zero') {
        basis = +q.story.match(/(\d+)<sup>0<\/sup>/)[1];
      } else {
        basis = +q.right.match(/^(\d+)/)[1];
      }
      assert.ok(basis >= 2, kind + ' basis ' + basis);
    }
  }
});
