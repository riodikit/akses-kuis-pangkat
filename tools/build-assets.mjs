#!/usr/bin/env node
// Menanam gambar di assets/ jadi src/assets.js (base64 data URI).
// Game harus tetap SATU FILE dan jalan dari file:// tanpa internet, jadi
// gambar tidak boleh berupa file terpisah yang di-load saat runtime.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const dir = resolve(root, 'assets');

const files = readdirSync(dir).filter(f => f.endsWith('.webp')).sort();
const out = {};
let total = 0;

for (const f of files) {
  const p = join(dir, f);
  const buf = readFileSync(p);
  total += buf.length;
  const key = basename(f, '.webp').replace(/-/g, '_');
  out[key] = 'data:image/webp;base64,' + buf.toString('base64');
}

const js = '// DIHASILKAN OTOMATIS oleh tools/build-assets.mjs — jangan diedit tangan.\n' +
  '(function (G) {\n' +
  '  G.ART = ' + JSON.stringify(out, null, 0) + ';\n' +
  '})(globalThis.GK = globalThis.GK || {});\n';

writeFileSync(resolve(root, 'src/assets.js'), js, 'utf8');

const kb = (total / 1024).toFixed(1);
const outKb = (Buffer.byteLength(js) / 1024).toFixed(1);
console.log(files.length + ' gambar -> src/assets.js (' + outKb + ' KB, gambar asli ' + kb + ' KB)');
for (const f of files) {
  const s = statSync(join(dir, f));
  console.log('  ' + f.padEnd(18) + (s.size / 1024).toFixed(1) + ' KB');
}
