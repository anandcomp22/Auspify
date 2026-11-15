const state = {
  currentTab: 'overview',
  transactions: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
  selectedTransaction: null,
  deleteTargetId: null,
  deleteTargetRef: '',
  currentUser: null,
  filters: {
    search: '',
    type: '',
    category: '',
    method: '',
    status: '',
    sort_by: 'date',
    order: 'desc'
  }
};

function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function updateUtcClock() {
  const el = document.getElementById('utc-clock');
  if (!el) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  el.textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.remove('active');
  });
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.add('active');

  if (tabId === 'overview') {
    loadOverviewData();
  } else if (tabId === 'ledger') {
    loadLedgerData();
  } else if (tabId === 'reports') {
    loadReportsData();
  }
}

async function apiRequest(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (res.status === 401) {
      state.currentUser = null;
      updateUserInterface();
      openAuthModal();
      throw new Error('Authentication required');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Request failed with code ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

async function fetchCurrentUser() {
  try {
    const user = await apiRequest('/api/auth/me');
    state.currentUser = user;
    updateUserInterface();
  } catch {
    state.currentUser = null;
    updateUserInterface();
  }
}

function updateUserInterface() {
  const userBadge = document.getElementById('header-username');
  if (userBadge) {
    userBadge.textContent = state.currentUser ? state.currentUser.username : 'SIGN IN';
  }
}

async function loadSummaryKPIs() {
  try {
    const summary = await apiRequest('/api/analytics/summary');
    const incomeEl = document.getElementById('kpi-total-income');
    const expenseEl = document.getElementById('kpi-total-expense');
    const savingsEl = document.getElementById('kpi-net-savings');
    const rateEl = document.getElementById('kpi-savings-rate');
    const densityEl = document.getElementById('kpi-txn-density');

    if (incomeEl) incomeEl.textContent = formatCurrency(summary.total_income);
    if (expenseEl) expenseEl.textContent = formatCurrency(summary.total_expense);
    if (savingsEl) {
      savingsEl.textContent = formatCurrency(summary.net_savings);
      savingsEl.className = `metric-num mono ${summary.net_savings >= 0 ? 'positive' : 'negative'}`;
    }
    if (rateEl) rateEl.textContent = `${summary.savings_rate.toFixed(1)}%`;
    if (densityEl) densityEl.textContent = summary.transaction_count;
  } catch (err) {
    console.error(err);
  }
}

async function loadOverviewData() {
  loadSummaryKPIs();
  renderTimelineChart();
  renderOverviewCategories();
  renderOverviewRecentTable();
}

async function renderTimelineChart() {
  const container = document.getElementById('overview-chart');
  if (!container) return;
  try {
    const timeline = await apiRequest('/api/analytics/timeline?months_back=6');
    container.innerHTML = '';
    if (!timeline || timeline.length === 0) {
      container.innerHTML = '<div class="mono" style="color: var(--text-muted); margin: auto;">NO TIMELINE DATA RECORDED</div>';
      return;
    }

    let maxVal = 1;
    timeline.forEach((item) => {
      if (item.income > maxVal) maxVal = item.income;
      if (item.expense > maxVal) maxVal = item.expense;
    });

    timeline.forEach((item) => {
      const incHeight = Math.max(4, Math.round((item.income / maxVal) * 140));
      const expHeight = Math.max(4, Math.round((item.expense / maxVal) * 140));

      const group = document.createElement('div');
      group.className = 'chart-bar-group';
      group.innerHTML = `
        <div class="bars-wrapper">
          <div class="bar-income" style="height: ${incHeight}px;" title="Income: ${formatCurrency(item.income)}"></div>
          <div class="bar-expense" style="height: ${expHeight}px;" title="Expense: ${formatCurrency(item.expense)}"></div>
        </div>
        <span class="bar-label">${item.period}</span>
      `;
      container.appendChild(group);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderOverviewCategories() {
  const container = document.getElementById('overview-category-list');
  if (!container) return;
  try {
    const breakdown = await apiRequest('/api/analytics/breakdown?type=expense');
    container.innerHTML = '';
    if (!breakdown || breakdown.length === 0) {
      container.innerHTML = '<div class="mono" style="color: var(--text-muted); font-size: 11px;">NO EXPENSE RECORDS FOUND</div>';
      return;
    }

    const topItems = breakdown.slice(0, 5);
    topItems.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <div class="breakdown-header">
          <span class="breakdown-cat-name">${cat.category}</span>
          <span class="breakdown-cat-value">${formatCurrency(cat.amount)} (${cat.percentage}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${Math.min(100, Math.max(2, cat.percentage))}%;"></div>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderOverviewRecentTable() {
  const tbody = document.getElementById('overview-recent-tbody');
  if (!tbody) return;
  try {
    const data = await apiRequest('/api/transactions?limit=8&sort_by=date&order=desc');
    tbody.innerHTML = '';
    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;" class="mono">NO RECENT LEDGER TRANSACTIONS</td></tr>';
      return;
    }

    data.items.forEach((txn) => {
      const tr = document.createElement('tr');
      const isIncome = txn.type === 'income';
      tr.innerHTML = `
        <td class="mono" style="cursor: pointer; color: var(--text-primary); font-weight: 600;" onclick="viewTransactionDossier(${txn.id})">${txn.reference_id}</td>
        <td class="mono">${formatDate(txn.date)}</td>
        <td><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${txn.type.toUpperCase()}</span></td>
        <td class="mono">${txn.category}</td>
        <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis;">${txn.description}</td>
        <td class="mono">${txn.payment_method}</td>
        <td><span class="badge badge-${txn.status.toLowerCase()}">${txn.status}</span></td>
        <td class="amount-col ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${formatCurrency(txn.amount)}</td>
        <td style="text-align: right;">
          <div class="action-btns">
            <button class="btn-icon" title="View Dossier" onclick="viewTransactionDossier(${txn.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="btn-icon" title="Edit Entry" onclick="openTxnModalForEdit(${txn.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadLedgerData() {
  const tbody = document.getElementById('ledger-tbody');
  if (!tbody) return;

  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    sort_by: state.filters.sort_by,
    order: state.filters.order
  });

  if (state.filters.search) params.append('search', state.filters.search);
  if (state.filters.type) params.append('type', state.filters.type);
  if (state.filters.category) params.append('category', state.filters.category);
  if (state.filters.method) params.append('payment_method', state.filters.method);
  if (state.filters.status) params.append('status', state.filters.status);

  try {
    const data = await apiRequest(`/api/transactions?${params.toString()}`);
    state.transactions = data.items;
    state.total = data.total;
    state.totalPages = data.total_pages;

    populateCategoryFilter(data.items);

    tbody.innerHTML = '';
    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;" class="mono">NO TRANSACTIONS MATCH CRITERIA</td></tr>';
      updatePaginationControls();
      return;
    }

    data.items.forEach((txn) => {
      const tr = document.createElement('tr');
      const isIncome = txn.type === 'income';
      tr.innerHTML = `
        <td class="mono" style="cursor: pointer; color: var(--text-primary); font-weight: 600;" onclick="viewTransactionDossier(${txn.id})">${txn.reference_id}</td>
        <td class="mono">${formatDate(txn.date)}</td>
        <td><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${txn.type.toUpperCase()}</span></td>
        <td class="mono">${txn.category}</td>
        <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis;">${txn.description}</td>
        <td class="mono">${txn.payment_method}</td>
        <td><span class="badge badge-${txn.status.toLowerCase()}">${txn.status}</span></td>
        <td class="amount-col ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${formatCurrency(txn.amount)}</td>
        <td style="text-align: right;">
          <div class="action-btns">
            <button class="btn-icon" title="View Dossier" onclick="viewTransactionDossier(${txn.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="btn-icon" title="Edit Entry" onclick="openTxnModalForEdit(${txn.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon delete" title="Delete Entry" onclick="confirmDeleteTxn(${txn.id}, '${txn.reference_id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updatePaginationControls();
  } catch (err) {
    console.error(err);
  }
}

function populateCategoryFilter(items) {
  const select = document.getElementById('filter-category');
  if (!select) return;
  const currentVal = select.value;
  const categories = new Set();
  items.forEach((t) => { if (t.category) categories.add(t.category); });

  const existingOptions = Array.from(select.options).map((o) => o.value);
  categories.forEach((c) => {
    if (!existingOptions.includes(c)) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    }
  });

  if (currentVal) select.value = currentVal;
}

function updatePaginationControls() {
  const startEl = document.getElementById('page-item-start');
  const endEl = document.getElementById('page-item-end');
  const totalEl = document.getElementById('page-item-total');
  const indicator = document.getElementById('page-indicator');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
  const end = Math.min(state.page * state.limit, state.total);

  if (startEl) startEl.textContent = start;
  if (endEl) endEl.textContent = end;
  if (totalEl) totalEl.textContent = state.total;
  if (indicator) indicator.textContent = `PAGE ${state.page} / ${state.totalPages || 1}`;

  if (btnPrev) btnPrev.disabled = state.page <= 1;
  if (btnNext) btnNext.disabled = state.page >= state.totalPages;
}

function setSort(column) {
  if (state.filters.sort_by === column) {
    state.filters.order = state.filters.order === 'asc' ? 'desc' : 'asc';
  } else {
    state.filters.sort_by = column;
    state.filters.order = 'desc';
  }
  state.page = 1;
  loadLedgerData();
}

async function loadReportsData() {
  loadSummaryKPIs();
  renderExpenseCategoryReport();
  renderIncomeCategoryReport();
  renderPaymentMethodsReport();
  renderTimelineAuditReport();
}

async function renderExpenseCategoryReport() {
  const container = document.getElementById('reports-expense-categories');
  const totalEl = document.getElementById('report-expense-total');
  if (!container) return;
  try {
    const list = await apiRequest('/api/analytics/breakdown?type=expense');
    container.innerHTML = '';
    let totalAmt = 0;
    list.forEach((item) => totalAmt += item.amount);
    if (totalEl) totalEl.textContent = formatCurrency(totalAmt);

    if (list.length === 0) {
      container.innerHTML = '<div class="mono" style="color: var(--text-muted); font-size: 11px;">NO EXPENSE RECORDS RECORDED</div>';
      return;
    }

    list.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <div class="breakdown-header">
          <span class="breakdown-cat-name">${cat.category} (${cat.count} txns)</span>
          <span class="breakdown-cat-value">${formatCurrency(cat.amount)} (${cat.percentage}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${Math.min(100, Math.max(2, cat.percentage))}%;"></div>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderIncomeCategoryReport() {
  const container = document.getElementById('reports-income-categories');
  const totalEl = document.getElementById('report-income-total');
  if (!container) return;
  try {
    const list = await apiRequest('/api/analytics/breakdown?type=income');
    container.innerHTML = '';
    let totalAmt = 0;
    list.forEach((item) => totalAmt += item.amount);
    if (totalEl) totalEl.textContent = formatCurrency(totalAmt);

    if (list.length === 0) {
      container.innerHTML = '<div class="mono" style="color: var(--text-muted); font-size: 11px;">NO INCOME RECORDS RECORDED</div>';
      return;
    }

    list.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <div class="breakdown-header">
          <span class="breakdown-cat-name">${cat.category} (${cat.count} txns)</span>
          <span class="breakdown-cat-value">${formatCurrency(cat.amount)} (${cat.percentage}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill income" style="width: ${Math.min(100, Math.max(2, cat.percentage))}%;"></div>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderPaymentMethodsReport() {
  const tbody = document.getElementById('reports-methods-tbody');
  if (!tbody) return;
  try {
    const list = await apiRequest('/api/analytics/payment-methods');
    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="mono" style="text-align: center; color: var(--text-muted); padding: 16px;">NO PAYMENT METHOD DATA</td></tr>';
      return;
    }

    list.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${item.method}</td>
        <td class="mono">${item.count} TRANSACTIONS</td>
        <td class="mono" style="text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderTimelineAuditReport() {
  const tbody = document.getElementById('reports-timeline-tbody');
  if (!tbody) return;
  try {
    const list = await apiRequest('/api/analytics/timeline?months_back=12');
    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="mono" style="text-align: center; color: var(--text-muted); padding: 16px;">NO PERIOD DATA AUDITED</td></tr>';
      return;
    }

    list.forEach((pt) => {
      const isPositive = pt.net >= 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono" style="font-weight: 600;">${pt.period}</td>
        <td class="amount-col income">${formatCurrency(pt.income)}</td>
        <td class="amount-col expense">${formatCurrency(pt.expense)}</td>
        <td class="amount-col ${isPositive ? 'income' : 'expense'}">${isPositive ? '+' : ''}${formatCurrency(pt.net)}</td>
        <td>
          <span class="badge ${isPositive ? 'badge-income' : 'badge-expense'}">${isPositive ? 'NET SURPLUS' : 'NET DEFICIT'}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function viewTransactionDossier(txnId) {
  try {
    const txn = await apiRequest(`/api/transactions/${txnId}`);
    state.selectedTransaction = txn;

    document.getElementById('dossier-ref-id').textContent = txn.reference_id;
    const amountEl = document.getElementById('dossier-amount');
    const isIncome = txn.type === 'income';
    amountEl.textContent = `${isIncome ? '+' : '-'}${formatCurrency(txn.amount)}`;
    amountEl.style.color = isIncome ? 'var(--accent-income)' : 'var(--accent-expense)';

    const badgeContainer = document.getElementById('dossier-class-badge');
    badgeContainer.innerHTML = `<span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${txn.type.toUpperCase()}</span>`;

    document.getElementById('dossier-category').textContent = txn.category;
    document.getElementById('dossier-date').textContent = formatDate(txn.date);
    document.getElementById('dossier-method').textContent = txn.payment_method;
    document.getElementById('dossier-status').textContent = txn.status;
    document.getElementById('dossier-desc').textContent = txn.description;
    document.getElementById('dossier-notes').textContent = txn.notes || 'No audit notes attached to record.';
    document.getElementById('dossier-created-at').textContent = formatDate(txn.created_at);

    document.getElementById('btn-dossier-edit').onclick = () => {
      closeDossier();
      openTxnModalForEdit(txn.id);
    };

    document.getElementById('btn-dossier-delete').onclick = () => {
      closeDossier();
      confirmDeleteTxn(txn.id, txn.reference_id);
    };

    const dossier = document.getElementById('side-dossier');
    if (dossier) dossier.classList.add('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeDossier() {
  const dossier = document.getElementById('side-dossier');
  if (dossier) dossier.classList.remove('open');
  state.selectedTransaction = null;
}

function openTxnModalForCreate() {
  const modal = document.getElementById('modal-transaction');
  const title = document.getElementById('modal-txn-title');
  const form = document.getElementById('form-transaction');
  if (!modal || !form) return;

  title.textContent = 'RECORD TREASURY ENTRY';
  form.reset();
  document.getElementById('form-txn-id').value = '';

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('form-txn-date').value = localIso;

  modal.classList.add('active');
}

async function openTxnModalForEdit(txnId) {
  const modal = document.getElementById('modal-transaction');
  const title = document.getElementById('modal-txn-title');
  if (!modal) return;

  try {
    const txn = await apiRequest(`/api/transactions/${txnId}`);
    title.textContent = `MODIFY ENTRY // ${txn.reference_id}`;
    document.getElementById('form-txn-id').value = txn.id;
    document.getElementById('form-txn-type').value = txn.type;
    document.getElementById('form-txn-amount').value = txn.amount;
    document.getElementById('form-txn-category').value = txn.category;
    document.getElementById('form-txn-method').value = txn.payment_method;
    document.getElementById('form-txn-desc').value = txn.description;
    document.getElementById('form-txn-status').value = txn.status;
    document.getElementById('form-txn-notes').value = txn.notes || '';

    const d = new Date(txn.date);
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('form-txn-date').value = formatted;

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeTxnModal() {
  const modal = document.getElementById('modal-transaction');
  if (modal) modal.classList.remove('active');
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const txnId = document.getElementById('form-txn-id').value;
  const payload = {
    type: document.getElementById('form-txn-type').value,
    amount: parseFloat(document.getElementById('form-txn-amount').value),
    category: document.getElementById('form-txn-category').value.trim(),
    payment_method: document.getElementById('form-txn-method').value,
    description: document.getElementById('form-txn-desc').value.trim(),
    status: document.getElementById('form-txn-status').value,
    notes: document.getElementById('form-txn-notes').value.trim() || null,
    date: new Date(document.getElementById('form-txn-date').value).toISOString()
  };

  try {
    if (txnId) {
      await apiRequest(`/api/transactions/${txnId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Record successfully updated');
    } else {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('New treasury record committed');
    }

    closeTxnModal();
    if (state.currentTab === 'overview') loadOverviewData();
    if (state.currentTab === 'ledger') loadLedgerData();
    if (state.currentTab === 'reports') loadReportsData();
    loadSummaryKPIs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteTxn(id, ref) {
  state.deleteTargetId = id;
  state.deleteTargetRef = ref;
  document.getElementById('delete-target-ref').textContent = ref;
  const modal = document.getElementById('modal-delete');
  if (modal) modal.classList.add('active');
}

function closeDeleteModal() {
  const modal = document.getElementById('modal-delete');
  if (modal) modal.classList.remove('active');
  state.deleteTargetId = null;
  state.deleteTargetRef = '';
}

async function executeDeleteTxn() {
  if (!state.deleteTargetId) return;
  try {
    await apiRequest(`/api/transactions/${state.deleteTargetId}`, {
      method: 'DELETE'
    });
    showToast(`Transaction ${state.deleteTargetRef} deleted`);
    closeDeleteModal();
    if (state.currentTab === 'overview') loadOverviewData();
    if (state.currentTab === 'ledger') loadLedgerData();
    if (state.currentTab === 'reports') loadReportsData();
    loadSummaryKPIs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAuthModal() {
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.add('active');
}

function closeAuthModal() {
  const modal = document.getElementById('modal-auth');
  if (modal) modal.classList.remove('active');
}

function setAuthMode(mode) {
  const tabLogin = document.getElementById('auth-tab-login');
  const tabReg = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('form-auth-login');
  const formReg = document.getElementById('form-auth-register');

  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
  } else {
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
    formLogin.style.display = 'none';
    formReg.style.display = 'block';
  }
}

function populateDemoCredentials() {
  document.getElementById('login-identifier').value = 'treasury_admin';
  document.getElementById('login-password').value = 'Password123!';
}

async function handleLogin(e) {
  e.preventDefault();
  const ident = document.getElementById('login-identifier').value.trim();
  const pass = document.getElementById('login-password').value;

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email: ident, password: pass })
    });
    state.currentUser = res.user;
    updateUserInterface();
    closeAuthModal();
    showToast(`Authenticated as ${res.user.username}`);
    loadOverviewData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById('reg-username').value.trim(),
    full_name: document.getElementById('reg-fullname').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    currency: 'USD'
  };

  try {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.currentUser = res.user;
    updateUserInterface();
    closeAuthModal();
    showToast(`Account registered and authenticated: ${res.user.username}`);
    loadOverviewData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function downloadFile(url) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  setInterval(updateUtcClock, 1000);
  updateUtcClock();

  fetchCurrentUser().then(() => {
    loadOverviewData();
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      const tab = link.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  const btnOpenModal = document.getElementById('btn-open-create-modal');
  if (btnOpenModal) btnOpenModal.addEventListener('click', openTxnModalForCreate);

  const formTxn = document.getElementById('form-transaction');
  if (formTxn) formTxn.addEventListener('submit', handleSaveTransaction);

  const btnConfirmDel = document.getElementById('btn-confirm-delete');
  if (btnConfirmDel) btnConfirmDel.addEventListener('click', executeDeleteTxn);

  const btnQuickExport = document.getElementById('btn-quick-export');
  if (btnQuickExport) btnQuickExport.addEventListener('click', () => downloadFile('/api/export/csv'));

  const btnExportCsvLedger = document.getElementById('btn-export-csv-ledger');
  if (btnExportCsvLedger) btnExportCsvLedger.addEventListener('click', () => downloadFile('/api/export/csv'));

  const btnExportJsonLedger = document.getElementById('btn-export-json-ledger');
  if (btnExportJsonLedger) btnExportJsonLedger.addEventListener('click', () => downloadFile('/api/export/json'));

  const btnAuth = document.getElementById('btn-auth-action');
  if (btnAuth) btnAuth.addEventListener('click', openAuthModal);

  const userBadge = document.getElementById('auth-user-badge');
  if (userBadge) userBadge.addEventListener('click', openAuthModal);

  const formLogin = document.getElementById('form-auth-login');
  if (formLogin) formLogin.addEventListener('submit', handleLogin);

  const formReg = document.getElementById('form-auth-register');
  if (formReg) formReg.addEventListener('submit', handleRegister);

  const filterSearch = document.getElementById('filter-search');
  if (filterSearch) {
    filterSearch.addEventListener('input', debounce((e) => {
      state.filters.search = e.target.value;
      state.page = 1;
      loadLedgerData();
    }, 250));
  }

  const filterType = document.getElementById('filter-type');
  if (filterType) {
    filterType.addEventListener('change', (e) => {
      state.filters.type = e.target.value;
      state.page = 1;
      loadLedgerData();
    });
  }

  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    filterCategory.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      state.page = 1;
      loadLedgerData();
    });
  }

  const filterMethod = document.getElementById('filter-method');
  if (filterMethod) {
    filterMethod.addEventListener('change', (e) => {
      state.filters.method = e.target.value;
      state.page = 1;
      loadLedgerData();
    });
  }

  const filterStatus = document.getElementById('filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.page = 1;
      loadLedgerData();
    });
  }

  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.type = '';
      state.filters.category = '';
      state.filters.method = '';
      state.filters.status = '';
      if (filterSearch) filterSearch.value = '';
      if (filterType) filterType.value = '';
      if (filterCategory) filterCategory.value = '';
      if (filterMethod) filterMethod.value = '';
      if (filterStatus) filterStatus.value = '';
      state.page = 1;
      loadLedgerData();
    });
  }

  const btnPrev = document.getElementById('btn-prev-page');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        loadLedgerData();
      }
    });
  }

  const btnNext = document.getElementById('btn-next-page');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (state.page < state.totalPages) {
        state.page++;
        loadLedgerData();
      }
    });
  }
});
