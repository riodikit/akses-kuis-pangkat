const { test } = require('node:test');
const assert = require('node:assert');
require('../src/physics.js');
require('../src/levels.js');
const P = globalThis.GK.Physics;
const L = globalThis.GK.Levels;

// Menguji ALUR, bukan geometri: satu gembok harus menghasilkan TEPAT satu soal,
// lalu pemain kembali bermain sebelum soal berikutnya muncul.
//
// Ini menangkap bug nyata: dulu setelah menjawab, game langsung menampilkan
// soal berikutnya di tempat, sehingga 10 soal muncul beruntun tanpa pemain
// pernah jalan lagi.

function runFlow(levelId) {
  const lvl = L.getLevel(levelId);
  const st = P.makeState(lvl);
  st.enemies.forEach(e => { e.alive = false; });

  const events = [];      // 'quiz' tiap kali gembok tersentuh, 'walk' antar soal
  let walkedBetween = 0;
  let lastQuizX = null;
  let guard = 0;
  let stuck = 0, prevX = -1, jumpHeld = 0;

  while (!st.won && !st.gameover && guard < 90000) {
    guard++;
    const p = st.player;

    // Level 3 punya tanah bertingkat: pemain harus melompat untuk naik.
    // jumpHeld memberi jeda supaya benar-benar mendarat, bukan melompat
    // berulang di tempat.
    const needClimb = p.onGround && stuck > 6 && jumpHeld <= 0;
    if (needClimb) jumpHeld = 26;
    if (jumpHeld > 0) jumpHeld--;

    P.step(st, { x: needClimb ? 0 : 1, jump: needClimb, down: false }, lvl, 1 / 60);

    if (Math.abs(p.x - prevX) < 0.5) stuck++; else stuck = 0;
    prevX = p.x;

    if (st.pendingLock >= 0) {
      events.push('quiz');
      if (lastQuizX !== null) {
        // Harus ada jarak yang ditempuh antar dua soal -> pemain memang
        // kembali bermain, bukan langsung dapat soal berikutnya.
        assert.ok(walkedBetween > 100,
          'level ' + levelId + ': soal muncul tanpa pemain berjalan dulu ' +
          '(hanya ' + Math.round(walkedBetween) + 'px)');
      }
      lastQuizX = p.x;
      walkedBetween = 0;   // jarak (px), bukan jumlah frame

      st.locks[st.pendingLock].open = true;
      st.pendingLock = -1;
      p.invuln = 0.9;
    } else if (lastQuizX !== null) {
      // Ukur JARAK tempuh, bukan jumlah frame: pemain bergerak ~4.6px/frame,
      // jadi menghitung frame membuat angkanya menyesatkan.
      walkedBetween = p.x - lastQuizX;
    }
  }

  return { events, won: st.won, walkedBetween };
}

for (const lvl of [1, 2, 3]) {
  test('level ' + lvl + ': tiap gembok menghasilkan tepat SATU soal', () => {
    const r = runFlow(lvl);
    assert.equal(r.events.length, 10, 'level ' + lvl + ' -> ' + r.events.length + ' soal');
  });

  test('level ' + lvl + ': pemain berjalan lagi di antara dua soal', () => {
    // Diuji di dalam runFlow lewat assertion jarak; test ini memastikan
    // levelnya benar-benar selesai sesudahnya.
    const r = runFlow(lvl);
    assert.ok(r.won, 'level ' + lvl + ' tidak selesai');
  });
}
