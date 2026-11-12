(function (G) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  //  ATURAN DESAIN — dijaga oleh tests/levels.test.js + tests/traversal.test.js
  //
  //  1. Semua 10 gembok berdiri di ATAS TANAH, berjarak tetap di jalur utama.
  //     Pemain yang jalan ke kanan PASTI melewati kesepuluhnya -> skor 100 mungkin.
  //
  //  2. Gembok TINGGI (200px), bukan 46px. Tinggi lompat maks pemain ~202px,
  //     jadi gembok pendek bisa DILOMPATI dan soalnya terlewat.
  //
  //  3. Platform dan musuh menempati CELAH YANG BERBEDA. Ini yang membuat level
  //     selalu bisa diselesaikan: kalau musuh berdiri di bawah platform, pemain
  //     yang melompat menghindari musuh akan menabrak platform lalu jatuh tepat
  //     ke musuh -> pendaratan mematikan, level mustahil.
  //
  //  4. Jumlah musuh NAIK antar level (4 -> 6 -> 7).
  // ══════════════════════════════════════════════════════════════════

  const W = 2800;
  const H = 900;
  const GROUND = H - 80;   // = 820
  const LOCK_GAP = 210;
  const LOCK_W = 58;
  const LOCK_H = 205;          // lihat aturan 2
  const ENEMY = 44;
  const PAD = 24;

  function lockLine(startX, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({ x: startX + i * LOCK_GAP, y: GROUND - LOCK_H, w: LOCK_W, h: LOCK_H });
    }
    return out;
  }

  // Batas horizontal celah antara gembok ke-i dan ke-(i+1).
  function gapBounds(locks, i, pad) {
    const p = pad === undefined ? PAD : pad;
    return { left: locks[i].x + LOCK_W + p, right: locks[i + 1].x - p };
  }

  // Musuh darat di TENGAH celah ke-i. Hanya dipakai di celah TANPA platform.
  function gapEnemy(locks, i, pad) {
    const b = gapBounds(locks, i, pad);
    const w = Math.max(16, Math.min(ENEMY, b.right - b.left));
    return { x: b.left, y: GROUND - ENEMY, w: ENEMY, h: ENEMY, minX: b.left, maxX: b.left + w };
  }

  // Platform satu arah di TENGAH celah ke-i. Hanya dipakai di celah TANPA musuh.
  function gapPlatform(locks, i, y, width) {
    const b = gapBounds(locks, i);
    const w = Math.min(width || 140, b.right - b.left);
    const cx = (b.left + b.right) / 2;
    return { x: Math.round(cx - w / 2), y: y, w: w, h: 22, solid: false };
  }

  function ground() {
    return { x: 0, y: GROUND, w: W, h: 80, solid: true };
  }

  // ── Level 1: Hutan Angka ──────────────────────────────────────────
  // Platform di celah 0,2,4,6,8. Musuh di celah 1,3,5,7 -> 4 musuh.
  const L1_LOCKS = lockLine(230, 10);
  const L1_PLATS = [
    ground(),
    gapPlatform(L1_LOCKS, 0, 700, 150),
    gapPlatform(L1_LOCKS, 2, 660, 150),
    gapPlatform(L1_LOCKS, 4, 700, 150),
    gapPlatform(L1_LOCKS, 6, 660, 150),
    gapPlatform(L1_LOCKS, 8, 700, 150)
  ];
  const L1 = {
    id: 1, name: 'Hutan Angka', width: W, height: H,
    spawn: { x: 60, y: GROUND - 56 },
    platforms: L1_PLATS,
    locks: L1_LOCKS,
    enemies: [
      gapEnemy(L1_LOCKS, 1),
      gapEnemy(L1_LOCKS, 3),
      gapEnemy(L1_LOCKS, 5),
      gapEnemy(L1_LOCKS, 7)
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  // ── Level 2: Goa Pangkat ──────────────────────────────────────────
  // Platform hanya di celah 0,4,8. Musuh di 1,2,3,5,6,7 -> 6 musuh.
  const L2_LOCKS = lockLine(220, 10);
  const L2_PLATS = [
    ground(),
    gapPlatform(L2_LOCKS, 0, 690, 150),
    gapPlatform(L2_LOCKS, 4, 660, 150),
    gapPlatform(L2_LOCKS, 8, 690, 150)
  ];
  const L2 = {
    id: 2, name: 'Goa Pangkat', width: W, height: H,
    spawn: { x: 60, y: GROUND - 56 },
    platforms: L2_PLATS,
    locks: L2_LOCKS,
    enemies: [
      gapEnemy(L2_LOCKS, 1),
      gapEnemy(L2_LOCKS, 3),
      gapEnemy(L2_LOCKS, 5),
      gapEnemy(L2_LOCKS, 7)
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  // ── Level 3: Menara Bintang ───────────────────────────────────────
  // Platform hanya di celah 0 dan 8. Musuh di 1..7 -> 7 musuh.
  const L3_LOCKS = lockLine(210, 10);
  const L3_PLATS = [
    ground(),
    gapPlatform(L3_LOCKS, 0, 680, 150),
    gapPlatform(L3_LOCKS, 8, 680, 150)
  ];
  const L3 = {
    id: 3, name: 'Menara Bintang', width: W, height: H,
    spawn: { x: 60, y: GROUND - 56 },
    platforms: L3_PLATS,
    locks: L3_LOCKS,
    enemies: [
      gapEnemy(L3_LOCKS, 1),
      gapEnemy(L3_LOCKS, 3),
      gapEnemy(L3_LOCKS, 5),
      gapEnemy(L3_LOCKS, 7)
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  const LEVELS = { 1: L1, 2: L2, 3: L3 };

  function getLevel(n) {
    const lv = LEVELS[n];
    if (!lv) throw new Error('level tidak dikenal: ' + n);
    return lv;
  }

  G.Levels = { getLevel, LEVELS, count: 3, LOCK_GAP, LOCK_W, LOCK_H, gapBounds };
})(globalThis.GK = globalThis.GK || {});
