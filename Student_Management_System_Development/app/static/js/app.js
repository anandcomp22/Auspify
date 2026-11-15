const ICONS = {
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  cross: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="0"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
};

const state = {
  currentTab: 'registry',
  students: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
  selectedStudent: null,
  filters: {
    search: '',
    department: '',
    status: '',
    sort_by: 'id',
    order: 'desc'
  },
  departments: [],
  analytics: null,
  deleteTargetId: null
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? ICONS.check : ICONS.cross}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initEvents();
  loadDepartments();
  loadStudents();
  loadAnalytics();
});

function initClock() {
  const clockEl = document.getElementById('utc-clock');
  function update() {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
  }
  update();
  setInterval(update, 1000);
}

function switchTab(tabName) {
  state.currentTab = tabName;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = panel.id === `view-${tabName}` ? 'block' : 'none';
  });

  if (tabName === 'analytics') {
    loadAnalytics();
  }
}

async function loadDepartments() {
  try {
    const res = await fetch('/api/departments');
    const data = await res.json();
    state.departments = data.departments || [];

    const select = document.getElementById('filter-department');
    if (select) {
      select.innerHTML = '<option value="">All Departments</option>';
      state.departments.forEach(dept => {
        select.innerHTML += `<option value="${dept}">${dept}</option>`;
      });
    }

    ['modal-dept', 'edit-dept'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<option value="" disabled selected>Select Department</option>';
        state.departments.forEach(dept => {
          el.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
      }
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadStudents() {
  const tableBody = document.getElementById('students-table-body');
  const countEl = document.getElementById('table-count-label');

  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--text-muted); font-family: var(--font-mono);">QUERYING DATABASE...</td></tr>`;
  }

  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    sort_by: state.filters.sort_by,
    order: state.filters.order
  });

  if (state.filters.search.trim()) params.append('search', state.filters.search.trim());
  if (state.filters.department) params.append('department', state.filters.department);
  if (state.filters.status) params.append('status', state.filters.status);

  try {
    const res = await fetch(`/api/students?${params.toString()}`);
    if (!res.ok) throw new Error('Query error');
    const data = await res.json();

    state.students = data.items || [];
    state.total = data.total;
    state.totalPages = data.total_pages;

    if (countEl) {
      countEl.textContent = `DISPLAYING ${state.students.length} OF ${state.total} RECORDS`;
    }

    renderTable();
    renderPagination();

    if (state.students.length > 0) {
      if (!state.selectedStudent || !state.students.find(s => s.id === state.selectedStudent.id)) {
        selectStudent(state.students[0].id);
      } else {
        renderInspector();
      }
    } else {
      state.selectedStudent = null;
      renderInspector();
    }
  } catch (err) {
    console.error(err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #EF4444; font-family: var(--font-mono);">CONNECTION ERROR</td></tr>`;
    }
  }
}

