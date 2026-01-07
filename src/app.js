document.addEventListener('DOMContentLoaded', () => {
  const PASS_SCORE = 85; // Порог сдачи по заданию
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

  // Проверка соединения с LMS
  const hasAPI = window.scorm_api && window.scorm_api.Initialize('') === 'true';
  const learnerNameEl = document.getElementById('learner-name');

  if (hasAPI) {
    // В SCORM 2004 имя: cmi.learner_name
    const name = window.scorm_api.GetValue('cmi.learner_name') || 'Студент';
    learnerNameEl.textContent = name;
  }

  // Генерация навигации
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

  // Элементы табло
  const scoreSlidesEl = document.getElementById('score-slides');
  const scoreSlidesTotalEl = document.getElementById('score-slides-total');
  const scoreTestEl = document.getElementById('score-test');
  const scoreTestTotalEl = document.getElementById('score-test-total');
  const scoreTotalEl = document.getElementById('score-total');
  const scoreStatusEl = document.getElementById('score-status');

  // Расчет максимума (31)
  const infoTotal = infoSlides.reduce((sum, slide) => sum + Number(slide.dataset.points), 0);
  scoreSlidesTotalEl.textContent = infoTotal;
  scoreTestTotalEl.textContent = testTotal;

  // Обработка кнопок "Засчитать слайд"
  document.querySelectorAll('[data-complete]').forEach(button => {
    button.addEventListener('click', () => {
      const slide = button.closest('.slide');
      const slideIndex = slideElements.indexOf(slide);
      if (!state.completedSlides.has(slideIndex)) {
        state.completedSlides.add(slideIndex);
        button.disabled = true;
        button.textContent = 'Засчитано';
        slide.classList.add('done');
      }
      updateScores();
      updateNav();
    });
  });

  // Обработка Теста
  const quizButton = document.getElementById('check-quiz');
  const quizResult = document.getElementById('quiz-result');
  const quizQuestions = Array.from(document.querySelectorAll('[data-question]'));

  quizButton.addEventListener('click', () => {
    let score = 0;
    quizQuestions.forEach(question => {
      const points = Number(question.dataset.points);
      const correctRaw = question.dataset.correct || '';
      let isCorrect = false;

      if (question.dataset.type === 'multi') {
        const correctValues = correctRaw.split(';').sort();
        const selectedValues = Array.from(question.querySelectorAll('input:checked')).map(input => input.value).sort();
        isCorrect = selectedValues.length === correctValues.length && selectedValues.every((v, i) => v === correctValues[i]);
      } else {
        const selected = question.querySelector('input:checked');
        isCorrect = selected && selected.value === correctRaw;
      }

      // Визуализация
      question.classList.remove('correct', 'wrong');
      if (question.querySelector('input:checked')) {
        question.classList.add(isCorrect ? 'correct' : 'wrong');
      }

      if (isCorrect) score += points;
    });

    state.testScore = score;
    state.testCompleted = true;
    quizResult.textContent = `Итог теста: ${score} из ${testTotal}`;
    quizButton.disabled = true;
    updateScores();
    updateNav();
  });

  prevBtn.addEventListener('click', () => showSlide(state.currentIndex - 1));
  nextBtn.addEventListener('click', () => showSlide(state.currentIndex + 1));

  // ЗАВЕРШЕНИЕ
  finishBtn.addEventListener('click', () => {
    updateScores();
    if (hasAPI && !state.terminated) {
      const totalScore = Number(scoreTotalEl.textContent);
      const success = totalScore >= PASS_SCORE ? 'passed' : 'failed';

      // Отправляем статусы SCORM 2004
      window.scorm_api.SetValue('cmi.success_status', success);
      window.scorm_api.SetValue('cmi.completion_status', 'completed');
      window.scorm_api.Terminate('');

      state.terminated = true;
      finishBtn.disabled = true;
      finishBtn.textContent = 'Отправлено в Moodle';
      alert(`Данные отправлены. Оценка: ${totalScore}. Статус: ${success}`);
    } else if (!hasAPI) {
        alert("Режим просмотра без LMS. Оценка не отправлена.");
    }
  });

  function showSlide(index) {
    if (index < 0 || index >= slideElements.length) return;
    if (slideElements[state.currentIndex]) slideElements[state.currentIndex].classList.remove('active');
    state.currentIndex = index;
    slideElements[state.currentIndex].classList.add('active');
    updateProgress();
    updateNav();
  }

  function updateProgress() {
    const percent = ((state.currentIndex + 1) / totalSlides) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Слайд ${state.currentIndex + 1} из ${totalSlides}`;
  }

  function updateNav() {
    navButtons.forEach((btn, index) => {
      btn.classList.toggle('active', index === state.currentIndex);
      const isTest = (slideElements[index].dataset.type === 'test');
      const isDone = state.completedSlides.has(index) || (isTest && state.testCompleted);
      btn.classList.toggle('done', isDone);
    });
  }

  function updateScores() {
    const slideScore = infoSlides.reduce((acc, slide) => {
        const idx = slideElements.indexOf(slide);
        return acc + (state.completedSlides.has(idx) ? Number(slide.dataset.points) : 0);
    }, 0);

    const totalScore = slideScore + state.testScore;

    scoreSlidesEl.textContent = slideScore;
    scoreTestEl.textContent = state.testScore;
    scoreTotalEl.textContent = totalScore;

    if (totalScore >= PASS_SCORE) {
      scoreStatusEl.textContent = 'ЗАЧЕТ';
      scoreStatusEl.style.color = 'var(--success)';
    } else {
      const missing = PASS_SCORE - totalScore;
      scoreStatusEl.textContent = `еще ${missing}`;
      scoreStatusEl.style.color = 'var(--warning)';
    }

    if (hasAPI && !state.terminated) {
       window.scorm_api.SetValue('cmi.score.raw', String(totalScore));
       window.scorm_api.SetValue('cmi.score.min', '0');
       window.scorm_api.SetValue('cmi.score.max', '100');
       // SCORM 2004 требует scaled (от 0 до 1)
       window.scorm_api.SetValue('cmi.score.scaled', String(totalScore / 100));
       window.scorm_api.Commit('');
    }
  }

  showSlide(0);
});