(function () {
  'use strict';

  var GK = globalThis.GK;
  var DIAG = new URLSearchParams(location.search).has('diag');

  // ── SPRITE ────────────────────────────────────────────────
  // Gambar ditanam sebagai data URI di src/assets.js (dibuat oleh
  // tools/build-assets.mjs). Dimuat sekali, lalu dipakai berulang.
  var IMG = {};
  var IMG_READY = false;
  (function loadArt() {
    var art = GK.ART || {};
    var keys = Object.keys(art);
    if (!keys.length) return;
    var left = keys.length;
    keys.forEach(function (k) {
      var im = new Image();
      im.onload = function () { if (--left === 0) IMG_READY = true; };
      im.onerror = function () { if (--left === 0) IMG_READY = true; };
      im.src = art[k];
      IMG[k] = im;
    });
  })();

  // Gambar sprite dengan ukuran tetap dan titik tumpu di bawah-tengah,
  // supaya sprite selalu "berdiri" di permukaan tanah.
  function drawSprite(key, cx, bottomY, hgt, flip) {
    var im = IMG[key];
    if (!im || !im.complete || !im.width) return false;
    var ratio = im.width / im.height;
    var w = hgt * ratio;
    ctx.save();
    if (flip) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, bottomY - hgt, w, hgt);
    } else {
      ctx.drawImage(im, cx - w / 2, bottomY - hgt, w, hgt);
    }
    ctx.restore();
    return true;
  }

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
          return function () {
            GK.Music.start();
            startLevel(lvl);
          };
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
  // Nomor soal yang SEDANG TAMPIL. Satu sumber kebenaran, dipakai HUD dan
  // kartu kuis, supaya keduanya tidak pernah berbeda angka.
  //  - sedang mengerjakan soal ke-i : index = i-1, locked = false -> index+1
  //  - baru dijawab (menunggu next) : index sudah naik, locked = true -> index
  function currentQuestionNo() {
    if (!S.quiz) return 0;
    var n = S.quiz.locked ? S.quiz.index : S.quiz.index + 1;
    return Math.max(1, Math.min(n, S.quiz.questions.length));
  }

  function updateHud() {
    if (!S.world) return;
    var hearts = '';
    for (var i = 0; i < 3; i++) hearts += i < S.world.lives ? '❤' : '🖤';
    document.getElementById('hudLives').textContent = hearts;

    var sc = S.quiz ? GK.Quiz.score(S.quiz) : 0;
    var cur = S.quiz ? currentQuestionNo() : 0;
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
      'Soal ' + currentQuestionNo() + ' / ' + S.quiz.questions.length;
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

    // Sinkronkan HUD setiap kali kartu digambar. Tanpa ini, jalur yang
    // mengubah index di luar advance() (mis. debug/openQuizAt) membuat HUD
    // dan kartu menampilkan nomor soal berbeda.
    updateHud();
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

    // ── SATU GEMBOK = SATU SOAL ──────────────────────────────────────
    // Setelah dijawab, gembok itu TERBUKA dan pemain DIKEMBALIKAN ke dunia.
    // Pemain jalan lagi, lalu menyentuh gembok berikutnya -> soal berikutnya.
    //
    // Versi lama langsung membuka soal berikutnya di tempat ("S.quiz.open =
    // true; drawQuizCard()"), sehingga 10 soal muncul beruntun tanpa pemain
    // pernah kembali bermain. Itu yang membuat alurnya terasa salah.
    if (S.world) {
      var li = S.world.pendingLock;
      if (li >= 0 && S.world.locks[li]) S.world.locks[li].open = true;
      S.world.pendingLock = -1;

      // Beri kebal sebentar setelah kuis: pemain sering muncul tepat di
      // samping musuh, dan mati tanpa sempat bergerak itu tidak adil.
      S.world.player.invuln = 0.9;

      // Checkpoint di gembok yang baru dibuka.
      GK.Physics.setCheckpoint(S.world, S.world.player.x, S.world.player.y - 4);
    }

    closeQuiz();
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
      // Untuk jawaban salah, tampilkan apa yang dipilih vs yang seharusnya.
      // Tanpa ini anak hanya tahu "salah" tanpa tahu apa yang benar.
      var extra = '';
      if (!a.correct && a.choiceText && a.correctText) {
        extra = '<span class="ans"><b class="picked">' + a.choiceText + '</b>' +
                ' &rarr; seharusnya <b class="should">' + a.correctText + '</b></span>';
      }
      row.innerHTML =
        '<span class="mk ' + (a.correct ? 'ok' : 'no') + '">' + (a.correct ? '✓' : '✗') + '</span>' +
        '<span class="tx">' + (i + 1) + '. ' + a.prompt + extra + '</span>';
      list.appendChild(row);
    }

    // Petunjuk "geser" hanya muncul kalau daftarnya memang terpotong.
    var hint = document.getElementById('rHint');
    if (hint) {
      setTimeout(function () {
        var needsScroll = list.scrollHeight > list.clientHeight + 4;
        hint.textContent = needsScroll ? '(geser untuk lihat semua)' : '';
      }, 0);
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
    1: { sky1:'#8fd3f4', sky2:'#d6f0ff', hill:'#8ee08a', hill2:'#4fb556', sun:'#ffe680',
         mtn:'#a9dbe9', mtn2:'#8cc6d6', tree:'#5aa85e', tree2:'#3d7a42', bush:'#6cbf6f' },
    2: { sky1:'#6f7fd6', sky2:'#b9c4f2', hill:'#7d8fd0', hill2:'#5566a8', sun:'#ffe0a3',
         mtn:'#8892c8', mtn2:'#727cb4', tree:'#5a6bb0', tree2:'#414d84', bush:'#6d7cc0' },
    3: { sky1:'#5a4b9c', sky2:'#c9a8e8', hill:'#9b7fc4', hill2:'#6f55a0', sun:'#ffd6f0',
         mtn:'#7d6aa8', mtn2:'#665591', tree:'#7a5f9c', tree2:'#574270', bush:'#8a70b0' }
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

    // ── LATAR BERLAPIS ────────────────────────────────────────────
    // Di layar portrait langit menempati ~60% layar. Daripada dibiarkan
    // kosong, diisi pemandangan berlapis: gunung jauh, bukit, pohon, semak,
    // awan, burung. Semua digambar SEBELUM platform supaya ada di belakang.
    var gY = lvl.platforms[0].y;             // permukaan tanah
    var left = camX - 320;
    var right = camX + viewW + 320;

    // 1. Matahari
    ctx.fillStyle = th.sun;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(camX + viewW * 0.78, 110, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 2. Gunung jauh (parallax 0.12) — dua puncak per kelompok, ada salju.
    var mOff = (camX * 0.12) % 620;
    for (var mi = -1; mi * 620 - mOff < right; mi++) {
      var mx = mi * 620 - mOff;
      ctx.fillStyle = th.mtn;
      ctx.beginPath();
      ctx.moveTo(mx, gY); ctx.lineTo(mx + 200, gY - 370); ctx.lineTo(mx + 400, gY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.mtn2;
      ctx.beginPath();
      ctx.moveTo(mx + 235, gY); ctx.lineTo(mx + 400, gY - 285); ctx.lineTo(mx + 565, gY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.beginPath();
      ctx.moveTo(mx + 200, gY - 370); ctx.lineTo(mx + 168, gY - 302); ctx.lineTo(mx + 233, gY - 302);
      ctx.closePath(); ctx.fill();
    }

    // 3. Bukit tengah (parallax 0.3)
    var hOff = (camX * 0.3) % 340;
    ctx.fillStyle = th.hill;
    for (var hi = -1; hi * 340 - hOff < right; hi++) {
      var hx = hi * 340 - hOff;
      ctx.beginPath();
      ctx.arc(hx + 170, gY + 40, 195, Math.PI, 0);
      ctx.fill();
    }

    // 4. Awan (parallax 0.18)
    var cOff = (camX * 0.18) % 260;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (var ci = 0; ci * 260 - cOff < right; ci++) {
      var cxp = ci * 260 - cOff + 70;
      // y 190..430: di bawah banner tutorial, di atas puncak gunung.
      var cyp = 190 + (ci % 4) * 80;
      var cs = 0.7 + (ci % 3) * 0.22;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 30 * cs, 0, Math.PI * 2);
      ctx.arc(cxp + 30 * cs, cyp + 7 * cs, 23 * cs, 0, Math.PI * 2);
      ctx.arc(cxp - 30 * cs, cyp + 8 * cs, 21 * cs, 0, Math.PI * 2);
      ctx.arc(cxp + 5 * cs, cyp - 16 * cs, 23 * cs, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Bintang (hanya level 3 / malam)
    if (S.levelId === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var si = 0; si < 44; si++) {
        var sx = camX + ((si * 173) % Math.round(viewW + 200));
        var sy = 40 + ((si * 97) % 320);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6 + ((si * 7) % 9) / 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Pohon di tanah (parallax 1, di belakang platform).
    // Diletakkan hanya di celah yang TIDAK ada platform di atasnya, supaya
    // pohon tidak menembus papan kayu dan siluetnya tetap bersih.
    for (var ti = 0; ti < 26; ti++) {
      var tx = 70 + ti * 112 + ((ti * 53) % 56);
      if (tx < left || tx > right) continue;

      // Lewati kalau ada platform, gembok, atau area spawn di dekat pohon.
      // Tanpa ini, pohon menutupi karakter dan siluet gembok jadi kacau.
      var blocked = false;
      for (var pi = 0; pi < lvl.platforms.length; pi++) {
        var pp = lvl.platforms[pi];
        if (pp.solid) continue;
        if (tx + 70 > pp.x - 10 && tx - 40 < pp.x + pp.w + 10) { blocked = true; break; }
      }
      if (!blocked) {
        for (var ki = 0; ki < lvl.locks.length; ki++) {
          var lkk = lvl.locks[ki];
          if (tx + 70 > lkk.x - 55 && tx - 40 < lkk.x + lkk.w + 55) { blocked = true; break; }
        }
      }
      // Jangan gambar pohon di area spawn (100px pertama).
      if (tx < lvl.spawn.x + 150) blocked = true;
      if (blocked) continue;

      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(tx + 9, gY - 74, 13, 74);
      ctx.fillStyle = th.tree;
      ctx.beginPath();
      ctx.arc(tx + 15, gY - 92, 35, 0, Math.PI * 2);
      ctx.arc(tx - 13, gY - 72, 25, 0, Math.PI * 2);
      ctx.arc(tx + 44, gY - 72, 25, 0, Math.PI * 2);
      ctx.fill();
      // Highlight supaya pohon tidak terlihat rata.
      ctx.fillStyle = th.tree2;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(tx + 26, gY - 66, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 7. Semak rendah di tepi tanah
    ctx.fillStyle = th.bush;
    for (var bi = 0; bi < 32; bi++) {
      var bx = 40 + bi * 92 + ((bi * 37) % 50);
      if (bx < left || bx > right) continue;
      ctx.beginPath();
      ctx.arc(bx, gY - 4, 21, Math.PI, 0);
      ctx.arc(bx + 24, gY - 2, 16, Math.PI, 0);
      ctx.fill();
    }

    // 8. Burung (parallax 0.5) — dua garis melengkung, sayap mengepak.
    ctx.strokeStyle = 'rgba(40,60,90,0.42)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (var bj = 0; bj < 6; bj++) {
      var bxp = ((camX * 0.5 + bj * 310) % (viewW + 420)) + camX - 120;
      var byp = 175 + (bj % 4) * 64 + Math.sin(S.world.t * 1.7 + bj) * 9;
      ctx.beginPath();
      ctx.arc(bxp - 9, byp, 9, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bxp + 9, byp, 9, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }

    // ── Hiasan menara (level 3) ──
    // Tangga tanah level 3 terlihat seperti bukit biasa. Pilar kayu di setiap
    // undakan + bendera di puncak membuatnya terbaca sebagai "menara".
    if (S.levelId === 3) {
      var steps = lvl.platforms.filter(function (p) { return p.solid; })
        .sort(function (a, b) { return a.x - b.x; });
      for (var si = 1; si < steps.length; si++) {
        var st2 = steps[si];
        // Pilar di tepi kiri undakan
        ctx.fillStyle = '#6b4f8a';
        ctx.fillRect(st2.x + 8, st2.y - 46, 14, 46);
        ctx.fillStyle = '#8a6bad';
        ctx.fillRect(st2.x + 8, st2.y - 52, 14, 8);
        // Lampu kecil di atas pilar
        ctx.fillStyle = 'rgba(255,220,140,0.85)';
        ctx.beginPath();
        ctx.arc(st2.x + 15, st2.y - 58, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bendera di puncak, di samping piala
      var top = steps[steps.length - 1];
      // Dekat piala, bukan di ujung peta: pemain harus melihatnya saat mendaki.
      var fx = lvl.trophy.x + 90;
      var fy = top.y;
      ctx.strokeStyle = '#e8edf5';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 120);
      ctx.stroke();
      // Kain bendera melambai
      var wave = Math.sin(S.world.t * 3) * 6;
      ctx.fillStyle = '#ff8fab';
      ctx.beginPath();
      ctx.moveTo(fx, fy - 120);
      ctx.lineTo(fx + 62, fy - 108 + wave);
      ctx.lineTo(fx, fy - 88);
      ctx.closePath();
      ctx.fill();
    }

    // Platform
    for (var i = 0; i < lvl.platforms.length; i++) {
      var pl = lvl.platforms[i];
      if (pl.solid) {
        // Tanah: coklat tua di bawah, rumput hijau tebal di permukaan.
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(pl.x, pl.y + 26, pl.w, pl.h - 26);
        ctx.fillStyle = th.hill2;
        ctx.fillRect(pl.x, pl.y + 16, pl.w, 14);
        ctx.fillStyle = th.hill;
        ctx.fillRect(pl.x, pl.y, pl.w, 18);
        // Bintik kerikil supaya tidak rata.
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (var gi = 0; gi < 40; gi++) {
          var gx = pl.x + ((gi * 137) % pl.w);
          var gy2 = pl.y + 40 + ((gi * 71) % Math.max(1, pl.h - 50));
          ctx.beginPath();
          ctx.arc(gx, gy2, 2 + (gi % 3), 0, Math.PI * 2);
          ctx.fill();
        }
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

    // Petunjuk arah di awal level.
    // Digambar di koordinat DUNIA (masih di dalam ctx.save/scale), di atas
    // kepala pemain. Versi lama memakai koordinat layar y=96 sehingga
    // menutupi langit dan awan.
    if (S.world.t < 3.6) {
      var pAlpha = Math.min(1, (3.6 - S.world.t) / 0.9);
      var bw = 300, bh = 44;
      var bx = camX + viewW / 2 - bw / 2;
      var by = gY - 520;
      ctx.globalAlpha = pAlpha * 0.92;
      ctx.fillStyle = '#0b1020';
      roundRect(bx, by, bw, bh, 14);
      ctx.fill();
      ctx.globalAlpha = pAlpha;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Jalan ke kanan, buka 10 gembok!', bx + bw / 2, by + 28);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Efek merah saat kena musuh (koordinat layar, setelah restore).
    if (S.world.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,60,60,' + (S.world.hitFlash * 1.2) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Gembok digambar sebagai GERBANG TERKUNCI, bukan gembok raksasa.
  // Alasannya: gembok harus setinggi 340px supaya tidak bisa dilompati
  // (lihat src/levels.js), dan gembok 340px terlihat aneh. Gerbang setinggi
  // itu justru wajar — dan memang itu yang menghalangi jalan.
  function drawLock(l) {
    var x = l.x, y = l.y, w = l.w, h = l.h;

    if (l.open) {
      // Gerbang sudah terbuka: palang kiri-kanan menyingkir, jadi pudar.
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#39d98a';
      roundRect(x, y + h * 0.30, w, h * 0.70, 10);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#0b4a2c';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, y + h * 0.58);
      ctx.lineTo(x + w * 0.45, y + h * 0.74);
      ctx.lineTo(x + w * 0.74, y + h * 0.40);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // ── Tiang gerbang (batu) ──
    ctx.fillStyle = '#8b93a8';
    roundRect(x - 5, y, w + 10, h, 8);
    ctx.fill();

    // ── Papan kayu di dalam tiang ──
    ctx.fillStyle = '#c98a4b';
    roundRect(x + 4, y + 14, w - 8, h - 14, 6);
    ctx.fill();
    // Garis papan
    ctx.strokeStyle = 'rgba(120,70,25,0.45)';
    ctx.lineWidth = 2;
    for (var py = y + 14; py < y + h - 10; py += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 6, py);
      ctx.lineTo(x + w - 6, py);
      ctx.stroke();
    }
    // Bayangan sisi kanan supaya terlihat 3D
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w - 12, y + 14, 8, h - 14);

    // ── Puncak gerbang melengkung ──
    ctx.fillStyle = '#a8b0c4';
    roundRect(x - 9, y - 10, w + 18, 22, 10);
    ctx.fill();

    // ── Gembok di tengah gerbang ──
    // Pakai sprite pixel asli dari game lama (assets/lock.webp). Kalau gagal
    // dimuat, digambar gembok vektor sederhana sebagai cadangan.
    var cx = x + w / 2;
    var cy = y + h * 0.46;
    var lockSize = Math.min(w * 0.86, 96);
    var drawnLock = drawSprite('lock', cx, cy + lockSize / 2, lockSize, false);

    if (!drawnLock) {
      var lw = w * 0.66, lh = lw * 0.78;
      ctx.strokeStyle = '#e8edf5';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy - lh * 0.52, lw * 0.34, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      roundRect(cx - lw / 2, cy - lh * 0.12, lw, lh, 9);
      ctx.fill();
      ctx.fillStyle = '#7a4a00';
      ctx.beginPath();
      ctx.arc(cx, cy + lh * 0.30, lw * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Gembok digambar sebagai GERBANG TERKUNCI, bukan gembok raksasa.
  // Alasannya: gembok harus setinggi 340px supaya tidak bisa dilompati
  // (lihat src/levels.js), dan gembok 340px terlihat aneh. Gerbang setinggi
  // itu justru wajar — dan memang itu yang menghalangi jalan.
  function drawLock(l) {
    var x = l.x, y = l.y, w = l.w, h = l.h;

    if (l.open) {
      // Gerbang sudah terbuka: palang kiri-kanan menyingkir, jadi pudar.
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#39d98a';
      roundRect(x, y + h * 0.30, w, h * 0.70, 10);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#0b4a2c';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, y + h * 0.58);
      ctx.lineTo(x + w * 0.45, y + h * 0.74);
      ctx.lineTo(x + w * 0.74, y + h * 0.40);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // ── Tiang gerbang (batu) ──
    ctx.fillStyle = '#8b93a8';
    roundRect(x - 5, y, w + 10, h, 8);
    ctx.fill();

    // ── Papan kayu di dalam tiang ──
    ctx.fillStyle = '#c98a4b';
    roundRect(x + 4, y + 14, w - 8, h - 14, 6);
    ctx.fill();
    // Garis papan
    ctx.strokeStyle = 'rgba(120,70,25,0.45)';
    ctx.lineWidth = 2;
    for (var py = y + 14; py < y + h - 10; py += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 6, py);
      ctx.lineTo(x + w - 6, py);
      ctx.stroke();
    }
    // Bayangan sisi kanan supaya terlihat 3D
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w - 12, y + 14, 8, h - 14);

    // ── Puncak gerbang melengkung ──
    ctx.fillStyle = '#a8b0c4';
    roundRect(x - 9, y - 10, w + 18, 22, 10);
    ctx.fill();

    // ── Gembok emas di tengah gerbang ──
    var cx = x + w / 2;
    var cy = y + h * 0.46;
    var lw = w * 0.66;                 // lebar badan gembok
    var lh = lw * 0.78;

    // Gagang gembok (shackle)
    ctx.strokeStyle = '#e8edf5';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy - lh * 0.52, lw * 0.34, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = '#b8c2d4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy - lh * 0.52, lw * 0.34, Math.PI, 0);
    ctx.stroke();

    // Badan gembok
    ctx.fillStyle = '#ffd24a';
    roundRect(cx - lw / 2, cy - lh * 0.12, lw, lh, 9);
    ctx.fill();
    ctx.strokeStyle = '#c47f12';
    ctx.lineWidth = 3;
    roundRect(cx - lw / 2, cy - lh * 0.12, lw, lh, 9);
    ctx.stroke();

    // Kilau
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(cx - lw / 2 + 6, cy - lh * 0.04, lw * 0.22, lh * 0.22, 4);
    ctx.fill();

    // Lubang kunci
    ctx.fillStyle = '#7a4a00';
    ctx.beginPath();
    ctx.arc(cx, cy + lh * 0.30, lw * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - lw * 0.05, cy + lh * 0.30, lw * 0.10, lh * 0.30);
  }

  function drawTrophy(t) {
    var cx = t.x + t.w / 2;
    // Piala berkilau naik-turun sedikit supaya menarik perhatian.
    var bob = Math.sin(S.world.t * 2.2) * 4;
    var drawn = drawSprite('trophy', cx, t.y + t.h + bob, t.h * 1.5, false);
    if (drawn) return;

    // Cadangan
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.moveTo(t.x + 8, t.y + 6);
    ctx.lineTo(t.x + t.w - 8, t.y + 6);
    ctx.lineTo(t.x + t.w - 14, t.y + t.h * 0.58);
    ctx.lineTo(t.x + 14, t.y + t.h * 0.58);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(e, t) {
    var cx = e.x + e.w / 2;
    var bottom = e.y + e.h;
    // Lalat melayang: naik-turun halus supaya terlihat hidup.
    var bob = Math.sin(t * 4 + e.x * 0.01) * 3;

    var drawn = drawSprite('enemy', cx, bottom + bob, e.h * 1.9, false);
    if (drawn) return;

    // Cadangan: bentuk lama.
    ctx.fillStyle = 'rgba(60,70,110,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - e.w * 0.5, e.y + e.h / 2, e.w * 0.4, e.h * 0.28, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d2f6b';
    ctx.beginPath();
    ctx.arc(cx, e.y + e.h / 2, e.w * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 4, e.y + e.h / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(p, st) {
    // Kedip saat kebal setelah kena musuh.
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;

    var cx = p.x + p.w / 2;
    var bottom = p.y + p.h;

    // Bayangan
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(cx, bottom + 2, p.w * 0.46, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pilih frame: lompat / jatuh / lari (2 frame bergantian) / diam.
    var key = 'hero_idle';
    if (!p.onGround) {
      key = 'hero_jump';
    } else if (Math.abs(p.vx) > 20) {
      // Animasi lari: ganti frame tiap ~0.11 detik.
      key = (Math.floor(st.t * 9) % 2 === 0) ? 'hero_run1' : 'hero_run2';
    } else {
      key = 'hero_idle';
    }

    // Sprite digambar lebih tinggi dari kotak tabrakan: kepala karakter
    // boleh menonjol, yang penting kakinya pas di tanah.
    var drawn = drawSprite(key, cx, bottom + 3, p.h * 1.75, p.facing < 0);

    if (!drawn) {
      // Cadangan kalau gambar gagal dimuat: blob lama, jangan sampai hilang.
      ctx.fillStyle = '#ff8fab';
      ctx.beginPath();
      ctx.ellipse(cx, p.y + p.h / 2 + 3, p.w * 0.52, p.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20143a';
      ctx.beginPath();
      ctx.arc(cx - 5, p.y + p.h / 2 - 2, 2.6, 0, Math.PI * 2);
      ctx.arc(cx + 5, p.y + p.h / 2 - 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
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
    // Musik baru boleh mulai dari klik user: browser memblokir audio
    // yang diputar otomatis tanpa interaksi.
    GK.Music.start();
    startLevel(highestUnlocked());
  });

  // Tombol mute musik di HUD.
  var btnMute = document.getElementById('btnMute');
  if (btnMute) {
    btnMute.addEventListener('click', function () {
      var m = GK.Music.toggleMute();
      btnMute.classList.toggle('off', m);
      btnMute.textContent = m ? '♪' : '♪';
      btnMute.title = m ? 'Musik mati' : 'Musik hidup';
    });
  }

  document.getElementById('btnRetry').addEventListener('click', function () {
    if (S.levelId >= GK.Levels.count && GK.Progress.isPassed(S.progress, S.levelId)) {
      goHome();
    } else if (GK.Quiz.summary(S.quiz).score >= GK.Progress.PASS_SCORE) {
      startLevel(Math.min(S.levelId + 1, GK.Levels.count));
    } else {
      retryLevel();
    }
  });

  document.getElementById('btnRetry2').addEventListener('click', function () {
    GK.Music.start();
    retryLevel();
  });
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
    // levelId opsional: default 1 supaya pemanggilan lama tetap jalan.
    autoplay: function (correctRatio, levelId) {
      var ratio = correctRatio === undefined ? 1 : correctRatio;
      startLevel(levelId || 1);
      var guard = 0;
      var p = S.world.player;

      var stuck = 0, lastX = -1, jumpHeld = 0;

      while (!S.world.won && !S.world.gameover && guard < 90000) {
        guard++;

        // Cari musuh terdekat di depan pemain pada ketinggian yang sama.
        var mustJump = false;
        for (var i = 0; i < S.world.enemies.length; i++) {
          var e = S.world.enemies[i];
          if (!e.alive) continue;
          var dx = e.x - (p.x + p.w);
          if (dx > -10 && dx < 90 && Math.abs(e.y - p.y) < 70) mustJump = true;
        }

        // Mentok = harus naik (tangga menara level 3). jumpHeld memberi jeda
        // supaya bot benar-benar mendarat di undakan, bukan melompat di tempat.
        var blockedLock = false;
        for (var b = 0; b < S.world.locks.length; b++) {
          var lk = S.world.locks[b];
          if (!lk.open && p.x + p.w > lk.x - 24 && p.x < lk.x + lk.w) blockedLock = true;
        }
        var needClimb = p.onGround && stuck > 6 && jumpHeld <= 0 && !blockedLock;

        keys.right = true;
        keys.up = (mustJump || needClimb) && p.onGround;
        if (keys.up) jumpHeld = 26;
        if (jumpHeld > 0) jumpHeld--;

        GK.Physics.step(S.world, readInput(), S.level, 1 / 60);

        if (Math.abs(p.x - lastX) < 0.5) stuck++; else stuck = 0;
        lastX = p.x;

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
  // Jeda musik saat tab tidak terlihat supaya tidak berbunyi di latar.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) GK.Music.stop();
    else if (S.scene !== 'home') GK.Music.start();
  });

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
