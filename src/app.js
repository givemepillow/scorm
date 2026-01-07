document.addEventListener('DOMContentLoaded', () => {
  const PASS_SCORE = 85;
  const slideElements = Array.from(document.querySelectorAll('.slide'));
  const infoSlides = slideElements.filter(slide => slide.dataset.type === 'info');
  const testSlide = slideElements.find(slide => slide.dataset.type === 'test');
  const totalSlides = slideElements.length;
  const testTotal = Number(testSlide.dataset.points);

  const state = {
    currentIndex: 0,
    completedSlides: new Set(),
    testScore: 0,
    testCompleted: false,
    terminated: false
  };

  let hasAPI = false;
  if (window.scorm_api) {
      const initResult = window.scorm_api.Initialize('');
      hasAPI = (initResult === 'true' || initResult === true);

      if (hasAPI) {
          const name = window.scorm_api.GetValue('cmi.learner_name');
          if (name) document.getElementById('learner-name').textContent = name;

          window.scorm_api.SetValue('cmi.completion_status', 'incomplete');
          window.scorm_api.SetValue('cmi.score.min', '0');
          window.scorm_api.SetValue('cmi.score.max', '100');
          window.scorm_api.Commit('');
      } else {
          console.warn("LMS API не найден или инициализация не удалась");
      }
  }

  const nav = document.getElementById('slide-nav');
  slideElements.forEach((slide, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.textContent = index + 1;
    btn.addEventListener('click', () => showSlide(index));
    nav.appendChild(btn);
  });

  const navButtons = Array.from(nav.querySelectorAll('.nav-btn'));
  const prevBtn = document.getElementById('prev-slide');
  const nextBtn = document.getElementById('next-slide');
  const finishBtn = document.getElementById('finish-attempt');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  const scoreSlidesTotalEl = document.getElementById('score-slides-total');
  const scoreTestTotalEl = document.getElementById('score-test-total');

  const infoTotal = infoSlides.reduce((sum, slide) => sum + Number(slide.dataset.points), 0);
  scoreSlidesTotalEl.textContent = infoTotal;
  scoreTestTotalEl.textContent = testTotal;

  document.querySelectorAll('[data-complete]').forEach(button => {
    button.addEventListener('click', () => {
      const slide = button.closest('.slide');
      const slideIndex = slideElements.indexOf(slide);
      if (!state.completedSlides.has(slideIndex)) {
        state.completedSlides.add(slideIndex);
        button.disabled = true;
        button.textContent = 'Принято';
        button.classList.add('btn-ghost');
        slide.classList.add('done');
        updateScores();
      }
      updateNav();
    });
  });

  const quizButton = document.getElementById('check-quiz');
  if (quizButton) {
      quizButton.addEventListener('click', () => {
        let score = 0;
        const quizQuestions = Array.from(document.querySelectorAll('[data-question]'));

        quizQuestions.forEach(question => {
          const points = Number(question.dataset.points);
          const correctRaw = question.dataset.correct || '';
          let isCorrect = false;

          if (question.dataset.type === 'multi') {
            const correctValues = correctRaw.split(';').sort();
            const selectedValues = Array.from(question.querySelectorAll('input:checked')).map(i => i.value).sort();
            isCorrect = (JSON.stringify(correctValues) === JSON.stringify(selectedValues));
          } else {
            const selected = question.querySelector('input:checked');
            isCorrect = selected && selected.value === correctRaw;
          }

          question.classList.remove('correct', 'wrong');
          if (question.querySelector('input:checked')) {
            question.classList.add(isCorrect ? 'correct' : 'wrong');
          }
          if (isCorrect) score += points;
        });

        state.testScore = score;
        state.testCompleted = true;
        document.getElementById('quiz-result').textContent = `Результат: ${score}/${testTotal}`;
        quizButton.disabled = true;

        updateScores();
        updateNav();
      });
  }

  prevBtn.addEventListener('click', () => showSlide(state.currentIndex - 1));
  nextBtn.addEventListener('click', () => showSlide(state.currentIndex + 1));

  finishBtn.addEventListener('click', () => {
    updateScores();

    if (hasAPI && !state.terminated) {
      window.scorm_api.Terminate('');
      state.terminated = true;

      finishBtn.disabled = true;
      finishBtn.textContent = 'Сессия закрыта';
      alert("Результаты успешно отправлены в LMS. Можно закрыть вкладку.");
    } else {
      alert("Локальный режим: оценка 100 (не отправлена).");
    }
  });

  function showSlide(index) {
    if (index < 0 || index >= slideElements.length) return;
    document.querySelector('.slide.active')?.classList.remove('active');
    state.currentIndex = index;
    slideElements[state.currentIndex].classList.add('active');

    const percent = ((state.currentIndex + 1) / totalSlides) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${state.currentIndex + 1} / ${totalSlides}`;

    updateNav();
  }

  function updateNav() {
    navButtons.forEach((btn, index) => {
      btn.classList.toggle('active', index === state.currentIndex);
      const isDone = state.completedSlides.has(index) || (index === slideElements.indexOf(testSlide) && state.testCompleted);
      btn.classList.toggle('done', isDone);
    });
  }

  function updateScores() {
    const slideScore = infoSlides.reduce((acc, slide) => {
        const idx = slideElements.indexOf(slide);
        return acc + (state.completedSlides.has(idx) ? Number(slide.dataset.points) : 0);
    }, 0);
    const totalScore = slideScore + state.testScore;

    document.getElementById('score-slides').textContent = slideScore;
    document.getElementById('score-test').textContent = state.testScore;
    document.getElementById('score-total').textContent = totalScore;

    const statusEl = document.getElementById('score-status');
    if (totalScore >= PASS_SCORE) {
        statusEl.textContent = 'ЗАЧЕТ';
        statusEl.style.color = 'var(--success-text)';
    } else {
        statusEl.textContent = `${totalScore}/100`;
        statusEl.style.color = 'var(--danger-text)';
    }

    if (hasAPI && !state.terminated) {
       window.scorm_api.SetValue('cmi.score.raw', String(totalScore));

       const scaled = (totalScore / 100).toFixed(2);
       window.scorm_api.SetValue('cmi.score.scaled', String(scaled));

       if (totalScore >= PASS_SCORE) {
           window.scorm_api.SetValue('cmi.success_status', 'passed');
           window.scorm_api.SetValue('cmi.completion_status', 'completed');
       } else {
           window.scorm_api.SetValue('cmi.success_status', 'failed');
           window.scorm_api.SetValue('cmi.completion_status', 'incomplete');
       }

       window.scorm_api.Commit('');
    }
  }

  showSlide(0);
});