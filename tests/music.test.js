const { test } = require('node:test');
const assert = require('node:assert');

// Menguji LOGIKA musik tanpa Web Audio sungguhan (headless tidak punya
// audio device, jadi AudioContext selalu suspended di sana).
//
// Yang diuji:
//   1. Pola melodi & bass panjangnya sama -> tidak ada nada yang "hilang".
//   2. Semua nama nada ada di tabel frekuensi -> tidak ada nada diam-diam.
//   3. Melodi tidak seluruhnya istirahat (kalau iya, musiknya sunyi).
//   4. Tempo menghasilkan durasi langkah yang wajar.

const fs = require('node:fs');
const src = fs.readFileSync(__dirname + '/../src/music.js', 'utf8');

// Ambil isi array dari source tanpa menjalankan Web Audio.
function grab(name) {
  const re = new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];');
  const m = src.match(re);
  assert.ok(m, name + ' tidak ditemukan di src/music.js');
  return m[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
}

test('panjang melodi sama dengan panjang bass', () => {
  const mel = grab('MELODY');
  const bass = grab('BASS');
  assert.equal(mel.length, 32, 'melodi harus 32 langkah, dapat ' + mel.length);
  assert.equal(bass.length, 32, 'bass harus 32 langkah, dapat ' + bass.length);
  assert.equal(mel.length, bass.length);
});

test('semua nama nada ada di tabel frekuensi', () => {
  const names = new Set(grab('MELODY').concat(grab('BASS')));
  const table = src.slice(src.indexOf('var N = {'), src.indexOf('};', src.indexOf('var N = {')));
  for (const n of names) {
    if (n === '-') continue;   // istirahat, sah
    assert.ok(table.includes(n + ':'), 'nada ' + n + ' tidak ada di tabel frekuensi');
  }
});

test('melodi tidak sunyi: minimal 20 dari 32 langkah berbunyi', () => {
  const mel = grab('MELODY');
  const bunyi = mel.filter(n => n !== '-').length;
  assert.ok(bunyi >= 20, 'hanya ' + bunyi + '/32 langkah berbunyi — musik terlalu sunyi');
});

test('bass tidak sunyi: minimal 8 langkah berbunyi', () => {
  const bass = grab('BASS');
  const bunyi = bass.filter(n => n !== '-').length;
  assert.ok(bunyi >= 8, 'bass hanya ' + bunyi + ' nada');
});

test('tempo menghasilkan durasi langkah yang wajar (0.1-0.4 detik)', () => {
  const m = src.match(/var TEMPO = (\d+);/);
  assert.ok(m, 'TEMPO tidak ditemukan');
  const tempo = Number(m[1]);
  const stepDur = 60 / tempo / 2;
  assert.ok(stepDur > 0.1 && stepDur < 0.4,
    'durasi langkah ' + stepDur.toFixed(3) + 's di luar rentang wajar');
});

test('volume master tidak memekakkan telinga (<= 0.25)', () => {
  const m = src.match(/master\.gain\.value = ([\d.]+);/);
  assert.ok(m, 'volume master tidak ditemukan');
  assert.ok(Number(m[1]) <= 0.25, 'volume ' + m[1] + ' terlalu keras untuk musik latar');
});
