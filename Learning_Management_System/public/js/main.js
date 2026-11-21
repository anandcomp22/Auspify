/**
 * Auspify LMS - Core Client Script
 * Lightweight DOM helpers with zero laggy dependencies.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile navigation toggle
  const mobileToggle = document.getElementById('mobileNavToggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // Dismiss alert notifications
  document.querySelectorAll('.alert-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const alert = e.target.closest('.alert');
      if (alert) {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 200);
      }
    });
  });

  // Dynamic lesson complete toggle via fetch if applicable
  const completeBtn = document.getElementById('btnCompleteLesson');
  if (completeBtn) {
    completeBtn.addEventListener('click', async (e) => {
      const form = completeBtn.closest('form');
      if (!form) return;
      // Normal submission handles gracefully, but this provides instant visual feedback
    });
  }
});
