(function (G) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  //  ATURAN DESAIN — dijaga oleh tests/levels.test.js + tests/traversal.test.js
  //
  //  1. Semua 10 gembok berdiri di ATAS TANAH, berjarak tetap di jalur utama.
  //     Pemain yang jalan ke kanan PASTI melewati kesepuluhnya -> skor 100 mungkin.
  //
  //  2. Gembok TINGGI (340px). Tinggi lompat maks pemain ~203px, jadi secara
  //     teori 205px sudah cukup. TAPI pemain bisa mendarat DI ATAS gembok
  //     lalu melompat lagi, sehingga 205px masih bisa dilewati (terbukti:
  //     hanya 7/10 gembok tersentuh). 340px menutup jalur itu sepenuhnya.
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
  const GROUND = H - 160;  // = 740, pita tanah 160px (tebal, bukan garis tipis)
  const LOCK_GAP = 210;
  const LOCK_W = 78;
  const LOCK_H = 340;          // lihat aturan 2
  const ENEMY = 44;
  const PAD = 24;

  // groundY WAJIB diberikan: level 3 punya tanah lebih rendah (menara),
  // jadi memakai GROUND global membuat gerbangnya melayang di udara.
  function lockLine(startX, count, groundY) {
    const gy = groundY === undefined ? GROUND : groundY;
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({ x: startX + i * LOCK_GAP, y: gy - LOCK_H, w: LOCK_W, h: LOCK_H });
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
    return { x: 0, y: GROUND, w: W, h: H - GROUND, solid: true };
  }

  // ── Level 1: Hutan Angka ──────────────────────────────────────────
  // Platform di celah 0,2,4,6,8. Musuh di celah 1,3,5,7 -> 4 musuh.
  const L1_LOCKS = lockLine(230, 10);
  const L1_PLATS = [
    ground(),
    gapPlatform(L1_LOCKS, 0, 600, 150),
    gapPlatform(L1_LOCKS, 2, 565, 150),
    gapPlatform(L1_LOCKS, 4, 600, 150),
    gapPlatform(L1_LOCKS, 6, 565, 150),
    gapPlatform(L1_LOCKS, 8, 600, 150)
  ];
  const L1 = {
    id: 1, name: 'Hutan Angka', width: W, height: H,
    spawn: { x: 60, y: GROUND - 72 },
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
    gapPlatform(L2_LOCKS, 0, 595, 150),
    gapPlatform(L2_LOCKS, 4, 562, 150),
    gapPlatform(L2_LOCKS, 8, 595, 150)
  ];
  const L2 = {
    id: 2, name: 'Goa Pangkat', width: W, height: H,
    spawn: { x: 60, y: GROUND - 72 },
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
  // Level ini MEMAKAI RUANG VERTIKAL dengan cara yang PASTI bekerja:
  // tanahnya sendiri menanjak seperti tangga raksasa. Pemain tidak perlu
  // tahu cara memanjat platform one-way — dia cuma berjalan ke kanan, dan
  // tanahnya naik. Di puncak ada piala.
  //
  // Platform one-way TIDAK dipakai untuk tangga karena tidak menahan dari
  // samping: pemain bisa berjalan di bawahnya dan tidak pernah "mentok".
  // Itu ditemukan lewat pengujian nyata, bukan teori.
  const W3 = 3000;
  const H3 = 1240;
  const G3 = H3 - 160;                        // tanah dasar = 1080
  const RISE = 90;                            // naik per anak tangga tanah
  const STEPS = 5;
  const TOP3 = G3 - RISE * STEPS;             // puncak = 630

  const L3_LOCKS = lockLine(210, 10, G3);

  // Tanah bertingkat: 5 anak tangga, masing-masing lebar 200px.
  function stairs3() {
    const out = [];
    // Bagian datar tempat 10 gerbang (x 0..2200)
    out.push({ x: 0, y: G3, w: 2200, h: H3 - G3, solid: true });
    for (let i = 1; i <= STEPS; i++) {
      const x = 2200 + (i - 1) * 200;
      const y = G3 - RISE * i;
      out.push({ x: x, y: y, w: 200, h: H3 - y, solid: true });
    }
    return out;
  }

  const L3 = {
    id: 3, name: 'Menara Bintang', width: W3, height: H3,
    spawn: { x: 60, y: G3 - 72 },
    platforms: [
      ...stairs3(),
      // Hiasan: papan kayu kecil di celah antar gerbang (bukan jalur wajib).
      gapPlatform(L3_LOCKS, 0, G3 - 150, 150),
      gapPlatform(L3_LOCKS, 8, G3 - 150, 150)
    ],
    locks: L3_LOCKS,
    enemies: [
      gapEnemy(L3_LOCKS, 1),
      gapEnemy(L3_LOCKS, 3),
      gapEnemy(L3_LOCKS, 5),
      gapEnemy(L3_LOCKS, 7)
    ],
    // Piala di puncak tangga tanah.
    trophy: { x: 2820, y: TOP3 - 56, w: 56, h: 56 }
  };

  const LEVELS = { 1: L1, 2: L2, 3: L3 };

  function getLevel(n) {
    const lv = LEVELS[n];
    if (!lv) throw new Error('level tidak dikenal: ' + n);
    return lv;
  }

  G.Levels = { getLevel, LEVELS, count: 3, LOCK_GAP, LOCK_W, LOCK_H, gapBounds };
})(globalThis.GK = globalThis.GK || {});
