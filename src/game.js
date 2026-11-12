(function () {
  'use strict';

  var GK = globalThis.GK;
  var DIAG = new URLSearchParams(location.search).has('diag');

  // ── elemen ────────────────────────────────────────────────
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var elHome = document.getElementById('home');
  var elQuiz = document.getElementById('quiz');
  var elResult = document.getElementById('result');
  var elOver = document.getElementById('gameover');
  var elHud = document.getElementById('hud');
  var elPad = document.getElementById('pad');

  // ── state global ──────────────────────────────────────────
  var S = {
    scene: 'home',              // home | play | quiz | result | gameover
    levelId: 1,
    level: null,
    world: null,
    quiz: null,
    progress: GK.Progress.safeRead(),
    seed: 20261112,
    camX: 0
  };

  // ── scene switching ───────────────────────────────────────
  function showScene(name) {
    S.scene = name;
    elHome.classList.toggle('on', name === 'home');
    elQuiz.classList.toggle('on', name === 'quiz');
    elResult.classList.toggle('on', name === 'result');
    elOver.classList.toggle('on', name === 'gameover');
    elHud.classList.toggle('on', name === 'play' || name === 'quiz');
    elPad.classList.toggle('on', name === 'play');
  }

  // ══════════════════════════════════════════════════════════
  //  BERANDA
  // ══════════════════════════════════════════════════════════
  function renderHome() {
    var box = document.getElementById('levelCards');
    box.innerHTML = '';
    for (var n = 1; n <= GK.Levels.count; n++) {
      var unlocked = GK.Progress.isUnlocked(S.progress, n);
      var best = GK.Progress.bestScore(S.progress, n);
      var passed = GK.Progress.isPassed(S.progress, n);

      var b = document.createElement('button');
      b.className = 'lv' + (unlocked ? '' : ' locked') + (passed ? ' passed' : '');
      b.dataset.level = String(n);

      var inner = '<span class="n">' + (unlocked ? n : '🔒') + '</span>';
      if (unlocked && best !== null) {
        inner += '<span class="best">' + best + '</span>';
      } else if (!unlocked) {
        inner += '<span class="s">Terkunci</span>';
      } else {
        inner += '<span class="s">Main</span>';
      }
      b.innerHTML = inner;

      if (unlocked) {
        b.addEventListener('click', (function (lvl) {
          return function () { startLevel(lvl); };
        })(n));
      }
      box.appendChild(b);
    }
  }

  // Level yang boleh dimainkan lewat tombol PLAY:
  // level tertinggi yang terbuka. Kalau level 1 lulus, PLAY lanjut ke 2.
  function highestUnlocked() {
    var hi = 1;
    for (var n = 1; n <= GK.Levels.count; n++) {
      if (GK.Progress.isUnlocked(S.progress, n)) hi = n;
    }
    return hi;
  }

  // ══════════════════════════════════════════════════════════
  //  MULAI LEVEL
  // ══════════════════════════════════════════════════════════
  function startLevel(n) {
    S.levelId = n;
    S.level = GK.Levels.getLevel(n);
    S.world = GK.Physics.makeState(S.level);
    S.camX = 0;

    // Seed berubah tiap percobaan supaya soal tidak identik saat "Main Lagi".
    S.seed = (S.seed * 1103515245 + 12345) & 0x7fffffff;

    var questions = GK.Questions.generateLevel(n, S.seed);
    S.quiz = GK.Quiz.create(n, questions);

    showScene('play');
    updateHud();
  }

  function retryLevel() {
    startLevel(S.levelId);
  }

  function goHome() {
    S.world = null;
    S.quiz = null;
    renderHome();
    showScene('home');
  }

  // ══════════════════════════════════════════════════════════
  //  HUD
  // ══════════════════════════════════════════════════════════
  function updateHud() {
    if (!S.world) return;
    var hearts = '';
    for (var i = 0; i < 3; i++) hearts += i < S.world.lives ? '❤' : '🖤';
    document.getElementById('hudLives').textContent = hearts;

    var sc = S.quiz ? GK.Quiz.score(S.quiz) : 0;
    // Nomor soal = index soal yang SEDANG dibuka + 1. Jangan pakai
    // answers.length: itu menghitung jawaban yang sudah masuk, sehingga
    // saat soal ke-2 dibuka HUD masih menulis "Soal 1/10" (basi).
    var cur = S.quiz ? Math.min(S.quiz.index + 1, S.quiz.questions.length) : 0;
    var total = S.quiz ? S.quiz.questions.length : 10;
    document.getElementById('hudScore').textContent =
      'Level ' + S.levelId + ' · Skor ' + sc + ' · Soal ' + cur + '/' + total;
  }

  // ══════════════════════════════════════════════════════════
  //  KUIS
  // ══════════════════════════════════════════════════════════
  function openQuiz() {
    var q = GK.Quiz.current(S.quiz);
    if (!q) { closeQuiz(); return; }
    S.quiz.open = true;
    showScene('quiz');
    drawQuizCard();
    updateHud();
  }

  function drawQuizCard() {
    var q = GK.Quiz.current(S.quiz);
    if (!q) return closeQuiz();

    // Nomor soal & skor di kartu. Skor diambil dari Quiz.score() yang sudah
    // memasukkan jawaban sebelumnya — jadi setelah pick() ini mencerminkan
    // skor terbaru, bukan skor basi.
    document.getElementById('qNum').textContent =
      'Soal ' + (S.quiz.index + 1) + ' / ' + S.quiz.questions.length;
    document.getElementById('qScore').textContent = 'Skor ' + GK.Quiz.score(S.quiz);

    // Soal cerita: kotak narasi biru. Soal biasa: kosong.
    document.getElementById('qStory').innerHTML =
      (q.isStory && q.story) ? '<div class="storyBox">' + q.story + '</div>' : '';

    document.getElementById('qPrompt').innerHTML = q.prompt;

    var opts = document.getElementById('qOpts');
    opts.innerHTML = '';
    for (var i = 0; i < q.options.length; i++) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.dataset.i = String(i);
      b.innerHTML = q.options[i];
      b.addEventListener('click', (function (idx) {
        return function () { pick(idx); };
      })(i));
      opts.appendChild(b);
    }

    var feed = document.getElementById('qFeed');
    feed.className = 'feed';
    feed.innerHTML = '';
  }

  function pick(i) {
    if (!S.quiz || !S.quiz.open) return;
    var q = GK.Quiz.current(S.quiz);
    if (!q) return;

    var ok = GK.Quiz.isCorrect(S.quiz, i);
    var btns = document.querySelectorAll('#qOpts .opt');

    // Semua tombol dinonaktifkan supaya tidak bisa dobel jawab.
    for (var k = 0; k < btns.length; k++) btns[k].disabled = true;

    // Yang BENAR selalu hijau, termasuk saat pemain salah.
    btns[q.correct].classList.add('right');
    if (!ok) {
      btns[i].classList.add('wrong');
      // Distraktor lain diredupkan supaya fokus ke dua jawaban.
      for (var m = 0; m < btns.length; m++) {
        if (m !== q.correct && m !== i) btns[m].classList.add('dim');
      }
    }

    // innerHTML, BUKAN textContent: explain berisi &rarr; / &times; / &minus;.
    var feed = document.getElementById('qFeed');
    feed.innerHTML = (ok ? '✅ Benar! +10 poin · ' : '❌ Belum tepat. ') + q.explain;
    feed.className = 'feed show ' + (ok ? 'ok' : 'no');

    GK.Quiz.answer(S.quiz, i);
    updateHud();

    // Perbarui skor DI KARTU setelah answer(), bukan sebelumnya.
    // Kalau tidak, kartu menampilkan skor basi ("Skor 0") sementara HUD
    // sudah menunjukkan "Skor 10" — dua angka berbeda di satu layar.
    document.getElementById('qScore').textContent = 'Skor ' + GK.Quiz.score(S.quiz);

    // Beri waktu membaca penjelasan, lalu lanjut otomatis.
    // Salah diberi waktu lebih lama karena ada penjelasan yang perlu dibaca.
    setTimeout(function () { advance(); }, ok ? 1400 : 2600);
  }

  function advance() {
    if (!S.quiz || !S.quiz.locked) return;
    GK.Quiz.next(S.quiz);

    if (S.quiz.done) {
      // Semua soal sudah dijawab: buka gembok terakhir, lanjut main.
      if (S.world) {
        var li = S.world.pendingLock;
        if (li >= 0 && S.world.locks[li]) S.world.locks[li].open = true;
        S.world.pendingLock = -1;
        // Checkpoint di posisi gembok yang baru dibuka, supaya kalau mati
        // setelah ini pemain tidak mengulang dari awal level.
        GK.Physics.setCheckpoint(S.world, S.world.player.x, S.world.player.y - 4);
      }
      closeQuiz();
    } else {
      S.quiz.open = true;
      drawQuizCard();
    }
  }

  function closeQuiz() {
    if (S.quiz) S.quiz.open = false;
    // Kalau dunia masih ada, kembalikan ke permainan. Kalau tidak, ke beranda.
    if (S.world) showScene('play');
    else showScene('home');
    updateHud();
  }

  // ══════════════════════════════════════════════════════════
  //  HASIL
  // ══════════════════════════════════════════════════════════
  function finishLevel() {
    var sum = GK.Quiz.summary(S.quiz);
    var passed = sum.score >= GK.Progress.PASS_SCORE;

    // Skor terbaik selalu dicatat, lulus atau tidak.
    // Level berikutnya hanya terbuka kalau skor >= PASS_SCORE.
    GK.Progress.completeLevel(S.progress, S.levelId, sum.score);

    var title = document.getElementById('rTitle');
    var scoreEl = document.getElementById('rScore');
    var need = document.getElementById('rNeed');
    var retry = document.getElementById('btnRetry');

    scoreEl.textContent = String(sum.score);
    scoreEl.className = 'scoreBig ' + (passed ? 'pass' : 'fail');
    document.getElementById('rLine').textContent =
      'Benar ' + sum.correct + ' · Salah ' + sum.wrong + ' · dari ' + sum.max + ' poin';

    if (passed) {
      var isLast = S.levelId >= GK.Levels.count;
      title.textContent = isLast ? '🏆 Semua level selesai!' : '🏆 Level ' + S.levelId + ' lulus!';
      need.innerHTML = '';
      retry.textContent = isLast ? 'MAIN LAGI' : 'NEXT LEVEL';
    } else {
      title.textContent = 'Level ' + S.levelId + ' selesai';
      need.innerHTML = '<div class="need">Belum lulus — butuh minimal ' +
        GK.Progress.PASS_SCORE + ' untuk membuka level berikutnya. ' +
        'Kamu benar ' + sum.correct + ' dari ' + S.quiz.questions.length + ' soal.</div>';
      retry.textContent = 'COBA LAGI';
    }

    // Rincian benar/salah per soal. Ini yang diminta tampil saat menang.
    var list = document.getElementById('rList');
    list.innerHTML = '';
    for (var i = 0; i < sum.answers.length; i++) {
      var a = sum.answers[i];
      var row = document.createElement('div');
      row.className = 'rRow';
      row.innerHTML =
        '<span class="mk ' + (a.correct ? 'ok' : 'no') + '">' + (a.correct ? '✓' : '✗') + '</span>' +
        '<span class="tx">' + (i + 1) + '. ' + a.prompt + '</span>';
      list.appendChild(row);
    }

    showScene('result');
  }

  function showGameOver() {
    showScene('gameover');
  }

  // ══════════════════════════════════════════════════════════
  //  RENDER DUNIA
  // ══════════════════════════════════════════════════════════
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(cv.clientWidth * dpr);
    cv.height = Math.floor(cv.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Palet per level, supaya tiap level terasa beda tanpa perlu aset.
  var THEME = {
    1: { sky1: '#8fd3f4', sky2: '#d6f0ff', hill: '#8ee08a', hill2: '#4fb556', sun: '#ffe680' },
    2: { sky1: '#6f7fd6', sky2: '#b9c4f2', hill: '#7d8fd0', hill2: '#5566a8', sun: '#ffe0a3' },
    3: { sky1: '#5a4b9c', sky2: '#c9a8e8', hill: '#9b7fc4', hill2: '#6f55a0', sun: '#ffd6f0' }
  };

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    var w = cv.clientWidth, h = cv.clientHeight;
    var lvl = S.level;
    var th = THEME[S.levelId] || THEME[1];

    // Langit
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.sky1);
    g.addColorStop(1, th.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (!S.world) return;

    // ── SKALA & KAMERA ──────────────────────────────────────────────
    // Rumus layar: layarX = (duniaX - camX) * scale
    //
    // Skala ditentukan dari LEBAR, bukan tinggi. Kalau dari tinggi, di HP
    // portrait (390x844) skalanya jadi 1.5 dan lebar yang terlihat cuma
    // 390/1.5 = 259px dunia — gembok pertama (x=300) pun tidak masuk layar.
    // Dengan VIEW_W=560, pemain melihat ~560px dunia: cukup untuk 2 gembok.
    // Pilih skala TERBESAR antara "muat lebar" dan "muat tinggi", supaya
    // layar terisi penuh dan tidak ada langit kosong.
    //  - muat lebar : w / 560  -> pemain melihat ~560px dunia horizontal
    //  - muat tinggi: h / 560  -> dunia mengisi tinggi layar
    // Kalau hanya pakai w/560, di HP portrait (390x844) dunia 560px tinggi
    // cuma memakai 560 dari 844px layar -> 284px kosong di atas.
    var VIEW_W = 560;
    var scale = Math.max(w / VIEW_W, h / lvl.height);
    if (scale < 0.5) scale = 0.5;
    if (scale > 2.4) scale = 2.4;

    var viewW = w / scale;
    var viewH = h / scale;
    var worldH = lvl.height * scale;

    var p = S.world.player;

    // Kamera X: pemain di 40% lebar layar, dijepit di batas peta.
    var camX = (p.x + p.w / 2) - viewW * 0.40;
    camX = Math.max(0, Math.min(lvl.width - viewW, camX));
    if (lvl.width < viewW) camX = (lvl.width - viewW) / 2;

    // Kamera Y:
    //  - Kalau dunia lebih PENDEK dari layar: tempelkan ke BAWAH layar, jadi
    //    tanah selalu di bawah dan sisa ruang di atas jadi langit.
    //  - Kalau dunia lebih TINGGI: kamera mengikuti pemain.
    // Dengan skala di atas, worldH selalu >= h, jadi selalu ikut pemain.
    var camY = (p.y + p.h / 2) - viewH * 0.70;
    camY = Math.max(0, Math.min(Math.max(0, lvl.height - viewH), camY));
    var yOffset = -camY * scale;

    S.camX = camX;

    ctx.save();
    ctx.translate(-camX * scale, yOffset);
    ctx.scale(scale, scale);

    // Matahari: koordinat dunia, jadi ikut bergeser sedikit (bukan fixed).
    ctx.fillStyle = th.sun;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(camX + viewW * 0.82, 90, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bukit parallax: bergerak 0.35x dari kamera.
    ctx.fillStyle = th.hill;
    var hillOff = (camX * 0.35) % 420;
    for (var hx = -hillOff - 420; hx < camX + viewW + 420; hx += 420) {
      ctx.beginPath();
      ctx.arc(hx + 210, lvl.height - 40, 210, Math.PI, 0);
      ctx.fill();
    }

    // Awan (parallax 0.2) — mengisi langit.
    var cloudOff = (camX * 0.2) % 480;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (var ci = 0; ci < 5; ci++) {
      var cxp = ci * 480 - cloudOff + 60;
      var cyp = 60 + (ci % 3) * 54;
      var cs = 0.75 + (ci % 2) * 0.4;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 26 * cs, 0, Math.PI * 2);
      ctx.arc(cxp + 26 * cs, cyp + 6 * cs, 20 * cs, 0, Math.PI * 2);
      ctx.arc(cxp - 26 * cs, cyp + 7 * cs, 18 * cs, 0, Math.PI * 2);
      ctx.arc(cxp + 4 * cs, cyp - 14 * cs, 20 * cs, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bintang di level 3 (malam).
    if (S.levelId === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (var si = 0; si < 30; si++) {
        var sx = ((si * 137) % Math.round(lvl.width)) ;
        var sy = ((si * 79) % 200) + 20;
        var tw = 1.5 + ((si * 7) % 10) / 9;
        ctx.beginPath();
        ctx.arc(sx, sy, tw, 0, Math.PI * 2);
        ctx.fill();
      }
    }


    // Platform
    for (var i = 0; i < lvl.platforms.length; i++) {
      var pl = lvl.platforms[i];
      if (pl.solid) {
        ctx.fillStyle = th.hill2;
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        // Strip rumput di atas tanah
        ctx.fillStyle = th.hill;
        ctx.fillRect(pl.x, pl.y, pl.w, 12);
      } else {
        // Platform satu arah: papan kayu dengan bayangan
        ctx.fillStyle = '#c98a4b';
        roundRect(pl.x, pl.y, pl.w, pl.h, 8);
        ctx.fill();
        ctx.fillStyle = '#a86f38';
        ctx.fillRect(pl.x + 4, pl.y + pl.h - 6, pl.w - 8, 4);
      }
    }

    // Gembok
    for (var li = 0; li < S.world.locks.length; li++) {
      var lk = S.world.locks[li];
      drawLock(lk);
    }

    // Piala
    drawTrophy(S.world.trophy);

    // Enemy
    for (var ei = 0; ei < S.world.enemies.length; ei++) {
      if (S.world.enemies[ei].alive) drawEnemy(S.world.enemies[ei], S.world.t);
    }

    // Player
    drawPlayer(S.world.player, S.world);

    ctx.restore();

    // Efek merah saat kena musuh
    if (S.world.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,60,60,' + (S.world.hitFlash * 1.2) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    // Petunjuk arah di awal level.
    // DITARUH DI ATAS pita permainan (bukan di bawah): pemain spawn di kiri
    // bawah, dan kotak yang diletakkan di h-120 menutupi karakternya.
    if (S.world.t < 3.2 && S.camX < 120) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (3.2 - S.world.t) / 0.8);
      var bw = Math.min(w - 40, 320);
      ctx.fillStyle = '#0b1020cc';
      roundRect(w / 2 - bw / 2, 96, bw, 48, 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Jalan ke kanan, buka 10 gembok!', w / 2, 126);
      ctx.restore();
    }
  }

  function drawLock(l) {
    var x = l.x, y = l.y, w = l.w, h = l.h;
    if (l.open) {
      // Gembok terbuka: geser ke samping dan jadi pudar (sudah dijawab).
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#39d98a';
      roundRect(x, y + h * 0.4, w, h * 0.6, 6);
      ctx.fill();
      // Centang
      ctx.strokeStyle = '#0b4a2c';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.25, y + h * 0.72);
      ctx.lineTo(x + w * 0.45, y + h * 0.9);
      ctx.lineTo(x + w * 0.78, y + h * 0.52);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // Badan gembok kuning
    ctx.fillStyle = '#ffd24a';
    roundRect(x, y + h * 0.38, w, h * 0.62, 6);
    ctx.fill();
    ctx.strokeStyle = '#c47f12';
    ctx.lineWidth = 3;
    roundRect(x, y + h * 0.38, w, h * 0.62, 6);
    ctx.stroke();

    // Lubang kunci
    ctx.fillStyle = '#7a4a00';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.66, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w / 2 - 2, y + h * 0.66, 4, 9);

    // Gagang (shackle)
    ctx.strokeStyle = '#9aa5bd';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.36, w * 0.28, Math.PI, 0);
    ctx.stroke();
  }

  function drawTrophy(t) {
    var cx = t.x + t.w / 2;
    // Piala emas
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.moveTo(t.x + 8, t.y + 6);
    ctx.lineTo(t.x + t.w - 8, t.y + 6);
    ctx.lineTo(t.x + t.w - 14, t.y + t.h * 0.58);
    ctx.lineTo(t.x + 14, t.y + t.h * 0.58);
    ctx.closePath();
    ctx.fill();

    // Gagang
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(t.x + 4, t.y + 20, 12, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.x + t.w - 4, t.y + 20, 12, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();

    // Kaki
    ctx.fillStyle = '#e0a800';
    ctx.fillRect(cx - 6, t.y + t.h * 0.58, 12, t.h * 0.22);
    ctx.fillRect(cx - 20, t.y + t.h * 0.8, 40, 8);

    // Kilau
    ctx.fillStyle = '#fff8d0';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(t.x + 18, t.y + 20, 5, 12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e, t) {
    // Lalat/kelelawar: badan gelap + mata putih + sayap mengepak.
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    var flap = Math.sin(t * 14) * 5;

    // Sayap
    ctx.fillStyle = 'rgba(60,70,110,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - e.w * 0.55, cy - 4 + flap, e.w * 0.45, e.h * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + e.w * 0.55, cy - 4 + flap, e.w * 0.45, e.h * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Badan
    ctx.fillStyle = '#3d2f6b';
    ctx.beginPath();
    ctx.arc(cx, cy, e.w * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Mata
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 2, 4.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 2, 2, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Taring kecil
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 7);
    ctx.lineTo(cx - 2, cy + 12);
    ctx.lineTo(cx + 1, cy + 7);
    ctx.fill();
  }

  function drawPlayer(p, st) {
    // Kedip saat tidak bisa dilukai (invuln)
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;

    var cx = p.x + p.w / 2;
    var cy = p.y + p.h / 2;

    // Bayangan
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h + 2, p.w * 0.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Badan (blob lucu)
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, p.w * 0.52, p.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d95f80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mata (ikut arah hadap)
    var ex = p.facing * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5 + ex, cy - 2, 5.5, 0, Math.PI * 2);
    ctx.arc(cx + 5 + ex, cy - 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20143a';
    ctx.beginPath();
    ctx.arc(cx - 4 + ex * 1.6, cy - 2, 2.6, 0, Math.PI * 2);
    ctx.arc(cx + 6 + ex * 1.6, cy - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Pipi meruah
    ctx.fillStyle = 'rgba(255,120,150,0.5)';
    ctx.beginPath();
    ctx.arc(cx - 9, cy + 7, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy + 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ══════════════════════════════════════════════════════════
  //  INPUT
  // ══════════════════════════════════════════════════════════
  var keys = { left: false, right: false, up: false, down: false, jump: false };

  function readInput() {
    return {
      x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
      jump: keys.up || keys.jump,
      down: keys.down
    };
  }

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump'
  };

  document.addEventListener('keydown', function (ev) {
    var k = KEYMAP[ev.code];
    if (k) { keys[k] = true; ev.preventDefault(); }
    if (ev.code === 'Enter' && S.scene === 'home') startLevel(highestUnlocked());
  });

  document.addEventListener('keyup', function (ev) {
    var k = KEYMAP[ev.code];
    if (k) { keys[k] = false; ev.preventDefault(); }
  });

  // Kontrol sentuh: pointerdown/up lebih andal daripada touchstart di HP.
  function bindPad(btn) {
    var k = btn.dataset.k;
    var on = function (ev) { ev.preventDefault(); keys[k] = true; };
    var off = function (ev) { ev.preventDefault(); keys[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.btn[data-k]'), bindPad);

  // ══════════════════════════════════════════════════════════
  //  TOMBOL
  // ══════════════════════════════════════════════════════════
  document.getElementById('btnPlay').addEventListener('click', function () {
    startLevel(highestUnlocked());
  });

  document.getElementById('btnRetry').addEventListener('click', function () {
    if (S.levelId >= GK.Levels.count && GK.Progress.isPassed(S.progress, S.levelId)) {
      goHome();
    } else if (GK.Quiz.summary(S.quiz).score >= GK.Progress.PASS_SCORE) {
      startLevel(Math.min(S.levelId + 1, GK.Levels.count));
    } else {
      retryLevel();
    }
  });

  document.getElementById('btnRetry2').addEventListener('click', retryLevel);
  document.getElementById('btnMenu').addEventListener('click', goHome);
  document.getElementById('btnMenu2').addEventListener('click', goHome);

  // ══════════════════════════════════════════════════════════
  //  LOOP
  // ══════════════════════════════════════════════════════════
  var last = 0;

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
    last = ts;

    if (S.scene === 'play' && S.world) {
      GK.Physics.step(S.world, readInput(), S.level, dt);

      if (S.world.pendingLock >= 0) {
        openQuiz();
      } else if (S.world.won) {
        finishLevel();
      } else if (S.world.gameover) {
        showGameOver();
      }

      // Kamera dihitung di render() dari posisi pemain — jangan di sini,
      // kalau dihitung di dua tempat hasilnya saling menimpa.
    }

    if (S.scene === 'play' || S.scene === 'quiz') render();

    if (DIAG) {
      // Hook verifikasi: berhenti setelah satu frame supaya headless bisa
      // membaca state tanpa perlu rAF yang tidak maju di headless.
      document.body.dataset.diag = JSON.stringify(snap());
      return;
    }
    requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════════════════════
  //  DIAG (untuk verifikasi headless)
  // ══════════════════════════════════════════════════════════
  function snap() {
    var out = {
      scene: S.scene,
      levelId: S.levelId,
      lives: S.world ? S.world.lives : null,
      locksOpen: S.world ? S.world.locks.filter(function (l) { return l.open; }).length : null,
      px: S.world ? Math.round(S.world.player.x) : null,
      py: S.world ? Math.round(S.world.player.y) : null,
      onGround: S.world ? S.world.player.onGround : null,
      t: S.world ? +S.world.t.toFixed(2) : null,
      guard: globalThis.__guard || null,
      score: S.quiz ? GK.Quiz.score(S.quiz) : null,
      answered: S.quiz ? S.quiz.answers.length : null,
      correct: S.quiz ? GK.Quiz.correctCount(S.quiz) : null,
      wrong: S.quiz ? GK.Quiz.wrongCount(S.quiz) : null,
      storyCount: S.quiz ? S.quiz.questions.filter(function (q) { return q.isStory; }).length : null,
      unlocked: [1, 2, 3].map(function (n) { return GK.Progress.isUnlocked(S.progress, n); })
    };
    return out;
  }

  globalThis.GK.debug = {
    snap: snap,
    S: S,
    startLevel: startLevel,
    // Buka kuis lewat jalur ASLI (drawQuizCard + listener tombol), supaya
    // pengujian tidak memakai tombol palsu tanpa event handler.
    openQuizAt: function (i) {
      if (!S.quiz) return 'belum mulai';
      S.quiz.index = i || 0;
      S.quiz.open = true;
      S.world.pendingLock = 0;
      showScene('quiz');
      drawQuizCard();
      return snap();
    },
    // Mainkan otomatis: sentuh semua gembok, jawab soal, sampai piala.
    // Bot ini HARUS melompati musuh — tanpa melompat, pemain mati 3x dan
    // autoplay berhenti di gembok ke-2. Itu bukan bug game, itu bug bot.
    autoplay: function (correctRatio) {
      var ratio = correctRatio === undefined ? 1 : correctRatio;
      startLevel(1);
      var guard = 0;
      var p = S.world.player;

      while (!S.world.won && !S.world.gameover && guard < 60000) {
        guard++;

        // Cari musuh terdekat di depan pemain pada ketinggian yang sama.
        var mustJump = false;
        for (var i = 0; i < S.world.enemies.length; i++) {
          var e = S.world.enemies[i];
          if (!e.alive) continue;
          var dx = e.x - (p.x + p.w);
          // Musuh di depan, dekat, dan sejajar tinggi -> lompat.
          if (dx > -10 && dx < 90 && Math.abs(e.y - p.y) < 70) mustJump = true;
        }

        // juga lompat kalau mentok (tidak maju) supaya tidak tersangkut.
        keys.right = true;
        keys.up = mustJump && p.onGround;

        GK.Physics.step(S.world, readInput(), S.level, 1 / 60);

        if (S.world.pendingLock >= 0) {
          var q = GK.Quiz.current(S.quiz);
          S.quiz.open = true;
          var wantCorrect = S.quiz.answers.length < Math.round(10 * ratio);
          var choice = wantCorrect ? q.correct : (q.correct === 0 ? 1 : 0);
          GK.Quiz.answer(S.quiz, choice);
          GK.Quiz.next(S.quiz);
          if (!S.quiz.done) S.quiz.open = true;
          var li = S.world.pendingLock;
          S.world.locks[li].open = true;
          S.world.pendingLock = -1;
          // Beri kebal sebentar setelah kuis, sama seperti perilaku game.
          S.world.player.invuln = 0.6;
        }
      }
      keys.right = false;
      keys.up = false;
      globalThis.__guard = guard;
      return snap();
    }
  };

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  window.addEventListener('resize', resize);
  resize();
  renderHome();
  showScene('home');

  if (DIAG) {
    // Mode diag: jangan pakai rAF (tidak maju di headless).
    document.body.dataset.diag = JSON.stringify(snap());
  } else {
    requestAnimationFrame(loop);
  }
})();
