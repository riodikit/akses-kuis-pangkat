const { test } = require('node:test');
const assert = require('node:assert');
require('../src/physics.js');
require('../src/levels.js');
const P = globalThis.GK.Physics;
const L = globalThis.GK.Levels;

const DT = 1 / 60;

// Bot "pejalan": berjalan ke kanan di tanah, hanya lompat kalau benar-benar
// mentok. Tujuannya membuktikan GEOMETRI level bisa dilewati dan semua gembok
// tersentuh — bukan memainkan game dengan bagus. Enemy dimatikan supaya yang
// diuji murni geometri.
function walk(lvl, maxSeconds) {
  const st = P.makeState(lvl);
  st.enemies.forEach(e => { e.alive = false; });
  const opened = new Set();
  let lastX = -1, stuck = 0, jumpHeld = 0;
  const steps = Math.round((maxSeconds || 120) / DT);

  for (let i = 0; i < steps; i++) {
    const p = st.player;
    const input = { x: 1, jump: false, down: false };

    const blockingLock = st.locks.some(l => !l.open && p.x + p.w > l.x - 24 && p.x < l.x + l.w);
    if (p.onGround && stuck > 10 && jumpHeld <= 0 && !blockingLock) { input.jump = true; jumpHeld = 22; }
    if (jumpHeld > 0) jumpHeld--;

    P.step(st, input, lvl, DT);

    if (st.pendingLock >= 0) {
      opened.add(st.pendingLock);
      st.locks[st.pendingLock].open = true;
      st.pendingLock = -1;
      stuck = 0;
    }
    if (st.won) return { ok: true, opened, st, steps: i };
    if (Math.abs(p.x - lastX) < 0.4) stuck++; else stuck = 0;
    lastX = p.x;
  }
  return { ok: false, opened, st };
}

for (const n of [1, 2, 3]) {
  test('geometri level ' + n + ' bisa dilewati sampai piala', () => {
    const r = walk(L.getLevel(n));
    assert.ok(r.ok, 'level ' + n + ' macet di x=' + Math.round(r.st.player.x));
    assert.equal(r.opened.size, 10, 'gembok terlewati: ' + r.opened.size);
  });
}

test('setiap gembok berdiri tepat di atas tanah', () => {
  for (const n of [1, 2, 3]) {
    const lvl = L.getLevel(n);
    const ground = lvl.platforms.find(p => p.solid && p.x === 0 && p.w === lvl.width);
    assert.ok(ground, 'level ' + n + ' harus punya tanah penuh');
    for (const l of lvl.locks) {
      assert.equal(l.y + l.h, ground.y, 'level ' + n + ' gembok x=' + l.x + ' tidak di tanah');
    }
  }
});

test('gembok tidak tumpang tindih dan tidak menempel', () => {
  for (const n of [1, 2, 3]) {
    const locks = L.getLevel(n).locks.slice().sort((a, b) => a.x - b.x);
    for (let i = 1; i < locks.length; i++) {
      const gap = locks[i].x - (locks[i - 1].x + locks[i - 1].w);
      assert.ok(gap > 60, 'level ' + n + ' gembok terlalu rapat: ' + gap);
    }
  }
});

test('semua gembok di dalam batas peta dan layar', () => {
  for (const n of [1, 2, 3]) {
    const lvl = L.getLevel(n);
    for (const l of lvl.locks) {
      assert.ok(l.x >= 0 && l.x + l.w <= lvl.width, 'x gembok');
      assert.ok(l.y >= 0 && l.y + l.h <= lvl.height, 'y gembok');
    }
  }
});

test('piala di ujung kanan dan tidak menempel gembok terakhir', () => {
  for (const n of [1, 2, 3]) {
    const lvl = L.getLevel(n);
    assert.ok(lvl.trophy.x > lvl.width - 250, 'level ' + n);
    const last = lvl.locks.slice().sort((a, b) => a.x - b.x).pop();
    assert.ok(lvl.trophy.x > last.x + last.w + 40, 'piala level ' + n + ' terlalu dekat gembok');
  }
});

test('enemy tidak menutupi gembok (pemain tidak terjebak)', () => {
  for (const n of [1, 2, 3]) {
    const lvl = L.getLevel(n);
    for (const e of lvl.enemies) {
      for (const l of lvl.locks) {
        const sameLevel = Math.abs((e.y + e.h) - (l.y + l.h)) < 40;
        const overlapX = e.maxX > l.x + 2 && e.minX < l.x + l.w - 2;
        assert.ok(!(sameLevel && overlapX), 'level ' + n + ' enemy menutupi gembok x=' + l.x);
      }
    }
  }
});

test('semua platform lebih rendah dari batas lompat (bisa dijangkau)', () => {
  for (const n of [1, 2, 3]) {
    const lvl = L.getLevel(n);
    const ground = lvl.platforms.find(p => p.solid);
    for (const p of lvl.platforms) {
      if (p.solid) continue;
      const rise = ground.y - p.y;
      assert.ok(rise <= P.MAX_JUMP_H - 20, 'level ' + n + ' platform y=' + p.y + ' terlalu tinggi (' + rise + 'px)');
    }
  }
});

test('jumlah enemy tidak turun antar level', () => {
  const c = [1, 2, 3].map(n => L.getLevel(n).enemies.length);
  assert.ok(c[1] >= c[0] && c[2] >= c[1], c.join(','));
});
