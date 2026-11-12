(function (G) {
  'use strict';

  const KEY = 'kuis-pangkat.progress.v1';
  const PASS_SCORE = 60;   // minimal skor untuk membuka level berikutnya
  const LEVEL_COUNT = 3;   // jaga-jaga: level di luar 1..3 selalu "terkunci"

  // Progress: { best: { 1: 80, 2: 60 } }
  // Status terbuka DITURUNKAN dari skor terbaik, bukan disimpan terpisah.
  // Konsekuensi penting: kalau pemain sudah lulus level 1 dengan 80 lalu
  // mengulang dan cuma dapat 50, skor terbaiknya tetap 80 -> level 2 TIDAK
  // terkunci lagi. Ini yang bikin "sudah pernah lulus" bersifat permanen.
  function blank() {
    return { best: {} };
  }

  function safeRead() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return blank();
      return { best: (p && p.best) || {} };
    } catch (e) {
      // localStorage bisa diblokir di file:// — jangan sampai game ikut mati.
      return blank();
    }
  }

  function safeWrite(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* diamkan */ }
  }

  function bestScore(p, levelId) {
    const b = p.best[levelId];
    return typeof b === 'number' ? b : null;
  }

  function isPassed(p, levelId) {
    const b = bestScore(p, levelId);
    return b !== null && b >= PASS_SCORE;
  }

  function isUnlocked(p, levelId) {
    if (levelId < 1 || levelId > LEVEL_COUNT) return false;
    if (levelId === 1) return true;
    return isPassed(p, levelId - 1);
  }

  // Dipanggil saat pemain menyentuh piala. Skor terbaik selalu dicatat,
  // tapi level berikutnya hanya terbuka kalau skor >= PASS_SCORE.
  function completeLevel(p, levelId, score) {
    const prev = bestScore(p, levelId);
    if (prev === null || score > prev) p.best[levelId] = score;
    safeWrite(p);
    return p;
  }

  function reset() {
    const p = blank();
    safeWrite(p);
    return p;
  }

  G.Progress = {
    blank, safeRead, safeWrite, bestScore, isPassed, isUnlocked, completeLevel, reset,
    KEY, PASS_SCORE
  };
})(globalThis.GK = globalThis.GK || {});
