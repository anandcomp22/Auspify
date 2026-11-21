/**
 * HireScope Client Interactions
 * Editorial micro-interactions and utilitarian UI handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Navigation Toggle
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.mobile-nav-toggle');

  if (navToggle && header) {
    navToggle.addEventListener('click', () => {
      header.classList.toggle('nav-open');
    });
  }

  // 2. Flash Message Auto-Dismiss
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    // Add dismiss button functionality
    const dismissBtn = alert.querySelector('.alert-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        alert.remove();
      });
    }

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      alert.style.transition = 'opacity 300ms ease, transform 300ms ease';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-4px)';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });

  // 3. Confirm Dialog on Destructive Actions
  const confirmElements = document.querySelectorAll('[data-confirm]');
  confirmElements.forEach((el) => {
    el.addEventListener('submit', (e) => {
      const message = el.getAttribute('data-confirm') || 'Are you sure you want to proceed?';
      if (!window.confirm(message)) {
        e.preventDefault();
      }
    });
  });

  // 4. Registration Role Selector Handler
  const roleRadios = document.querySelectorAll('input[name="role"]');
  const employerFieldGroup = document.getElementById('employer-specific-fields');

  if (roleRadios.length > 0 && employerFieldGroup) {
    const handleRoleChange = () => {
      const selected = document.querySelector('input[name="role"]:checked');
      if (selected && selected.value === 'employer') {
        employerFieldGroup.style.display = 'block';
        const companyInput = employerFieldGroup.querySelector('input[name="company"]');
        if (companyInput) companyInput.setAttribute('required', 'required');
      } else {
        employerFieldGroup.style.display = 'none';
        const companyInput = employerFieldGroup.querySelector('input[name="company"]');
        if (companyInput) companyInput.removeAttribute('required');
      }
    };

    roleRadios.forEach((r) => r.addEventListener('change', handleRoleChange));
    handleRoleChange(); // Initial check
  }

  // 5. File Upload Input Display
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach((input) => {
    input.addEventListener('change', (e) => {
      const label = document.querySelector(`label[for="${input.id}"] .file-name-target`);
      if (label && e.target.files && e.target.files[0]) {
        label.textContent = e.target.files[0].name;
      }
    });
  });

  // 6. Filter Auto-Submit on select changes if configured
  const autoFilterSelects = document.querySelectorAll('.auto-submit-filter');
  autoFilterSelects.forEach((select) => {
    select.addEventListener('change', () => {
      select.form.submit();
    });
  });
});
