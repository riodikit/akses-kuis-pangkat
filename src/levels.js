(function (G) {
  'use strict';

  // ATURAN DESAIN (dijaga oleh tests/levels.test.js):
  // 1. Semua 10 gembok berdiri di ATAS TANAH, berjarak tetap di jalur utama.
  //    Pemain yang jalan ke kanan PASTI melewati kesepuluhnya -> skor 100 mungkin.
  // 2. Enemy hanya diletakkan di CELAH ANTAR GEMBOK (dihitung otomatis), supaya
  //    pemain tidak pernah terjebak antara gembok dan enemy.
  // 3. Platform hanya variasi gerak, tidak menyimpan gembok wajib.
  const W = 2800;
  const H = 900;
  const GROUND = H - 80;
  const LOCK_GAP = 240;
  const LOCK_W = 40;
  const ENEMY = 30;

  function lockLine(startX, count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push({ x: startX + i * LOCK_GAP, y: GROUND - 46, w: LOCK_W, h: 46 });
    return out;
  }

  // Enemy darat di celah antara gembok ke-i dan ke-(i+1).
  function gapEnemy(locks, i, pad) {
    const p = pad || 24;
    const left = locks[i].x + LOCK_W + p;
    const right = locks[i + 1].x - p;
    // Kalau celah terlalu sempit untuk patroli, perkecil lebar patrolinya.
    const w = Math.min(ENEMY, Math.max(16, right - left));
    return { x: left, y: GROUND - ENEMY, w: ENEMY, h: ENEMY, minX: left, maxX: left + w };
  }

  // Enemy di atas platform: patroli di dalam lebar platform.
  function platformEnemy(pl) {
    const left = pl.x + 10;
    const right = pl.x + pl.w - 10;
    return { x: left, y: pl.y - ENEMY, w: ENEMY, h: ENEMY, minX: left, maxX: right };
  }

  const L1_LOCKS = lockLine(300, 10);
  const L1_PLATS = [
    { x: 0, y: GROUND, w: W, h: 80, solid: true },
    { x: 560, y: 720, w: 200, h: 22, solid: false },
    { x: 900, y: 640, w: 200, h: 22, solid: false },
    { x: 1280, y: 720, w: 200, h: 22, solid: false },
    { x: 1660, y: 640, w: 200, h: 22, solid: false },
    { x: 2040, y: 720, w: 220, h: 22, solid: false }
  ];

  const L1 = {
    id: 1, name: 'Hutan Angka', width: W, height: H,
    spawn: { x: 60, y: GROUND - 40 },
    platforms: L1_PLATS,
    locks: L1_LOCKS,
    enemies: [
      gapEnemy(L1_LOCKS, 1),
      gapEnemy(L1_LOCKS, 4),
      gapEnemy(L1_LOCKS, 7),
      platformEnemy(L1_PLATS[2])
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  const L2_LOCKS = lockLine(280, 10);
  const L2_PLATS = [
    { x: 0, y: GROUND, w: W, h: 80, solid: true },
    { x: 520, y: 720, w: 180, h: 22, solid: false },
    { x: 820, y: 660, w: 180, h: 22, solid: false },
    { x: 1120, y: 720, w: 180, h: 22, solid: false },
    { x: 1420, y: 660, w: 180, h: 22, solid: false },
    { x: 1720, y: 720, w: 180, h: 22, solid: false },
    { x: 2020, y: 660, w: 200, h: 22, solid: false }
  ];

  const L2 = {
    id: 2, name: 'Goa Pangkat', width: W, height: H,
    spawn: { x: 60, y: GROUND - 40 },
    platforms: L2_PLATS,
    locks: L2_LOCKS,
    enemies: [
      gapEnemy(L2_LOCKS, 0, 20),
      gapEnemy(L2_LOCKS, 2, 20),
      gapEnemy(L2_LOCKS, 5, 20),
      gapEnemy(L2_LOCKS, 8, 20),
      platformEnemy(L2_PLATS[2]),
      platformEnemy(L2_PLATS[4])
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  const L3_LOCKS = lockLine(260, 10);
  const L3_PLATS = [
    { x: 0, y: GROUND, w: W, h: 80, solid: true },
    { x: 480, y: 730, w: 150, h: 22, solid: false },
    { x: 720, y: 660, w: 150, h: 22, solid: false },
    { x: 960, y: 730, w: 150, h: 22, solid: false },
    { x: 1200, y: 660, w: 150, h: 22, solid: false },
    { x: 1440, y: 730, w: 150, h: 22, solid: false },
    { x: 1680, y: 660, w: 150, h: 22, solid: false },
    { x: 1920, y: 730, w: 150, h: 22, solid: false },
    { x: 2160, y: 660, w: 150, h: 22, solid: false }
  ];

  const L3 = {
    id: 3, name: 'Menara Bintang', width: W, height: H,
    spawn: { x: 60, y: GROUND - 40 },
    platforms: L3_PLATS,
    locks: L3_LOCKS,
    enemies: [
      gapEnemy(L3_LOCKS, 0, 26),
      gapEnemy(L3_LOCKS, 2, 26),
      gapEnemy(L3_LOCKS, 4, 26),
      gapEnemy(L3_LOCKS, 6, 26),
      gapEnemy(L3_LOCKS, 8, 26),
      platformEnemy(L3_PLATS[2]),
      platformEnemy(L3_PLATS[5])
    ],
    trophy: { x: 2660, y: GROUND - 56, w: 56, h: 56 }
  };

  const LEVELS = { 1: L1, 2: L2, 3: L3 };

  function getLevel(n) {
    const lv = LEVELS[n];
    if (!lv) throw new Error('level tidak dikenal: ' + n);
    return lv;
  }

  G.Levels = { getLevel, LEVELS, count: 3, LOCK_GAP, LOCK_W };
})(globalThis.GK = globalThis.GK || {});
