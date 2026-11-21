/**
 * Auspify LMS - Interactive Quiz Timer & Assessment Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  const timerElement = document.getElementById('quizTimer');
  const quizForm = document.getElementById('quizForm');
  const timeSpentInput = document.getElementById('timeSpentSecs');

  if (!timerElement || !quizForm) return;

  const totalMinutes = parseInt(timerElement.dataset.timeLimit, 10) || 20;
  let remainingSeconds = totalMinutes * 60;
  let elapsedSeconds = 0;

  function updateTimerDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (remainingSeconds <= 120) {
      timerElement.classList.add('timer-warning');
      timerElement.style.color = '#B91C1C';
    }

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      if (timeSpentInput) timeSpentInput.value = elapsedSeconds;
      alert('Time limit reached. Your assessment answers are being automatically submitted.');
      quizForm.submit();
    }
  }

  const timerInterval = setInterval(() => {
    remainingSeconds--;
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);

  quizForm.addEventListener('submit', () => {
    clearInterval(timerInterval);
    if (timeSpentInput) {
      timeSpentInput.value = elapsedSeconds;
    }
  });

  updateTimerDisplay();
});
