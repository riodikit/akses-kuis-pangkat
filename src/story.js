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

  // ── Tokoh cerita. Konteks nyata (bukan abstrak) supaya anak membayangkan.
  const NAMA = ['Rina', 'Bagus', 'Sari', 'Dimas', 'Ayu', 'Fajar', 'Nadia', 'Yoga'];
  // Tempat dipilih PER JENIS SOAL supaya tidak janggal
  // ("bakteri di perpustakaan" itu salah, "bakteri di laboratorium" benar).
  const TEMPAT_BENDA = [
    'perpustakaan', 'kantin sekolah', 'toko buku', 'gudang olahraga',
    'ruang kelas', 'warung dekat sekolah', 'aula'
  ];
  const TEMPAT_SAINS = ['laboratorium', 'ruang UKS', 'kelas biologi'];
  const TEMPAT_SALIN = ['ruang guru', 'percetakan sekolah', 'ruang komputer'];
  const BENDA = [
    ['kotak pensil', 'pensil'],
    ['rak', 'buku'],
    ['kardus', 'bola'],
    ['toples', 'kelereng'],
    ['keranjang', 'apel']
  ];

  // ── Setiap builder mengembalikan {story, prompt, right, wrong, explain}
  //    dan WAJIB memakai bentuk pangkat yang sama seperti soal biasa,
  //    supaya jawabannya bisa dihitung ulang dan diverifikasi test.

  // Level 1: perkalian pangkat. "a^n wadah, tiap wadah a^m isi."
  function storyMul(r, tier) {
    const nama = pick(r, NAMA), tempat = pick(r, TEMPAT_BENDA);
    const benda = pick(r, BENDA);
    const a = pick(r, [2, 3, 4, 5]);
    const m = ri(r, 2, 2 + tier), n = ri(r, 2, 2 + tier);
    const right = m + n;
    let wrong = m * n;
    if (wrong === right) wrong = right + 1;
    return {
      story: nama + ' di ' + tempat + ' menemukan ' + a + sup(n) + ' ' + benda[0] +
             '. Setiap ' + benda[0] + ' berisi ' + a + sup(m) + ' ' + benda[1] + '.',
      prompt: 'Berapa jumlah ' + benda[1] + ' seluruhnya?',
      right: a + sup(right), wrong: a + sup(wrong),
      explain: 'Jumlah ' + benda[0] + ' &times; isi tiap ' + benda[0] + ' = ' + a + sup(m) +
               ' &times; ' + a + sup(n) + '. Basis sama dikali &rarr; pangkat DIJUMLAHKAN: ' +
               m + ' + ' + n + ' = ' + right + ', jadi ' + a + sup(right) + '.'
    };
  }

  // Level 1: pembagian pangkat.
  function storyDiv(r, tier) {
    const nama = pick(r, NAMA), tempat = pick(r, TEMPAT_BENDA);
    const benda = pick(r, BENDA);
    const a = pick(r, [2, 3, 4, 5]);
    const n = ri(r, 2, 2 + tier), m = n + ri(r, 1, 2 + tier);
    const right = m - n;
    return {
      story: nama + ' membawa ' + a + sup(m) + ' ' + benda[1] + ' ke ' + tempat +
             '. Semua dibagi rata kepada ' + a + sup(n) + ' anak.',
      prompt: 'Berapa ' + benda[1] + ' yang diterima setiap anak?',
      right: a + sup(right), wrong: a + sup(m + n),
      explain: a + sup(m) + ' &divide; ' + a + sup(n) + '. Basis sama dibagi &rarr; pangkat ' +
               'DIKURANGKAN: ' + m + ' &minus; ' + n + ' = ' + right + ', jadi ' + a + sup(right) + '.'
    };
  }

  // Level 2: pangkat negatif, konteks ukuran (harus di lab/UKS, bukan perpustakaan).
  function storyNeg(r, tier) {
    const nama = pick(r, NAMA), tempat = pick(r, TEMPAT_SAINS);
    const a = pick(r, [2, 3, 4]);
    const n = ri(r, 1, 1 + tier);
    return {
      story: nama + ' mengukur satu bakteri di ' + tempat + '. Panjangnya ' + a + sup('-' + n) + ' milimeter.',
      prompt: 'Bentuk pecahan dari ' + a + sup('-' + n) + ' adalah &hellip;',
      right: '1/' + a + sup(n), wrong: '-' + a + sup(n),
      explain: 'Pangkat negatif berarti kebalikan: ' + a + sup('-' + n) + ' = 1/' + a + sup(n) +
               '. Jadi ukurannya 1/' + a + sup(n) + ' mm, bukan bilangan negatif.'
    };
  }

  // Level 2: pangkat nol.
  // Metafora lipat kertas: 0 lipatan = 1 lembar utuh. Ini satu-satunya
  // konteks nyata di mana a^0 = 1 bisa DITURUNKAN dari cerita, bukan dihafal.
  // Versi lama ("a^0 toples berisi kelereng, berapa isi satu toples?") tidak
  // koheren — jawaban 1 tidak bisa disimpulkan dari kalimat itu.
  function storyZero(r, tier) {
    const nama = pick(r, NAMA);
    const a = ri(r, 2, 9);
    // Distraktor: a (lupa bahwa pangkat 0 = 1). JANGAN pakai 0 — terlalu
    // gampang ditebak dan tidak mencerminkan kesalahan siswa.
    let wrong = a;
    if (wrong === 1) wrong = a + 1;
    return {
      story: nama + ' melipat kertas. Tiap 1 kali lipat, jumlah bagian dikali ' + a + ': ' +
             a + sup(1) + ', ' + a + sup(2) + ', dan seterusnya. Kertas yang TIDAK dilipat ' +
             'sama sekali = ' + a + sup(0) + ' bagian.',
      prompt: 'Jadi ' + a + sup(0) + ' = &hellip;',
      right: '1', wrong: String(wrong),
      explain: 'Kertas yang tidak dilipat tetap 1 lembar utuh. Pola pangkat turun ' +
               a + sup(2) + ' &rarr; ' + a + sup(1) + ' &rarr; ' + a + sup(0) + ' dibagi ' + a +
               ' tiap langkah, jadi ' + a + sup(0) + ' = 1, bukan ' + a + '.'
    };
  }

  // Level 3: pangkat dari pangkat, konteks penyalinan berulang.
  function storyPow(r, tier) {
    const nama = pick(r, NAMA), tempat = pick(r, TEMPAT_SALIN);
    const a = pick(r, [2, 3]), m = ri(r, 2, 2 + Math.min(tier, 3)), n = ri(r, 2, 2 + Math.min(tier, 2));
    const right = m * n;
    let wrong = m + n;
    if (wrong === right) wrong = right + 2;
    return {
      story: nama + ' membuat ' + a + sup(m) + ' lembar salinan di ' + tempat + '. Setiap lembar ' +
             'disalin lagi menjadi ' + a + sup(n) + ' bagian. Seluruh salinan dikumpulkan.',
      prompt: 'Banyak salinan seluruhnya = (' + a + sup(m) + ')' + sup(n) + ' = &hellip;',
      right: a + sup(right), wrong: a + sup(wrong),
      explain: 'Pangkat dari pangkat &rarr; pangkat DIKALIKAN: ' + m + ' &times; ' + n + ' = ' +
               right + ', jadi ' + a + sup(right) + '.'
    };
  }

  // Level 3: campuran tambah-bagi dalam konteks produksi.
  function storyMix(r, tier) {
    const nama = pick(r, NAMA), tempat = pick(r, TEMPAT_BENDA);
    const benda = pick(r, BENDA);
    const a = pick(r, [2, 3]), m = ri(r, 3, 4 + tier), n = ri(r, 2, 3), k = ri(r, 1, 2);
    const right = m + n - k;
    return {
      story: nama + ' menyiapkan ' + a + sup(m) + ' ' + benda[1] + ' di ' + tempat +
             ', lalu menambah ' + a + sup(n) + ' ' + benda[1] + ' lagi. Semuanya dibagi rata ' +
             'ke dalam ' + a + sup(k) + ' kardus.',
      prompt: 'Berapa ' + benda[1] + ' isi tiap kardus?',
      right: a + sup(right), wrong: a + sup(m + n + k),
      explain: 'Jumlahkan dulu yang ditambah: ' + m + ' + ' + n + ' = ' + (m + n) +
               ', lalu kurangi pembagi: ' + (m + n) + ' &minus; ' + k + ' = ' + right +
               ', jadi ' + a + sup(right) + ' per kardus.'
    };
  }

  const STORY = {
    mul: storyMul, div: storyDiv, neg: storyNeg, zero: storyZero,
    pow: storyPow, mix: storyMix
  };

  G.Story = { STORY, NAMA, TEMPAT_BENDA, TEMPAT_SAINS, TEMPAT_SALIN };
})(globalThis.GK = globalThis.GK || {});
