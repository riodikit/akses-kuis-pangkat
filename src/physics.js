(function (G) {
  'use strict';

  const GRAVITY = 1500;
  const MAX_FALL = 1000;
  const MOVE_SPEED = 280;
  const JUMP_V = -780;
  const COYOTE = 0.10;
  const BUFFER = 0.12;
  const DROP_TIME = 0.18;
  const INVULN = 1.4;

  // Tinggi lompat maks = v^2 / (2g). Level WAJIB didesain di bawah angka ini.
  // Nilai di bawah: ~202px ke atas, ~291px ke samping.
  const MAX_JUMP_H = (JUMP_V * JUMP_V) / (2 * GRAVITY);
  const AIRTIME = (2 * Math.abs(JUMP_V)) / GRAVITY;
  const MAX_JUMP_W = MOVE_SPEED * AIRTIME;

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function makeState(level) {
    return {
      t: 0,
      lives: 3,
      won: false,
      gameover: false,
      pendingLock: -1,
      hitFlash: 0,
      checkpoint: { x: level.spawn.x, y: level.spawn.y },
      player: {
        x: level.spawn.x, y: level.spawn.y, w: 52, h: 68,
        vx: 0, vy: 0, onGround: false, facing: 1,
        coyote: 0, buffer: 0, drop: 0, invuln: 0
      },
      locks: level.locks.map(function (l) {
        return { x: l.x, y: l.y, w: l.w, h: l.h, open: false };
      }),
      enemies: level.enemies.map(function (e) {
        return { x: e.x, y: e.y, w: e.w, h: e.h, minX: e.minX, maxX: e.maxX, dir: 1, alive: true };
      }),
      trophy: { x: level.trophy.x, y: level.trophy.y, w: level.trophy.w, h: level.trophy.h }
    };
  }

  function respawn(st) {
    const p = st.player;
    p.x = st.checkpoint.x;
    p.y = st.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.invuln = INVULN;
    p.onGround = false;
  }

  function setCheckpoint(st, x, y) {
    st.checkpoint = { x: x, y: y };
  }

  function loseLife(st) {
    st.lives -= 1;
    st.hitFlash = 0.25;
    if (st.lives <= 0) {
      st.lives = 0;
      st.gameover = true;
      return;
    }
    respawn(st);
  }

  function step(st, input, level, dt) {
    // Selama soal terbuka atau level selesai, dunia benar-benar berhenti.
    if (st.pendingLock >= 0 || st.won || st.gameover) return st;
    st.t += dt;
    const p = st.player;
    const plats = level.platforms;

    const ax = input.x || 0;
    if (Math.abs(ax) < 0.22) {
      p.vx = 0;
    } else {
      p.vx = ax * MOVE_SPEED;
      p.facing = ax > 0 ? 1 : -1;
    }

    // Jump buffer + coyote time: dua trik kecil yang membuat kontrol terasa enak
    // dan tidak "bandel" saat dimainkan di HP.
    if (input.jump) p.buffer = BUFFER;
    else p.buffer = Math.max(0, p.buffer - dt);

    p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
    p.drop = Math.max(0, p.drop - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    st.hitFlash = Math.max(0, st.hitFlash - dt);

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
    }

    // ▼ = turun menembus platform satu arah
    if (input.down && p.onGround) {
      p.drop = DROP_TIME;
      p.y += 2;
      p.onGround = false;
    }

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

    // Sumbu X dulu, lalu Y. Urutan ini mencegah pemain "nyangkut" di sudut.
    p.x += p.vx * dt;
    for (let i = 0; i < plats.length; i++) {
      const pl = plats[i];
      if (!pl.solid) continue;
      if (!overlaps(p, pl)) continue;
      if (p.vx > 0) p.x = pl.x - p.w;
      else if (p.vx < 0) p.x = pl.x + pl.w;
    }
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > level.width) p.x = level.width - p.w;

    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.onGround = false;
    for (let i = 0; i < plats.length; i++) {
      const pl = plats[i];
      if (!overlaps(p, pl)) continue;
      if (pl.solid) {
        if (p.vy > 0) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = pl.y + pl.h;
          p.vy = 0;
        }
      } else if (p.vy > 0 && prevBottom <= pl.y + 1 && p.drop <= 0) {
        // Platform satu arah: hanya menahan kalau pemain datang dari atas.
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }

    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (!e.alive) continue;
      e.x += e.dir * 70 * dt;
      if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
      if (e.x + e.w >= e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
      if (p.invuln <= 0 && overlaps(p, e)) loseLife(st);
    }

    if (p.y > level.height + 160) loseLife(st);

    for (let i = 0; i < st.locks.length; i++) {
      const l = st.locks[i];
      if (l.open) continue;
      if (overlaps(p, l)) {
        st.pendingLock = i;
        p.vx = 0;
        break;
      }
    }

    if (overlaps(p, st.trophy)) st.won = true;
    return st;
  }

  G.Physics = {
    makeState, step, respawn, loseLife, setCheckpoint, overlaps,
    MOVE_SPEED, JUMP_V, GRAVITY, MAX_JUMP_H, MAX_JUMP_W
  };
})(globalThis.GK = globalThis.GK || {});
