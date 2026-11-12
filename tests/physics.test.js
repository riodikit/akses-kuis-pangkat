const { test } = require('node:test');
const assert = require('node:assert');
require('../src/physics.js');
const P = globalThis.GK.Physics;

const FLAT = {
  width: 1000, height: 600,
  spawn: { x: 50, y: 400 },
  platforms: [{ x: 0, y: 500, w: 1000, h: 100, solid: true }],
  locks: [], enemies: [],
  trophy: { x: 900, y: 400, w: 40, h: 40 }
};

const NO_INPUT = { x: 0, jump: false, down: false };

function sim(st, lvl, seconds, input) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) P.step(st, input || NO_INPUT, lvl, 1 / 60);
  return st;
}

test('pemain jatuh lalu mendarat di platform solid', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 1.5);
  assert.equal(st.player.onGround, true);
  assert.equal(Math.round(st.player.y + st.player.h), 500);
});

test('pemain tidak menembus platform saat jatuh cepat', () => {
  const st = P.makeState(FLAT);
  st.player.y = 100;
  st.player.vy = 900;
  sim(st, FLAT, 2);
  assert.equal(st.player.onGround, true);
  assert.ok(st.player.y + st.player.h <= 500.5);
});

test('input kanan menggerakkan pemain ke kanan', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 1.0);
  const x0 = st.player.x;
  sim(st, FLAT, 0.5, { x: 1, jump: false, down: false });
  assert.ok(st.player.x > x0 + 50, 'x harus bertambah');
});

test('pemain tidak bisa keluar dari batas level', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 3, { x: 1, jump: false, down: false });
  assert.ok(st.player.x + st.player.w <= FLAT.width);
});

test('lompat memberi kecepatan vertikal negatif', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 1.5);
  assert.equal(st.player.onGround, true);
  P.step(st, { x: 0, jump: true, down: false }, FLAT, 1 / 60);
  assert.ok(st.player.vy < 0, 'vy harus negatif saat lompat');
});

test('tidak bisa lompat dua kali di udara', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 1.5);
  P.step(st, { x: 0, jump: true, down: false }, FLAT, 1 / 60);
  sim(st, FLAT, 0.1);
  const vyBefore = st.player.vy;
  P.step(st, { x: 0, jump: true, down: false }, FLAT, 1 / 60);
  assert.ok(st.player.vy >= vyBefore, 'lompat kedua tidak boleh menambah dorongan');
});

test('menyentuh gembok menandai pendingLock, waktu berhenti', () => {
  const lvl = Object.assign({}, FLAT, { locks: [{ x: 200, y: 460, w: 40, h: 40 }] });
  const st = P.makeState(lvl);
  sim(st, lvl, 1.5);
  st.player.x = 205;
  P.step(st, NO_INPUT, lvl, 1 / 60);
  assert.equal(st.pendingLock, 0);
  const t0 = st.t;
  sim(st, lvl, 0.5, { x: 1, jump: false, down: false });
  assert.equal(st.t, t0, 'waktu harus berhenti selama soal terbuka');
});

test('enemy mengurangi nyawa dan memindahkan pemain ke checkpoint', () => {
  const lvl = Object.assign({}, FLAT, {
    enemies: [{ x: 200, y: 460, w: 30, h: 30, minX: 200, maxX: 260 }]
  });
  const st = P.makeState(lvl);
  sim(st, lvl, 1.5);
  st.player.x = 205;
  P.step(st, NO_INPUT, lvl, 1 / 60);
  assert.equal(st.lives, 2);
  assert.equal(st.player.x, lvl.spawn.x);
  assert.ok(st.player.invuln > 0);
});

test('tiga kali kena enemy = gameover', () => {
  const lvl = Object.assign({}, FLAT, {
    enemies: [{ x: 200, y: 460, w: 30, h: 30, minX: 200, maxX: 260 }]
  });
  const st = P.makeState(lvl);
  for (let i = 0; i < 3; i++) {
    st.player.invuln = 0;
    st.player.x = 205;
    st.player.y = 460;
    P.step(st, NO_INPUT, lvl, 1 / 60);
  }
  assert.equal(st.lives, 0);
  assert.equal(st.gameover, true);
});

test('jatuh ke jurang mengurangi nyawa', () => {
  const st = P.makeState(FLAT);
  st.player.y = FLAT.height + 400;
  P.step(st, NO_INPUT, FLAT, 1 / 60);
  assert.equal(st.lives, 2);
});

test('menyentuh piala menandai menang', () => {
  const st = P.makeState(FLAT);
  sim(st, FLAT, 1.5);
  st.player.x = 905;
  st.player.y = 430;
  P.step(st, NO_INPUT, FLAT, 1 / 60);
  assert.equal(st.won, true);
});
