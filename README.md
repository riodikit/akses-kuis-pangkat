# Akses — Aplikasi Kuis Edukasi

Game platformer 2D + kuis **bilangan berpangkat kelas 8**. Satu file, tanpa
internet, tanpa instalasi.

## Cara main

1. Buka `dist/index.html` dengan double-click (Chrome/Edge/Firefox).
2. Tekan **PLAY** di beranda.
3. Jalan ke kanan. Setiap kali menyentuh **gerbang terkunci**, muncul soal
   pilihan ganda dan permainan berhenti sebentar.
4. Jawab 10 soal, lalu sentuh **piala** di ujung kanan untuk melihat hasil.

**Kontrol:** `←` `→` jalan · `↑` / `Spasi` lompat · `↓` turun dari platform.
Di HP: tombol ◀ ▶ ▲ ▼ dan JUMP di bawah layar.

## Aturan

| Hal | Nilai |
|---|---|
| Soal per level | 10 pilihan ganda (2 opsi) |
| Skor per soal | 10 (maksimal 100) |
| Nyawa | 3 per level |
| Lulus | skor **≥ 60** |
| Level | 3, terbuka bertahap (harus lulus level sebelumnya) |

Jawaban **benar berwarna hijau**, **salah berwarna merah** — dan jawaban yang
benar selalu ditunjukkan hijau walau pemain salah, supaya bisa belajar.

Jawaban salah tetap membuka gerbang (skor 0). Ini disengaja: kalau tidak,
pemain bisa terjebak dan tidak bisa menyelesaikan level.

## Soal

Soal dibuat otomatis (deterministik per seed), jadi tidak pernah sama persis
antar percobaan. Kesulitan naik per level:

- **Level 1 — Hutan Angka:** perkalian & pembagian pangkat
- **Level 2 — Goa Pangkat:** tambah pangkat nol & pangkat negatif
- **Level 3 — Menara Bintang:** pangkat dari pangkat & campuran.
  Setelah 10 gerbang, tanahnya menanjak 5 tingkat menuju piala di puncak —
  level ini benar-benar mendaki, bukan cuma jalan ke kanan.

Tiap level punya **3 soal cerita** (dari 10) dengan konteks nyata — bukan
sekadar "hitung 2³ × 2²", tapi misalnya *"Sari di gudang olahraga menemukan
2³ kotak pensil. Setiap kotak berisi 2² pensil. Berapa jumlah pensil
seluruhnya?"*

## Untuk pengembang

```bash
node --test          # 79 test
node tools/build.mjs # src/ -> dist/index.html
```

Arsitektur: modul logika murni (`src/*.js`) yang bisa dites dengan Node, lalu
ditempel jadi satu file oleh `tools/build.mjs`. Tidak ada dependency, tidak
ada framework.

| File | Isi |
|---|---|
| `src/questions.js` | generator soal (seeded) |
| `src/story.js` | builder soal cerita |
| `src/quiz.js` | state sesi kuis & skor |
| `src/physics.js` | fisika platformer |
| `src/levels.js` | data 3 level |
| `src/progress.js` | progres & unlock (localStorage) |
| `src/game.js` | render canvas + UI |
| `src/index.template.html` | kerangka + CSS |

### Aturan desain yang dijaga test

Jangan ubah angka-angka ini tanpa menjalankan `node --test`:

1. **Gembok harus 340px tinggi.** Tinggi lompat pemain ~203px, tapi pemain
   bisa mendarat di atas gembok lalu melompat lagi. Di 205px hanya 7 dari 10
   gembok tersentuh (soal terlewat). 340px menutup jalur itu.
2. **Platform dan musuh tidak boleh di celah yang sama.** Musuh di bawah
   platform membuat pemain yang melompat menabrak platform lalu jatuh ke
   musuh — level jadi mustahil.
3. **Semua platform harus terjangkau** (≤183px di atas tanah).
4. **Semua gembok menempel permukaan tanah di bawahnya** dan berjarak
   ≥60px satu sama lain.
5. **Tangga level 3 memakai TANAH BERTINGKAT, bukan platform one-way.**
   Platform `solid:false` tidak menahan dari samping, jadi pemain bisa
   berjalan di bawahnya dan tidak pernah "mentok" — level jadi mustahil.
   Tanah bertingkat menghalangi dari samping, jadi pemain wajib mendaki.

`tests/traversal.test.js` memainkan ketiga level otomatis sampai piala,
termasuk skenario pemain yang melompat terus-menerus.