function renderTable() {
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;

  if (state.students.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-muted);">
          <div style="font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 0.5rem;">NO MATCHING RECORDS</div>
          <div style="font-size: 0.78rem;">Try clearing search filters or selecting another department.</div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = state.students.map(s => {
    const isSelected = state.selectedStudent && state.selectedStudent.id === s.id;
    const statusClass = getStatusClass(s.enrollment_status);

    return `
      <tr class="${isSelected ? 'selected' : ''}" onclick="selectStudent(${s.id})">
        <td>
          <span class="student-id-tag">${s.student_id}</span>
        </td>
        <td>
          <div style="font-weight: 600;">${s.first_name} ${s.last_name}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${s.email}</div>
        </td>
        <td>
          <div>${s.department}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${s.degree_program}</div>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${s.enrollment_status}</span>
        </td>
        <td class="gpa-cell">
          <span style="color: ${s.gpa >= 3.5 ? '#4ADE80' : s.gpa < 2.5 ? '#FBBF24' : 'inherit'};">
            ${s.gpa.toFixed(2)}
          </span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">
          ${s.credits_completed} CR
        </td>
        <td>
          <div class="row-actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal(${s.id})">
              ${ICONS.edit}
            </button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${s.id})">
              ${ICONS.trash}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusClass(status) {
  switch (status) {
    case 'Enrolled': return 'status-enrolled';
    case 'Academic Probation': return 'status-probation';
    case 'On Leave': return 'status-leave';
    case 'Graduated': return 'status-graduated';
    default: return 'status-enrolled';
  }
}

function renderPagination() {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  container.innerHTML = `
    <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
      PAGE ${state.page} OF ${state.totalPages || 1}
    </div>
    <div style="display: flex; gap: 0.5rem;">
      <button class="btn btn-ghost btn-sm" ${state.page <= 1 ? 'disabled' : ''} onclick="changePage(${state.page - 1})">
        PREVIOUS
      </button>
      <button class="btn btn-ghost btn-sm" ${state.page >= state.totalPages ? 'disabled' : ''} onclick="changePage(${state.page + 1})">
        NEXT
      </button>
    </div>
  `;
}

function changePage(newPage) {
  if (newPage >= 1 && newPage <= state.totalPages) {
    state.page = newPage;
    loadStudents();
  }
}

function selectStudent(id) {
  const student = state.students.find(s => s.id === id);
  if (!student) return;

  state.selectedStudent = student;

  const rows = document.querySelectorAll('#students-table-body tr');
  rows.forEach(row => row.classList.remove('selected'));
  const index = state.students.findIndex(s => s.id === id);
  if (rows[index]) rows[index].classList.add('selected');

  renderInspector();
}

function renderInspector() {
  const container = document.getElementById('inspector-content');
  if (!container) return;

  const s = state.selectedStudent;
  if (!s) {
    container.innerHTML = `
      <div class="dossier-empty">
        <div style="font-family: var(--font-mono); font-size: 0.82rem; margin-bottom: 0.35rem;">NO RECORD SELECTED</div>
        <p style="font-size: 0.75rem;">Click any record in the table to view details.</p>
      </div>
    `;
    return;
  }

  const statusClass = getStatusClass(s.enrollment_status);

  container.innerHTML = `
    <div class="dossier-hero">
      <div class="label-caps" style="margin-bottom: 0.25rem;">STUDENT DOSSIER</div>
      <div class="dossier-name">${s.first_name} ${s.last_name}</div>
      <div class="dossier-id-row">
        <span class="student-id-tag">${s.student_id}</span>
        <span class="status-badge ${statusClass}">${s.enrollment_status}</span>
        <button class="btn btn-ghost btn-sm" style="padding: 0.15rem 0.4rem;" onclick="copyToClipboard('${s.student_id}')">
          ${ICONS.copy}
        </button>
      </div>
    </div>

    <div class="dossier-grid">
      <div class="dossier-field">
        <span class="field-label">DEPARTMENT</span>
        <span class="field-val" style="font-weight: 600;">${s.department}</span>
      </div>
      <div class="dossier-field">
        <span class="field-label">PROGRAM</span>
        <span class="field-val">${s.degree_program}</span>
      </div>
      <div class="dossier-field">
        <span class="field-label">YEAR</span>
        <span class="field-val">${s.academic_year}</span>
      </div>
      <div class="dossier-field">
        <span class="field-label">GPA</span>
        <span class="field-val mono" style="font-weight: 700; color: ${s.gpa >= 3.5 ? '#4ADE80' : s.gpa < 2.0 ? '#EF4444' : 'inherit'};">
          ${s.gpa.toFixed(2)} / 4.00
        </span>
      </div>
      <div class="dossier-field">
        <span class="field-label">CREDITS</span>
        <span class="field-val mono">${s.credits_completed} Credits</span>
      </div>
      <div class="dossier-field">
        <span class="field-label">ENROLLED</span>
        <span class="field-val mono">${s.enrollment_date}</span>
      </div>
      <div class="dossier-field full">
        <span class="field-label">EMAIL</span>
        <span class="field-val mono" style="font-size: 0.8rem;">${s.email}</span>
      </div>
      <div class="dossier-field full">
        <span class="field-label">PHONE</span>
        <span class="field-val mono">${s.phone}</span>
      </div>
      <div class="dossier-field full">
        <span class="field-label">FACULTY ADVISOR</span>
        <span class="field-val">${s.advisor_name || 'Unassigned'}</span>
      </div>
      <div class="dossier-field full">
        <span class="field-label">ADDRESS</span>
        <span class="field-val">${s.address || 'Not Provided'}</span>
      </div>
      <div class="dossier-field full">
        <span class="field-label">EMERGENCY CONTACT</span>
        <span class="field-val">${s.emergency_contact_name || 'None'} ${s.emergency_contact_phone ? `(${s.emergency_contact_phone})` : ''}</span>
      </div>
      ${s.notes ? `
      <div class="dossier-field full">
        <span class="field-label">NOTES</span>
        <span class="field-val" style="font-size: 0.8rem; background: var(--bg-input); padding: 0.5rem; border: 1px solid var(--border-subtle);">${s.notes}</span>
      </div>` : ''}
    </div>

    <div class="dossier-actions">
      <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="openEditModal(${s.id})">
        ${ICONS.edit} EDIT RECORD
      </button>
      <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${s.id})">
        ${ICONS.trash} DELETE
      </button>
    </div>
  `;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`COPIED ${text}`);
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics/summary');
    if (!res.ok) throw new Error('Analytics error');
    const data = await res.json();
    state.analytics = data;

    const totalEl = document.getElementById('metric-total-students');
    const enrolledEl = document.getElementById('metric-active-enrolled');
    const gpaEl = document.getElementById('metric-system-gpa');
    const honorEl = document.getElementById('metric-honor-roll');

    if (totalEl) totalEl.textContent = data.total_students;
    if (enrolledEl) enrolledEl.textContent = data.active_enrollments;
    if (gpaEl) gpaEl.textContent = data.average_system_gpa.toFixed(2);
    if (honorEl) honorEl.textContent = data.honor_roll_count;

    renderAnalyticsView(data);
  } catch (err) {
    console.error(err);
  }
}

function renderAnalyticsView(data) {
  const deptContainer = document.getElementById('analytics-department-breakdown');
  const statusContainer = document.getElementById('analytics-status-breakdown');
  if (!deptContainer || !statusContainer) return;

  const maxDept = Math.max(...data.department_distribution.map(d => d.count), 1);
  deptContainer.innerHTML = data.department_distribution.map(d => {
    const pct = ((d.count / maxDept) * 100).toFixed(0);
    return `
      <div class="data-bar-row">
        <div class="data-bar-labels">
          <span style="font-weight: 600;">${d.department}</span>
          <span class="mono">${d.count} Students · Avg GPA ${d.average_gpa.toFixed(2)}</span>
        </div>
        <div class="data-bar-track">
          <div class="data-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  const totalStatus = data.total_students || 1;
  statusContainer.innerHTML = data.status_distribution.map(s => {
    const pct = ((s.count / totalStatus) * 100).toFixed(1);
    return `
      <div class="data-bar-row">
        <div class="data-bar-labels">
          <span style="font-weight: 600;">${s.status}</span>
          <span class="mono">${s.count} (${pct}%)</span>
        </div>
        <div class="data-bar-track">
          <div class="data-bar-fill" style="width: ${pct}%; background: #4ADE80;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function openCreateModal() {
  const modal = document.getElementById('modal-create-student');
  const form = document.getElementById('form-create-student');
  if (form) form.reset();

  const idField = document.getElementById('modal-student-id');
  if (idField) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    idField.value = `AUS-${year}-${rand}`;
  }

  const dateField = document.getElementById('modal-enrollment-date');
  if (dateField) {
    dateField.value = new Date().toISOString().substring(0, 10);
  }

  if (modal) modal.classList.add('open');
}

async function handleCreateStudent(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const payload = {
    student_id: form.querySelector('#modal-student-id').value.trim(),
    first_name: form.querySelector('#modal-first-name').value.trim(),
    last_name: form.querySelector('#modal-last-name').value.trim(),
    email: form.querySelector('#modal-email').value.trim(),
    phone: form.querySelector('#modal-phone').value.trim(),
    department: form.querySelector('#modal-dept').value.trim(),
    degree_program: form.querySelector('#modal-degree').value.trim(),
    academic_year: form.querySelector('#modal-year').value.trim(),
    gpa: parseFloat(form.querySelector('#modal-gpa').value),
    credits_completed: parseInt(form.querySelector('#modal-credits').value, 10) || 0,
    enrollment_status: form.querySelector('#modal-status').value.trim(),
    enrollment_date: form.querySelector('#modal-enrollment-date').value.trim(),
    advisor_name: form.querySelector('#modal-advisor').value.trim() || null,
    address: form.querySelector('#modal-address').value.trim() || null,
    emergency_contact_name: form.querySelector('#modal-emg-name').value.trim() || null,
    emergency_contact_phone: form.querySelector('#modal-emg-phone').value.trim() || null,
    notes: form.querySelector('#modal-notes').value.trim() || null
  };

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Failed to create student record');
    }

    const created = await res.json();
    closeAllModals();
    showToast(`ENROLLED ${created.student_id}`);
    await loadStudents();
    await loadAnalytics();
    selectStudent(created.id);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function openEditModal(id) {
  try {
    const res = await fetch(`/api/students/${id}`);
    if (!res.ok) throw new Error('Could not fetch student record');
    const s = await res.json();

    const modal = document.getElementById('modal-edit-student');
    const form = document.getElementById('form-edit-student');
    if (!form || !modal) return;

    form.dataset.studentId = s.id;
    form.querySelector('#edit-student-id').value = s.student_id;
    form.querySelector('#edit-first-name').value = s.first_name;
    form.querySelector('#edit-last-name').value = s.last_name;
    form.querySelector('#edit-email').value = s.email;
    form.querySelector('#edit-phone').value = s.phone;
    form.querySelector('#edit-dept').value = s.department;
    form.querySelector('#edit-degree').value = s.degree_program;
    form.querySelector('#edit-year').value = s.academic_year;
    form.querySelector('#edit-gpa').value = s.gpa;
    form.querySelector('#edit-credits').value = s.credits_completed;
    form.querySelector('#edit-status').value = s.enrollment_status;
    form.querySelector('#edit-enrollment-date').value = s.enrollment_date;
    form.querySelector('#edit-advisor').value = s.advisor_name || '';
    form.querySelector('#edit-address').value = s.address || '';
    form.querySelector('#edit-emg-name').value = s.emergency_contact_name || '';
    form.querySelector('#edit-emg-phone').value = s.emergency_contact_phone || '';
    form.querySelector('#edit-notes').value = s.notes || '';

    modal.classList.add('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleEditStudent(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.dataset.studentId;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const payload = {
    student_id: form.querySelector('#edit-student-id').value.trim(),
    first_name: form.querySelector('#edit-first-name').value.trim(),
    last_name: form.querySelector('#edit-last-name').value.trim(),
    email: form.querySelector('#edit-email').value.trim(),
    phone: form.querySelector('#edit-phone').value.trim(),
    department: form.querySelector('#edit-dept').value.trim(),
    degree_program: form.querySelector('#edit-degree').value.trim(),
    academic_year: form.querySelector('#edit-year').value.trim(),
    gpa: parseFloat(form.querySelector('#edit-gpa').value),
    credits_completed: parseInt(form.querySelector('#edit-credits').value, 10) || 0,
    enrollment_status: form.querySelector('#edit-status').value.trim(),
    enrollment_date: form.querySelector('#edit-enrollment-date').value.trim(),
    advisor_name: form.querySelector('#edit-advisor').value.trim() || null,
    address: form.querySelector('#edit-address').value.trim() || null,
    emergency_contact_name: form.querySelector('#edit-emg-name').value.trim() || null,
    emergency_contact_phone: form.querySelector('#edit-emg-phone').value.trim() || null,
    notes: form.querySelector('#edit-notes').value.trim() || null
  };

  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Failed to update record');
    }

    const updated = await res.json();
    closeAllModals();
    showToast(`UPDATED ${updated.student_id}`);
    await loadStudents();
    await loadAnalytics();
    selectStudent(updated.id);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function openDeleteModal(id) {
  const student = state.students.find(s => s.id === id);
  if (!student) return;

  state.deleteTargetId = id;
  const modal = document.getElementById('modal-delete-student');
  const targetLabel = document.getElementById('delete-target-name');

  if (targetLabel) {
    targetLabel.textContent = `${student.first_name} ${student.last_name} (${student.student_id})`;
  }

  if (modal) modal.classList.add('open');
}

async function confirmDeleteStudent() {
  if (!state.deleteTargetId) return;

  const btn = document.getElementById('btn-confirm-delete');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/students/${state.deleteTargetId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete student');

    showToast('RECORD DELETED');
    closeAllModals();
    state.deleteTargetId = null;
    await loadStudents();
    await loadAnalytics();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.classList.remove('open');
  });
}

function exportCSV() {
  window.location.href = '/api/export/csv';
}

function initEvents() {
  const searchInput = document.getElementById('search-students');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      state.filters.search = e.target.value;
      state.page = 1;
      loadStudents();
    }, 250));
  }

  const deptSelect = document.getElementById('filter-department');
  if (deptSelect) {
    deptSelect.addEventListener('change', (e) => {
      state.filters.department = e.target.value;
      state.page = 1;
      loadStudents();
    });
  }

  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.page = 1;
      loadStudents();
    });
  }

  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'gpa_desc') {
        state.filters.sort_by = 'gpa';
        state.filters.order = 'desc';
      } else if (val === 'gpa_asc') {
        state.filters.sort_by = 'gpa';
        state.filters.order = 'asc';
      } else if (val === 'name_asc') {
        state.filters.sort_by = 'last_name';
        state.filters.order = 'asc';
      } else {
        state.filters.sort_by = 'id';
        state.filters.order = 'desc';
      }
      state.page = 1;
      loadStudents();
    });
  }

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.department = '';
      state.filters.status = '';
      state.filters.sort_by = 'id';
      state.filters.order = 'desc';
      if (searchInput) searchInput.value = '';
      if (deptSelect) deptSelect.value = '';
      if (statusSelect) statusSelect.value = '';
      if (sortSelect) sortSelect.value = 'id_desc';
      state.page = 1;
      loadStudents();
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  const createForm = document.getElementById('form-create-student');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateStudent);
  }

  const editForm = document.getElementById('form-edit-student');
  if (editForm) {
    editForm.addEventListener('submit', handleEditStudent);
  }

  const deleteBtn = document.getElementById('btn-confirm-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', confirmDeleteStudent);
  }

  document.querySelectorAll('.modal-close-btn, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    } else if (e.key === '/' && document.activeElement !== searchInput && !document.querySelector('.modal-backdrop.open')) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}
