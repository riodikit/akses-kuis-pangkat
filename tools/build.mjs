#!/usr/bin/env node
// Inline semua modul JS ke src/index.template.html -> dist/index.html
// Tanpa dependency. Jalankan: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

// PENTING: marker adalah TOKEN KOMENTAR UTUH (/*__X__*/), bukan isinya saja.
// Kalau hanya nama di dalamnya yang di-replace, kode tetap terbungkus komentar
// dan seluruh logika jadi komentar -> TypeError "reading 'Levels'".
// Urutan mengikuti urutan <script> di template: story.js butuh questions.js,
// game.js butuh semuanya.
const FILES = {
  // ASSETS paling awal: gambar harus siap sebelum game.js dipanggil.
  '/*__ASSETS__*/': 'src/assets.js',
  '/*__QUESTIONS__*/': 'src/questions.js',
  '/*__STORY__*/': 'src/story.js',
  '/*__QUIZ__*/': 'src/quiz.js',
  '/*__PHYSICS__*/': 'src/physics.js',
  '/*__LEVELS__*/': 'src/levels.js',
  '/*__MUSIC__*/': 'src/music.js',
  '/*__PROGRESS__*/': 'src/progress.js',
  '/*__GAME__*/': 'src/game.js'
};

let html = read('src/index.template.html');

for (const [marker, path] of Object.entries(FILES)) {
  const code = read(path);
  // Tag penutup di dalam string akan memotong blok <script> dan mematikan halaman.
  if (code.includes('</script')) throw new Error('</script di dalam ' + path);
  if (!html.includes(marker)) throw new Error('marker hilang: ' + marker);
  html = html.replace(marker, () => code);
}

const left = html.match(/\/\*__[A-Z]+__\*\//g);
if (left) throw new Error('marker tersisa: ' + left.join(','));

mkdirSync(resolve(root, 'dist'), { recursive: true });
const out = resolve(root, 'dist/index.html');
writeFileSync(out, html, 'utf8');
console.log('dist/index.html  ' + (statSync(out).size / 1024).toFixed(1) + ' KB');
