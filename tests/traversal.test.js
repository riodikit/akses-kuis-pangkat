const { test } = require('node:test');
const assert = require('node:assert');
require('../src/physics.js');
require('../src/levels.js');
const P = globalThis.GK.Physics;
const L = globalThis.GK.Levels;

// Bot traversal: mainkan level sampai piala dengan strategi "jalan ke kanan
// dan lompati musuh". Ini meniru pemain nyata. Kalau bot tidak sampai piala
// atau tidak menyentuh 10 gembok, levelnya tidak bisa diselesaikan / soalnya
// bisa dilewati -> test GAGAL.

function play(levelId, opts) {
  const o = opts || {};
  const lvl = L.getLevel(levelId);
  const st = P.makeState(lvl);
  const p = st.player;
  let guard = 0;
  let maxX = 0;
  const touched = new Set();

  while (!st.won && !st.gameover && guard < 60000) {
    guard++;

    let mustJump = false;
    for (const e of st.enemies) {
      if (!e.alive) continue;
      const dx = e.x - (p.x + p.w);
      if (dx > -10 && dx < 90 && Math.abs(e.y - p.y) < 70) mustJump = true;
    }

    const input = { x: 1, jump: mustJump && p.onGround, down: false };
    P.step(st, input, lvl, 1 / 60);
    if (p.x > maxX) maxX = p.x;

    if (st.pendingLock >= 0) {
      touched.add(st.pendingLock);
      st.locks[st.pendingLock].open = true;
      st.pendingLock = -1;
      p.invuln = 0.6;
    }
  }
  return { st, touched: touched.size, maxX, guard };
}

for (const lvl of [1, 2, 3]) {
  test('level ' + lvl + ': bot sampai ke piala (level bisa diselesaikan)', () => {
    const r = play(lvl);
    assert.ok(r.st.won, 'level ' + lvl + ' tidak sampai piala; maxX=' + r.maxX);
    assert.equal(r.st.gameover, false, 'level ' + lvl + ' bot mati');
  });

  test('level ' + lvl + ': bot menyentuh KESEPULUH gembok (tidak ada soal terlewat)', () => {
    const r = play(lvl);
    assert.equal(r.touched, 10,
      'level ' + lvl + ' hanya menyentuh ' + r.touched + ' gembok; ' +
      'pemain bisa MELOMPATI gembok sehingga soal terlewat');
  });
}

test('gembok tidak bisa dilompati: tinggi gembok menutup jalur lompat', () => {
  const lvl = L.getLevel(1);
  // Tinggi lompat maks ~202px. Gembok harus cukup tinggi dari tanah
  // supaya pemain yang melompat tetap menyentuhnya.
  const ground = lvl.platforms[0];
  for (const lk of lvl.locks) {
    const tinggiGembok = ground.y - lk.y;
    assert.ok(tinggiGembok >= 120,
      'gembok terlalu pendek (' + tinggiGembok + 'px) — pemain bisa melompatinya');
  }
});
