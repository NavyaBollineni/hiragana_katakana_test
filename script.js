/* =========================================================
   JAPANESE WRITING PRACTICE — APP LOGIC
   Vanilla JS. No frameworks, no network, no build step.
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     1. CHARACTER DATA
     Rows are kept in traditional gojuon order so any
     start-row -> end-row range is a contiguous, meaningful set.
  --------------------------------------------------------- */
  const ROW_LABELS = ["A", "Ka", "Sa", "Ta", "Na", "Ha", "Ma", "Ya", "Ra", "Wa"];

  const HIRAGANA_ROWS = [
    [["a","あ"],["i","い"],["u","う"],["e","え"],["o","お"]],
    [["ka","か"],["ki","き"],["ku","く"],["ke","け"],["ko","こ"]],
    [["sa","さ"],["shi","し"],["su","す"],["se","せ"],["so","そ"]],
    [["ta","た"],["chi","ち"],["tsu","つ"],["te","て"],["to","と"]],
    [["na","な"],["ni","に"],["nu","ぬ"],["ne","ね"],["no","の"]],
    [["ha","は"],["hi","ひ"],["fu","ふ"],["he","へ"],["ho","ほ"]],
    [["ma","ま"],["mi","み"],["mu","む"],["me","め"],["mo","も"]],
    [["ya","や"],["yu","ゆ"],["yo","よ"]],
    [["ra","ら"],["ri","り"],["ru","る"],["re","れ"],["ro","ろ"]],
    [["wa","わ"],["wo","を"],["n","ん"]]
  ];

  const KATAKANA_ROWS = [
    [["a","ア"],["i","イ"],["u","ウ"],["e","エ"],["o","オ"]],
    [["ka","カ"],["ki","キ"],["ku","ク"],["ke","ケ"],["ko","コ"]],
    [["sa","サ"],["shi","シ"],["su","ス"],["se","セ"],["so","ソ"]],
    [["ta","タ"],["chi","チ"],["tsu","ツ"],["te","テ"],["to","ト"]],
    [["na","ナ"],["ni","ニ"],["nu","ヌ"],["ne","ネ"],["no","ノ"]],
    [["ha","ハ"],["hi","ヒ"],["fu","フ"],["he","ヘ"],["ho","ホ"]],
    [["ma","マ"],["mi","ミ"],["mu","ム"],["me","メ"],["mo","モ"]],
    [["ya","ヤ"],["yu","ユ"],["yo","ヨ"]],
    [["ra","ラ"],["ri","リ"],["ru","ル"],["re","レ"],["ro","ロ"]],
    [["wa","ワ"],["wo","ヲ"],["n","ン"]]
  ];

  /* ---------------------------------------------------------
     2. SOUND (synthesised — no audio files needed)
  --------------------------------------------------------- */
  const Sound = (() => {
    let ctx = null;
    let muted = localStorage.getItem("jwp-muted") === "1";

    function getCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      return ctx;
    }

    function tone(freq, duration, delay = 0, type = "sine", peak = 0.08) {
      if (muted) return;
      const c = getCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = c.currentTime + delay;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    return {
      click() { tone(720, 0.09, 0, "sine", 0.06); },
      reveal() { tone(880, 0.12, 0, "triangle", 0.07); },
      complete() {
        tone(660, 0.16, 0, "sine", 0.08);
        tone(880, 0.18, 0.14, "sine", 0.08);
        tone(1108, 0.28, 0.3, "sine", 0.09);
      },
      isMuted() { return muted; },
      toggle() {
        muted = !muted;
        localStorage.setItem("jwp-muted", muted ? "1" : "0");
        return muted;
      }
    };
  })();

  /* ---------------------------------------------------------
     3. DARK MODE
  --------------------------------------------------------- */
  const DarkMode = (() => {
    const root = document.documentElement;
    function apply(isDark) {
      root.classList.toggle("dark", isDark);
      document.getElementById("darkToggle").querySelector(".icon-moon").hidden = isDark;
      document.getElementById("darkToggle").querySelector(".icon-sun").hidden = !isDark;
    }
    function init() {
      const saved = localStorage.getItem("jwp-dark");
      const isDark = saved === null
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : saved === "1";
      apply(isDark);
    }
    function toggle() {
      const isDark = !root.classList.contains("dark");
      apply(isDark);
      localStorage.setItem("jwp-dark", isDark ? "1" : "0");
    }
    return { init, toggle };
  })();

  /* ---------------------------------------------------------
     4. HELPERS
  --------------------------------------------------------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildPool(script, startIdx, endIdx) {
    const rows = script === "hiragana" ? HIRAGANA_ROWS : KATAKANA_ROWS;
    const pool = [];
    for (let r = startIdx; r <= endIdx; r++) {
      rows[r].forEach(([romaji, kana]) => pool.push({ romaji, kana }));
    }
    return pool;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const screens = {
    home: document.getElementById("screen-home"),
    quiz: document.getElementById("screen-quiz"),
    complete: document.getElementById("screen-complete")
  };
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  /* ---------------------------------------------------------
     5. SETUP WIZARD
  --------------------------------------------------------- */
  const Wizard = (() => {
    const overlay = document.getElementById("setupOverlay");
    const steps = Array.from(document.querySelectorAll(".modal-step"));
    const dots = Array.from(document.querySelectorAll(".dot"));
    const backBtn = document.getElementById("backBtn");
    const nextBtn = document.getElementById("nextBtn");
    const startRowGrid = document.getElementById("startRowGrid");
    const endRowGrid = document.getElementById("endRowGrid");

    let current = 1;
    const TOTAL = 5;
    const state = { script: null, mode: null, startRow: null, endRow: null };
    let pool = [];

    function buildRowGrid(container, { disableBelow = -1 } = {}) {
      container.innerHTML = "";
      ROW_LABELS.forEach((label, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-card";
        btn.dataset.index = idx;
        btn.innerHTML = `<span class="choice-name">${label}</span>`;
        if (idx < disableBelow) btn.classList.add("disabled");
        container.appendChild(btn);
      });
    }

    function refreshSummary() {
      document.getElementById("sumScript").textContent =
        state.script === "hiragana" ? "Hiragana" : "Katakana";
      document.getElementById("sumMode").textContent =
        state.mode === "e2j" ? "English → Japanese" :
        state.mode === "j2e" ? "Japanese → English" : "Mixed Mode";
      document.getElementById("sumRows").textContent =
        `${ROW_LABELS[state.startRow]} → ${ROW_LABELS[state.endRow]}`;
      pool = shuffle(buildPool(state.script, state.startRow, state.endRow));
      document.getElementById("sumCount").textContent = pool.length;
    }

    function goToStep(n) {
      current = n;
      steps.forEach(s => s.classList.toggle("active", Number(s.dataset.step) === n));
      dots.forEach((d, i) => {
        d.classList.toggle("active", i === n - 1);
        d.classList.toggle("done", i < n - 1);
      });
      backBtn.disabled = n === 1;
      nextBtn.textContent = n === TOTAL ? "Start Practice" : "Next";
      updateNextEnabled();
      if (n === 4) buildRowGrid(endRowGrid, { disableBelow: state.startRow ?? 0 });
      if (n === 5) refreshSummary();
    }

    function updateNextEnabled() {
      let ok = false;
      if (current === 1) ok = !!state.script;
      else if (current === 2) ok = !!state.mode;
      else if (current === 3) ok = state.startRow !== null;
      else if (current === 4) ok = state.endRow !== null;
      else if (current === 5) ok = true;
      nextBtn.disabled = !ok;
    }

    function selectCard(container, card) {
      Array.from(container.children).forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    }

    function open() {
      overlay.classList.add("active");
      current = 1;
      state.script = null; state.mode = null; state.startRow = null; state.endRow = null;
      steps.forEach(s => s.classList.toggle("active", s.dataset.step === "1"));
      document.querySelectorAll(".choice-card.selected").forEach(c => c.classList.remove("selected"));
      buildRowGrid(startRowGrid);
      buildRowGrid(endRowGrid);
      goToStep(1);
    }

    function close() { overlay.classList.remove("active"); }

    // Step 1: script
    document.querySelectorAll('[data-field="script"]').forEach(card => {
      card.addEventListener("click", () => {
        state.script = card.dataset.value;
        selectCard(card.parentElement, card);
        Sound.click();
        updateNextEnabled();
      });
    });

    // Step 2: mode
    document.querySelectorAll('[data-field="mode"]').forEach(card => {
      card.addEventListener("click", () => {
        state.mode = card.dataset.value;
        selectCard(card.parentElement, card);
        Sound.click();
        updateNextEnabled();
      });
    });

    // Step 3: start row
    startRowGrid.addEventListener("click", e => {
      const card = e.target.closest(".choice-card");
      if (!card || card.classList.contains("disabled")) return;
      state.startRow = Number(card.dataset.index);
      if (state.endRow !== null && state.endRow < state.startRow) state.endRow = null;
      selectCard(startRowGrid, card);
      Sound.click();
      updateNextEnabled();
    });

    // Step 4: end row
    endRowGrid.addEventListener("click", e => {
      const card = e.target.closest(".choice-card");
      if (!card || card.classList.contains("disabled")) return;
      state.endRow = Number(card.dataset.index);
      selectCard(endRowGrid, card);
      Sound.click();
      updateNextEnabled();
    });

    document.getElementById("shuffleAgainBtn").addEventListener("click", () => {
      pool = shuffle(pool);
      Sound.click();
      const btn = document.getElementById("shuffleAgainBtn");
      btn.classList.remove("shake"); void btn.offsetWidth; btn.classList.add("shake");
    });

    backBtn.addEventListener("click", () => { if (current > 1) goToStep(current - 1); });
    nextBtn.addEventListener("click", () => {
      if (current < TOTAL) { goToStep(current + 1); }
      else { close(); Quiz.start(state, pool); }
    });
    document.getElementById("closeModalBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

    document.getElementById("startQuizBtn").addEventListener("click", open);

    return { open, close };
  })();

  /* ---------------------------------------------------------
     6. QUIZ ENGINE
  --------------------------------------------------------- */
  const Quiz = (() => {
    const quizQuestion = document.getElementById("quizQuestion");
    const quizAnswer = document.getElementById("quizAnswer");
    const quizPromptLabel = document.getElementById("quizPromptLabel");
    const hankoStamp = document.getElementById("hankoStamp");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("quizProgressText");
    const timerEl = document.getElementById("quizTimer");
    const quizCard = document.getElementById("quizCard");

    const showAnswerBtn = document.getElementById("showAnswerBtn");
    const nextQBtn = document.getElementById("nextQBtn");
    const prevBtn = document.getElementById("prevBtn");
    const exitBtn = document.getElementById("quizExitBtn");
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    let pool = [];
    let directions = [];
    let index = 0;
    let revealed = false;
    let mode = "e2j";
    let script = "hiragana";
    let timerHandle = null;
    let elapsed = 0;

    function directionFor(i) {
      if (mode === "mixed") return directions[i];
      return mode;
    }

    function render() {
      revealed = false;
      hankoStamp.classList.remove("show");
      const item = pool[index];
      const dir = directionFor(index);

      if (dir === "e2j") {
        quizPromptLabel.textContent = "Write in Japanese";
        quizQuestion.textContent = item.romaji;
        quizAnswer.textContent = item.kana;
      } else {
        quizPromptLabel.textContent = "Write in Romaji";
        quizQuestion.textContent = item.kana;
        quizAnswer.textContent = item.romaji;
      }

      quizCard.classList.remove("fade-in");
      void quizCard.offsetWidth;
      quizCard.classList.add("fade-in");

      progressText.textContent = `${index + 1} / ${pool.length}`;
      progressFill.style.width = `${((index + 1) / pool.length) * 100}%`;
      prevBtn.disabled = index === 0;
      nextQBtn.textContent = index === pool.length - 1 ? "Finish" : "Next";
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      hankoStamp.classList.add("show");
      Sound.reveal();
    }

    function next() {
      if (index < pool.length - 1) {
        index++;
        render();
      } else {
        finishLesson();
      }
    }

    function prev() {
      if (index > 0) {
        index--;
        render();
      }
    }

    function startTimer() {
      elapsed = 0;
      timerEl.textContent = fmtTime(0);
      clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        elapsed++;
        timerEl.textContent = fmtTime(elapsed);
      }, 1000);
    }
    function stopTimer() { clearInterval(timerHandle); }

    function start(setupState, generatedPool) {
      script = setupState.script;
      mode = setupState.mode;
      pool = generatedPool;
      directions = pool.map(() => (Math.random() < 0.5 ? "e2j" : "j2e"));
      index = 0;
      showScreen("quiz");
      startTimer();
      render();
    }

    function finishLesson() {
      stopTimer();
      Sound.complete();
      document.getElementById("completeStats").textContent =
        `${pool.length} characters · ${fmtTime(elapsed)} · ${script === "hiragana" ? "Hiragana" : "Katakana"}`;
      showScreen("complete");
    }

    function exitToHome() {
      stopTimer();
      showScreen("home");
    }

    function restartSameLesson() {
      index = 0;
      directions = pool.map(() => (Math.random() < 0.5 ? "e2j" : "j2e"));
      pool = shuffle(pool);
      showScreen("quiz");
      startTimer();
      render();
    }

    showAnswerBtn.addEventListener("click", () => { reveal(); });
    nextQBtn.addEventListener("click", () => { Sound.click(); next(); });
    prevBtn.addEventListener("click", () => { Sound.click(); prev(); });
    exitBtn.addEventListener("click", () => { Sound.click(); exitToHome(); });

    fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    document.addEventListener("keydown", e => {
      if (!screens.quiz.classList.contains("active")) return;
      if (e.code === "Space") { e.preventDefault(); next(); }
      else if (e.key === "s" || e.key === "S") { reveal(); }
      else if (e.key === "ArrowLeft") { prev(); }
      else if (e.key === "Escape") { exitToHome(); }
    });

    document.getElementById("practiceAgainBtn").addEventListener("click", () => {
      Sound.click();
      restartSameLesson();
    });
    document.getElementById("homeBtn").addEventListener("click", () => {
      Sound.click();
      showScreen("home");
    });

    return { start };
  })();

  /* ---------------------------------------------------------
     7. GLOBAL CONTROLS
  --------------------------------------------------------- */
  document.getElementById("darkToggle").addEventListener("click", () => {
    Sound.click();
    DarkMode.toggle();
  });

  document.getElementById("muteToggle").addEventListener("click", () => {
    const btn = document.getElementById("muteToggle");
    const nowMuted = Sound.toggle();
    btn.querySelector(".icon-sound-on").hidden = nowMuted;
    btn.querySelector(".icon-sound-off").hidden = !nowMuted;
    if (!nowMuted) Sound.click();
  });

  // Initial mute icon state
  (function initMuteIcon() {
    const btn = document.getElementById("muteToggle");
    const muted = Sound.isMuted();
    btn.querySelector(".icon-sound-on").hidden = muted;
    btn.querySelector(".icon-sound-off").hidden = !muted;
  })();

  DarkMode.init();
})();
