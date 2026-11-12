(function (G) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  //  MUSIK LATAR — dibangkitkan sendiri dengan Web Audio API.
  //
  //  Kenapa tidak pakai file MP3/OGG?
  //   1. Game ini satu file dan harus jalan dari file:// tanpa internet.
  //      File audio terpisah akan gagal dimuat.
  //   2. Audio base64 akan menambah ratusan KB — game sekarang cuma 80 KB.
  //   3. Chiptune dari oscillator justru cocok dengan gaya visual pixel/cartun.
  //
  //  Semua nada dijadwalkan dengan lookahead supaya tidak "gemetar" saat
  //  browser sibuk (setInterval saja tidak cukup akurat untuk musik).
  // ══════════════════════════════════════════════════════════════════

  var ctx = null;
  var master = null;
  var playing = false;
  var timer = null;
  var nextNoteTime = 0;
  var step = 0;
  var muted = false;

  // Frekuensi nada (A4 = 440). Dipakai lewat nama supaya mudah dibaca.
  var N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    '-': 0   // istirahat
  };

  // Melodi utama: 32 langkah, ceria dan sederhana (cocok untuk anak).
  // Pola ini mengulang; variasi datang dari bass yang berganti akor.
  // Melodi 32 langkah: cerah, naik-turun, sedikit istirahat supaya tidak
  // terasa penuh sesak. Istirahat hanya di akhir frasa.
  var MELODY = [
    'E5','G5','G5','A5','G5','E5','D5','C5',
    'D5','E5','E5','G5','E5','D5','C5','-',
    'E5','G5','G5','A5','C5','D5','E5','G5',
    'A5','G5','E5','D5','C5','-','C5','-'
  ];


  // Bass: akor C - Am - F - G, masing-masing 8 langkah.
  var BASS = [
    'C3','-','C3','-','G3','-','C3','-',
    'A3','-','A3','-','E3','-','A3','-',
    'F3','-','F3','-','C4','-','F3','-',
    'G3','-','G3','-','D4','-','G3','-'
  ];

  var TEMPO = 132;                       // BPM, ceria tapi tidak terburu
  var STEP_DUR = 60 / TEMPO / 2;         // satu langkah = 1/8 not

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;            // volume keseluruhan: pelan, tidak mengganggu
    master.connect(ctx.destination);
    return ctx;
  }

  // Satu nada pendek. type: 'square' (melodi) atau 'triangle' (bass).
  function playNote(freq, time, dur, type, vol) {
    if (!freq) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, time);

    // Envelope: naik cepat, turun halus. Tanpa ini nada berbunyi "klik".
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.92);

    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + dur);
  }

  // Hi-hat: noise putih pendek yang difilter high-pass. Ini yang membuat
  // irama terasa hidup tanpa perlu sampel drum.
  var noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 0.06);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function playHat(time) {
    var src = ctx.createBufferSource();
    src.buffer = getNoise();
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.09, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(time);
    src.stop(time + 0.06);
  }

  // Jadwalkan nada untuk beberapa langkah ke depan.
  function schedule() {
    if (!playing || !ctx) return;
    var horizon = ctx.currentTime + 0.18;   // lookahead ~180ms

    while (nextNoteTime < horizon) {
      var i = step % MELODY.length;
      var m = N[MELODY[i]];
      var b = N[BASS[i % BASS.length]];

      playNote(m, nextNoteTime, STEP_DUR * 1.7, 'square', 0.30);
      // Bass hanya tiap 2 langkah supaya tidak ramai.
      if (i % 2 === 0) playNote(b, nextNoteTime, STEP_DUR * 1.9, 'triangle', 0.42);

      // Hi-hat tipis di ketukan genap: memberi rasa "berdetak".
      if (i % 4 === 2) playHat(nextNoteTime);

      nextNoteTime += STEP_DUR;
      step++;
    }
  }

  function start() {
    if (playing) return;
    if (!ensureCtx()) return;
    // Browser menahan AudioContext sampai ada interaksi user. Ini dipanggil
    // dari klik tombol PLAY, jadi aman.
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.06;
    schedule();
    timer = setInterval(schedule, 60);
  }

  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function toggleMute() {
    if (!ensureCtx()) return muted;
    muted = !muted;
    master.gain.setTargetAtTime(muted ? 0 : 0.16, ctx.currentTime, 0.02);
    return muted;
  }

  function isMuted() { return muted; }
  function isPlaying() { return playing; }

  G.Music = { start, stop, toggleMute, isMuted, isPlaying };
})(globalThis.GK = globalThis.GK || {});
