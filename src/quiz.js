(function (G) {
  'use strict';

  const PER_QUESTION = 10;
  const MAX_LIVES = 3;

  function create(levelId, questions) {
    return {
      levelId: levelId,
      questions: questions,
      index: 0,
      answers: [],
      open: false,     // soal sedang tampil di layar?
      locked: false,   // sudah dijawab, menunggu tombol "Lanjut"?
      done: false,     // semua soal sudah dijawab?
      lastCorrect: null
    };
  }

  function current(s) {
    return s.questions[s.index] || null;
  }

  function isCorrect(s, choice) {
    const q = current(s);
    return !!q && q.correct === choice;
  }

  function answer(s, choice) {
    if (!s.open || s.done) return s;
    const q = current(s);
    const ok = q.correct === choice;
    s.answers.push({
      id: q.id, choice: choice, correct: ok, prompt: q.prompt, explain: q.explain,
      // Teks jawaban disimpan supaya layar hasil bisa menampilkan
      // "kamu pilih 2⁶ · yang benar 2⁵" — bukan cuma ✓/✗ tanpa penjelasan.
      choiceText: q.options[choice],
      correctText: q.options[q.correct]
    });
    s.lastCorrect = ok;
    s.open = false;
    s.locked = true;
    s.index += 1;
    if (s.index >= s.questions.length) s.done = true;
    return s;
  }

  function next(s) {
    if (!s.locked) return s;
    s.locked = false;
    s.lastCorrect = null;
    if (!s.done) s.open = true;
    return s;
  }

  function score(s) {
    return s.answers.filter(function (a) { return a.correct; }).length * PER_QUESTION;
  }

  function correctCount(s) {
    return s.answers.filter(function (a) { return a.correct; }).length;
  }

  function wrongCount(s) {
    return s.answers.filter(function (a) { return !a.correct; }).length;
  }

  function summary(s) {
    return {
      levelId: s.levelId,
      score: score(s),
      max: s.questions.length * PER_QUESTION,
      correct: correctCount(s),
      wrong: wrongCount(s),
      answers: s.answers.slice()
    };
  }

  G.Quiz = {
    create, current, answer, next, isCorrect, score, correctCount, wrongCount, summary,
    PER_QUESTION, MAX_LIVES
  };
})(globalThis.GK = globalThis.GK || {});
