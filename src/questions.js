(function (G) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const sup = (n) => '<sup>' + n + '</sup>';
  const BASE = [2, 3, 4, 5];

  // Distraktor dibuat dari KESALAHAN KHAS SISWA, bukan angka acak.
  // Acak murni menghasilkan opsi yang gampang ditebak dan tidak mendidik.

  function mul(r, tier) {
    const a = pick(r, BASE), m = ri(r, 2, 2 + tier), n = ri(r, 2, 2 + tier);
    const right = m + n;
    let wrong = m * n;
    if (wrong === right) wrong = right + 1;
    return {
      kind: 'mul', tier,
      prompt: a + sup(m) + ' &times; ' + a + sup(n) + ' = &hellip;',
      right: a + sup(right), wrong: a + sup(wrong),
      explain: 'Basis sama dikali &rarr; pangkat DIJUMLAHKAN: ' + m + ' + ' + n + ' = ' + right + '.'
    };
  }

  function div(r, tier) {
    const a = pick(r, BASE), n = ri(r, 2, 2 + tier), m = n + ri(r, 1, 2 + tier);
    const right = m - n;
    return {
      kind: 'div', tier,
      prompt: a + sup(m) + ' &divide; ' + a + sup(n) + ' = &hellip;',
      right: a + sup(right), wrong: a + sup(m + n),
      explain: 'Basis sama dibagi &rarr; pangkat DIKURANGKAN: ' + m + ' &minus; ' + n + ' = ' + right + '.'
    };
  }

  function zero(r, tier) {
    const a = ri(r, 2, 9);
    return {
      kind: 'zero', tier,
      prompt: a + sup(0) + ' = &hellip;',
      right: '1', wrong: String(pick(r, [0, a])),
      explain: 'Setiap bilangan (kecuali 0) berpangkat 0 hasilnya 1.'
    };
  }

  function neg(r, tier) {
    const a = pick(r, [2, 3, 4]), n = ri(r, 1, 1 + tier);
    return {
      kind: 'neg', tier,
      prompt: a + sup('-' + n) + ' = &hellip;',
      right: '1/' + a + sup(n), wrong: '-' + a + sup(n),
      explain: 'Pangkat negatif = kebalikannya: ' + a + sup('-' + n) + ' = 1/' + a + sup(n) + '.'
    };
  }

  function pow(r, tier) {
    const a = pick(r, [2, 3]), m = ri(r, 2, 2 + Math.min(tier, 3)), n = ri(r, 2, 2 + Math.min(tier, 2));
    const right = m * n;
    let wrong = m + n;
    if (wrong === right) wrong = right + 2;
    return {
      kind: 'pow', tier,
      prompt: '(' + a + sup(m) + ')' + sup(n) + ' = &hellip;',
      right: a + sup(right), wrong: a + sup(wrong),
      explain: 'Pangkat dari pangkat &rarr; pangkat DIKALIKAN: ' + m + ' &times; ' + n + ' = ' + right + '.'
    };
  }

  function mix(r, tier) {
    const a = pick(r, [2, 3]), m = ri(r, 3, 4 + tier), n = ri(r, 2, 3), k = ri(r, 1, 2);
    const right = m + n - k;
    return {
      kind: 'mix', tier,
      prompt: a + sup(m) + ' &times; ' + a + sup(n) + ' &divide; ' + a + sup(k) + ' = &hellip;',
      right: a + sup(right), wrong: a + sup(m + n + k),
      explain: 'Jumlahkan pangkat yang dikali (' + (m + n) + '), lalu kurangi: ' + (m + n) + ' &minus; ' + k + ' = ' + right + '.'
    };
  }

  const BUILDERS = { mul, div, zero, neg, pow, mix };

  // ── Resep per level. Awalan "story:" = soal cerita (dibangun src/story.js).
  // SETIAP level punya TEPAT 3 soal cerita, disebar (tidak menumpuk di awal)
  // supaya anak tidak bosan dan tidak kaget di soal pertama.
  //   L1: bentuk pangkat dasar     -> cerita di soal 2, 5, 8
  //   L2: + pangkat nol & negatif  -> cerita di soal 3, 6, 9
  //   L3: pangkat-dari-pangkat     -> cerita di soal 2, 5, 9
  const RECIPE = {
    1: ['mul', 'story:mul', 'div', 'mul', 'story:div', 'div', 'mul', 'story:mul', 'div', 'mul'],
    2: ['mul', 'zero', 'story:zero', 'div', 'neg', 'story:neg', 'pow', 'zero', 'story:mul', 'pow'],
    3: ['pow', 'story:pow', 'mix', 'neg', 'story:mix', 'pow', 'mix', 'neg', 'story:pow', 'mix']
  };

  // Soal cerita dibangun Story (file terpisah) kalau ada; kalau tidak ada,
  // jatuh kembali ke bentuk pangkat biasa supaya generator tidak pernah crash
  // (mis. kalau urutan <script> di build salah).
  function build(kind, r, tier) {
    if (kind.indexOf('story:') === 0) {
      const base = kind.slice(6);
      const S = G.Story && G.Story.STORY;
      if (S && S[base]) {
        const q = S[base](r, tier);
        return {
          kind: base, tier, isStory: true,
          story: q.story, prompt: q.prompt,
          right: q.right, wrong: q.wrong, explain: q.explain
        };
      }
      return Object.assign({ isStory: false }, BUILDERS[base](r, tier));
    }
    return Object.assign({ isStory: false }, BUILDERS[kind](r, tier));
  }

  function generateLevel(level, seed) {
    const recipe = RECIPE[level];
    if (!recipe) throw new Error('level tidak dikenal: ' + level);
    const r = mulberry32(seed + level * 7919);
    const out = [];
    const seen = new Set();
    let guard = 0;
    for (let i = 0; i < recipe.length; i++) {
      const tier = 1 + Math.floor((i * 4) / recipe.length);
      let q;
      do {
        q = build(recipe[i], r, tier);
        guard++;
      } while (seen.has((q.story || '') + '|' + q.prompt) && guard < 400);
      seen.add((q.story || '') + '|' + q.prompt);
      // Posisi jawaban benar diacak supaya tidak selalu opsi pertama.
      const flip = r() < 0.5;
      out.push({
        id: level + '-' + i,
        kind: q.kind,
        tier: q.tier,
        isStory: q.isStory,
        story: q.story || '',
        prompt: q.prompt,
        options: flip ? [q.wrong, q.right] : [q.right, q.wrong],
        correct: flip ? 1 : 0,
        explain: q.explain
      });
    }
    return out;
  }

  G.Questions = { generateLevel, mulberry32, RECIPE };
})(globalThis.GK = globalThis.GK || {});
