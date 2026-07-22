/* =========================================================
   WEALTHFOLIO — Expense Tracker
   Vanilla JS (ES6) — state, rendering, charts, interactions
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     0. STORAGE LAYER
     Wraps localStorage with a safe in-memory fallback so the
     app keeps working even in environments that block storage.
  --------------------------------------------------------- */
  const memoryStore = {};
  const Storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
      } catch (e) {
        return key in memoryStore ? memoryStore[key] : fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        memoryStore[key] = value;
      }
    }
  };

  const STORAGE_KEY = 'wealthfolio.transactions';
  const BUDGET_KEY = 'wealthfolio.budget';
  const THEME_KEY = 'wealthfolio.theme';

  /* ---------------------------------------------------------
     1. SEED DATA (used only the very first time the app runs)
  --------------------------------------------------------- */
  function seedData() {
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().slice(0, 10);
    };
    return [
      { id: cryptoId(), title: 'Monthly Salary', amount: 65000, category: 'Salary', type: 'income', date: d(2) },
      { id: cryptoId(), title: 'Freelance Project', amount: 12000, category: 'Investment', type: 'income', date: d(5) },
      { id: cryptoId(), title: 'Grocery Shopping', amount: 3400, category: 'Food', type: 'expense', date: d(1) },
      { id: cryptoId(), title: 'Uber Rides', amount: 850, category: 'Transport', type: 'expense', date: d(3) },
      { id: cryptoId(), title: 'Electricity Bill', amount: 2200, category: 'Bills', type: 'expense', date: d(6) },
      { id: cryptoId(), title: 'Movie Night', amount: 900, category: 'Entertainment', type: 'expense', date: d(8) },
      { id: cryptoId(), title: 'Sneakers', amount: 4500, category: 'Shopping', type: 'expense', date: d(10) },
      { id: cryptoId(), title: 'Pharmacy', amount: 650, category: 'Health', type: 'expense', date: d(12) },
      { id: cryptoId(), title: 'Mutual Fund SIP', amount: 5000, category: 'Investment', type: 'expense', date: d(15) },
      { id: cryptoId(), title: 'Dinner Out', amount: 1600, category: 'Food', type: 'expense', date: d(18) }
    ];
  }

  function cryptoId() {
    return 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------------------------------------------------
     2. STATE
  --------------------------------------------------------- */
  let transactions = Storage.get(STORAGE_KEY, null);
  if (!transactions) {
    transactions = seedData();
    Storage.set(STORAGE_KEY, transactions);
  }

  let monthlyBudget = Storage.get(BUDGET_KEY, 40000);

  const CATEGORY_ICONS = {
    Food: 'fa-utensils', Transport: 'fa-car', Shopping: 'fa-bag-shopping',
    Bills: 'fa-file-invoice-dollar', Health: 'fa-briefcase-medical',
    Entertainment: 'fa-film', Salary: 'fa-briefcase', Investment: 'fa-chart-line',
    Other: 'fa-circle-dot'
  };

  const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  /* ---------------------------------------------------------
     3. DOM REFS
  --------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    navbar: $('#navbar'),
    navLinks: $('#nav-links'),
    hamburger: $('#hamburger'),
    themeToggle: $('#theme-toggle'),
    form: $('#transaction-form'),
    title: $('#f-title'), amount: $('#f-amount'), category: $('#f-category'), date: $('#f-date'),
    errTitle: $('#err-title'), errAmount: $('#err-amount'), errDate: $('#err-date'),
    typeButtons: $$('.type-btn'),
    resetBtn: $('#reset-form'),
    txList: $('#transaction-list'),
    emptyState: $('#empty-state'),
    searchInput: $('#search-input'),
    filterType: $('#filter-type'),
    filterCategory: $('#filter-category'),
    sortBy: $('#sort-by'),
    fab: $('#fab-add'),
    toastStack: $('#toast-stack'),
    exportBtn: $('#export-csv-btn'),
    printBtn: $('#print-btn'),
    budgetRing: $('#budget-ring-progress'),
    budgetPercent: $('#budget-percent'),
    budgetUsed: $('#budget-used'),
    budgetTotal: $('#budget-total'),
    editBudgetBtn: $('#edit-budget-btn'),
    budgetModal: $('#budget-modal'),
    budgetInput: $('#budget-input'),
    budgetSave: $('#budget-save'),
    budgetCancel: $('#budget-cancel'),
    recentTimeline: $('#recent-timeline'),
    insightsGrid: $('#insights-grid'),
    loader: $('#page-loader'),
    footerYear: $('#footer-year')
  };

  let currentType = 'expense';
  let editingId = null;

  /* ---------------------------------------------------------
     4. DERIVED TOTALS
  --------------------------------------------------------- */
  function computeTotals() {
    let income = 0, expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    });
    return { income, expense, balance: income - expense, savings: income - expense };
  }

  /* ---------------------------------------------------------
     5. COUNT-UP ANIMATION
  --------------------------------------------------------- */
  function countUp(el, target, prefix = '₹', duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(start + (target - start) * eased);
      el.textContent = prefix + value.toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + Math.round(target).toLocaleString('en-IN');
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     6. RENDER: DASHBOARD STATS
  --------------------------------------------------------- */
  function renderStats() {
    const { income, expense, balance, savings } = computeTotals();
    countUp($('#stat-balance'), balance);
    countUp($('#stat-income'), income);
    countUp($('#stat-expense'), expense);
    countUp($('#stat-savings'), savings);

    $('#chip-balance').textContent = balance >= 0 ? 'Healthy' : 'Negative';
    $('#chip-income').textContent = `${transactions.filter(t => t.type === 'income').length} entries`;
    $('#chip-expense').textContent = `${transactions.filter(t => t.type === 'expense').length} entries`;
    $('#chip-savings').textContent = income > 0 ? Math.round((savings / income) * 100) + '% rate' : '—';
  }

  /* ---------------------------------------------------------
     7. RENDER: BUDGET RING
  --------------------------------------------------------- */
  function renderBudget() {
    const { expense } = computeTotals();
    const pct = monthlyBudget > 0 ? Math.min(expense / monthlyBudget, 1) : 0;
    const circumference = 2 * Math.PI * 70;
    const offset = circumference - pct * circumference;
    els.budgetRing.style.strokeDasharray = circumference;
    requestAnimationFrame(() => { els.budgetRing.style.strokeDashoffset = offset; });
    els.budgetRing.style.stroke = pct >= 1 ? 'var(--expense, #EF4444)' : (pct > 0.8 ? '#F59E0B' : 'var(--primary, #6366F1)');
    els.budgetPercent.textContent = Math.round(pct * 100) + '%';
    els.budgetUsed.textContent = rupee(expense);
    els.budgetTotal.textContent = rupee(monthlyBudget);
  }

  /* ---------------------------------------------------------
     8. RENDER: RECENT ACTIVITY TIMELINE
  --------------------------------------------------------- */
  function renderTimeline() {
    const recent = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      els.recentTimeline.innerHTML = '<li class="timeline-empty">No activity yet.</li>';
      return;
    }

    els.recentTimeline.innerHTML = recent.map(t => `
      <li class="timeline-item ${t.type}">
        <div class="timeline-dot"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-circle-dot'}"></i></div>
        <div class="timeline-body">
          <div class="timeline-row">
            <div>
              <div class="timeline-title">${escapeHtml(t.title)}</div>
              <div class="timeline-meta">${formatDate(t.date)} · ${t.category}</div>
            </div>
            <div class="timeline-amt ${t.type}">${t.type === 'income' ? '+' : '−'}${rupee(t.amount)}</div>
          </div>
        </div>
      </li>
    `).join('');
  }

  /* ---------------------------------------------------------
     9. RENDER: QUICK INSIGHTS
  --------------------------------------------------------- */
  function renderInsights() {
    if (transactions.length === 0) {
      els.insightsGrid.innerHTML = '<div class="insight-item"><div class="insight-label">No data</div><div class="insight-value">Add a transaction</div></div>';
      return;
    }
    const expenses = transactions.filter(t => t.type === 'expense');
    const incomes = transactions.filter(t => t.type === 'income');

    const highestExpense = expenses.reduce((max, t) => Number(t.amount) > Number(max?.amount || 0) ? t : max, null);
    const highestIncome = incomes.reduce((max, t) => Number(t.amount) > Number(max?.amount || 0) ? t : max, null);

    const catTotals = {};
    expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount); });
    const biggestCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    const dates = transactions.map(t => t.date).sort();
    const daySpan = dates.length ? Math.max(1, Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000) + 1) : 1;
    const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const avgDaily = totalExpense / daySpan;

    const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);
    const monthlySavings = totalIncome - totalExpense;

    const items = [
      { label: 'Highest Expense', value: highestExpense ? rupee(highestExpense.amount) : '—' },
      { label: 'Highest Income', value: highestIncome ? rupee(highestIncome.amount) : '—' },
      { label: 'Top Category', value: biggestCategory ? biggestCategory[0] : '—' },
      { label: 'Avg. Daily Spend', value: rupee(avgDaily) },
      { label: 'Monthly Savings', value: rupee(monthlySavings) },
      { label: 'Total Transactions', value: transactions.length }
    ];

    els.insightsGrid.innerHTML = items.map(i => `
      <div class="insight-item">
        <div class="insight-label">${i.label}</div>
        <div class="insight-value">${i.value}</div>
      </div>
    `).join('');
  }

  /* ---------------------------------------------------------
     10. RENDER: TRANSACTION LIST (filter, search, sort)
  --------------------------------------------------------- */
  function populateCategoryFilter() {
    const cats = Array.from(new Set(transactions.map(t => t.category))).sort();
    const current = els.filterCategory.value;
    els.filterCategory.innerHTML = '<option value="all">All categories</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (cats.includes(current)) els.filterCategory.value = current;
  }

  function getFilteredTransactions() {
    const q = els.searchInput.value.trim().toLowerCase();
    const type = els.filterType.value;
    const cat = els.filterCategory.value;
    const sort = els.sortBy.value;

    let list = transactions.filter(t => {
      const matchesQuery = !q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      const matchesType = type === 'all' || t.type === type;
      const matchesCat = cat === 'all' || t.category === cat;
      return matchesQuery && matchesType && matchesCat;
    });

    list.sort((a, b) => {
      switch (sort) {
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'amount-desc': return Number(b.amount) - Number(a.amount);
        case 'amount-asc': return Number(a.amount) - Number(b.amount);
        default: return new Date(b.date) - new Date(a.date);
      }
    });

    return list;
  }

  function renderTransactionList() {
    populateCategoryFilter();
    const list = getFilteredTransactions();

    if (transactions.length === 0) {
      els.txList.innerHTML = '';
      els.emptyState.hidden = false;
      return;
    }
    els.emptyState.hidden = true;

    if (list.length === 0) {
      els.txList.innerHTML = '<p class="timeline-empty">No transactions match your filters.</p>';
      return;
    }

    els.txList.innerHTML = list.map(t => `
      <div class="tx-card ${t.type}" data-id="${t.id}">
        <div class="tx-icon"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-circle-dot'}"></i></div>
        <div class="tx-info">
          <div class="tx-title">${escapeHtml(t.title)}</div>
          <div class="tx-meta">
            <span>${formatDate(t.date)}</span>
            <span>·</span>
            <span>${t.category}</span>
            <span class="tx-badge">${t.type}</span>
          </div>
        </div>
        <div class="tx-amount">${t.type === 'income' ? '+' : '−'}${rupee(t.amount)}</div>
        <div class="tx-actions">
          <button class="tx-action-btn edit" data-action="edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="tx-action-btn delete" data-action="delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  /* ---------------------------------------------------------
     11. CHARTS
  --------------------------------------------------------- */
  let charts = {};

  function chartColors() {
    const dark = document.body.classList.contains('dark');
    return {
      text: dark ? '#94A3B8' : '#64748B',
      grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
    };
  }

  function buildCharts() {
    const c = chartColors();
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = c.text;

    const expenses = transactions.filter(t => t.type === 'expense');
    const catTotals = {};
    expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount); });
    const catLabels = Object.keys(catTotals);
    const catValues = Object.values(catTotals);
    const palette = ['#6366F1', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#64748B'];

    // Pie: expense categories
    charts.pie?.destroy();
    charts.pie = new Chart($('#chart-pie'), {
      type: 'doughnut',
      data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: palette, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } }, animation: { animateScale: true } }
    });

    // Bar: income vs expense
    const { income, expense } = computeTotals();
    charts.bar?.destroy();
    charts.bar = new Chart($('#chart-bar'), {
      type: 'bar',
      data: {
        labels: ['Income', 'Expense'],
        datasets: [{ data: [income, expense], backgroundColor: ['#22C55E', '#EF4444'], borderRadius: 10, maxBarThickness: 70 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: c.grid }, ticks: { callback: v => '₹' + v } } }
      }
    });

    // Line: monthly trend
    const monthMap = {};
    transactions.forEach(t => {
      const key = t.date.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
      monthMap[key][t.type] += Number(t.amount);
    });
    const months = Object.keys(monthMap).sort();
    const monthLabels = months.map(m => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));

    charts.line?.destroy();
    charts.line = new Chart($('#chart-line'), {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          { label: 'Income', data: months.map(m => monthMap[m].income), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)', fill: true, tension: 0.4 },
          { label: 'Expense', data: months.map(m => monthMap[m].expense), borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: c.grid }, ticks: { callback: v => '₹' + v } } }
      }
    });

    // Breakdown: horizontal bar of categories
    charts.breakdown?.destroy();
    charts.breakdown = new Chart($('#chart-breakdown'), {
      type: 'bar',
      data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: palette, borderRadius: 8 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: c.grid }, ticks: { callback: v => '₹' + v } }, y: { grid: { display: false } } }
      }
    });
  }

  /* ---------------------------------------------------------
     12. FULL RENDER PIPELINE
  --------------------------------------------------------- */
  function renderAll() {
    renderStats();
    renderBudget();
    renderTimeline();
    renderInsights();
    renderTransactionList();
    buildCharts();
  }

  /* ---------------------------------------------------------
     13. TOASTS
  --------------------------------------------------------- */
  function toast(message, type = 'info') {
    const icons = { success: 'fa-check', error: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="toast-icon"><i class="fa-solid ${icons[type]}"></i></div>
      <span>${message}</span>
    `;
    els.toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 350);
    }, 3200);
  }

  /* ---------------------------------------------------------
     14. FORM: VALIDATION + SUBMIT
  --------------------------------------------------------- */
  function clearErrors() {
    [els.errTitle, els.errAmount, els.errDate].forEach(e => e.textContent = '');
    [els.title, els.amount, els.date].forEach(e => e.classList.remove('invalid'));
  }

  function validateForm() {
    clearErrors();
    let valid = true;

    if (!els.title.value.trim()) {
      els.errTitle.textContent = 'Title is required.';
      els.title.classList.add('invalid');
      valid = false;
    }
    const amt = parseFloat(els.amount.value);
    if (!els.amount.value || isNaN(amt) || amt <= 0) {
      els.errAmount.textContent = 'Enter an amount greater than zero.';
      els.amount.classList.add('invalid');
      valid = false;
    }
    if (!els.date.value) {
      els.errDate.textContent = 'Date is required.';
      els.date.classList.add('invalid');
      valid = false;
    }
    return valid;
  }

  function resetFormState() {
    editingId = null;
    currentType = 'expense';
    els.typeButtons.forEach(b => b.classList.toggle('active', b.dataset.type === 'expense'));
    els.date.value = new Date().toISOString().slice(0, 10);
    clearErrors();
    els.form.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-plus"></i> Add Transaction';
  }

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      title: els.title.value.trim(),
      amount: parseFloat(els.amount.value),
      category: els.category.value,
      type: currentType,
      date: els.date.value
    };

    if (editingId) {
      const idx = transactions.findIndex(t => t.id === editingId);
      if (idx > -1) transactions[idx] = { ...transactions[idx], ...payload };
      toast('Transaction updated.', 'success');
    } else {
      transactions.unshift({ id: cryptoId(), ...payload });
      toast('Transaction added.', 'success');
    }

    Storage.set(STORAGE_KEY, transactions);
    els.form.reset();
    resetFormState();
    renderAll();
  });

  els.resetBtn.addEventListener('click', () => {
    resetFormState();
  });

  els.typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      els.typeButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  /* ---------------------------------------------------------
     15. TRANSACTION LIST: EDIT / DELETE
  --------------------------------------------------------- */
  els.txList.addEventListener('click', (e) => {
    const btn = e.target.closest('.tx-action-btn');
    if (!btn) return;
    const card = e.target.closest('.tx-card');
    const id = card.dataset.id;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (btn.dataset.action === 'delete') {
      transactions = transactions.filter(t => t.id !== id);
      Storage.set(STORAGE_KEY, transactions);
      toast('Transaction deleted.', 'error');
      renderAll();
    } else if (btn.dataset.action === 'edit') {
      editingId = id;
      els.title.value = tx.title;
      els.amount.value = tx.amount;
      els.category.value = tx.category;
      els.date.value = tx.date;
      currentType = tx.type;
      els.typeButtons.forEach(b => b.classList.toggle('active', b.dataset.type === tx.type));
      els.form.querySelector('button[type="submit"]').innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
      document.getElementById('add-transaction').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Editing transaction — update the fields below.', 'info');
    }
  });

  /* ---------------------------------------------------------
     16. SEARCH / FILTER / SORT
  --------------------------------------------------------- */
  [els.searchInput, els.filterType, els.filterCategory, els.sortBy].forEach(el => {
    el.addEventListener('input', renderTransactionList);
    el.addEventListener('change', renderTransactionList);
  });

  /* ---------------------------------------------------------
     17. BUDGET MODAL
  --------------------------------------------------------- */
  els.editBudgetBtn.addEventListener('click', () => {
    els.budgetInput.value = monthlyBudget;
    els.budgetModal.classList.add('show');
  });
  els.budgetCancel.addEventListener('click', () => els.budgetModal.classList.remove('show'));
  els.budgetModal.addEventListener('click', (e) => { if (e.target === els.budgetModal) els.budgetModal.classList.remove('show'); });
  els.budgetSave.addEventListener('click', () => {
    const val = parseFloat(els.budgetInput.value);
    if (isNaN(val) || val <= 0) { toast('Enter a valid budget amount.', 'error'); return; }
    monthlyBudget = val;
    Storage.set(BUDGET_KEY, monthlyBudget);
    els.budgetModal.classList.remove('show');
    renderBudget();
    toast('Budget updated.', 'success');
  });

  /* ---------------------------------------------------------
     18. EXPORT CSV + PRINT
  --------------------------------------------------------- */
  els.exportBtn.addEventListener('click', () => {
    const rows = [['Title', 'Amount', 'Category', 'Type', 'Date']];
    getFilteredTransactions().forEach(t => rows.push([t.title, t.amount, t.category, t.type, t.date]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wealthfolio-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('Transactions exported as CSV.', 'success');
  });

  els.printBtn.addEventListener('click', () => window.print());

  /* ---------------------------------------------------------
     19. FAB
  --------------------------------------------------------- */
  els.fab.addEventListener('click', (e) => {
    const ripple = document.createElement('span');
    ripple.className = 'fab-ripple animate';
    const rect = els.fab.getBoundingClientRect();
    ripple.style.width = ripple.style.height = rect.width + 'px';
    ripple.style.left = '0'; ripple.style.top = '0';
    els.fab.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
    document.getElementById('add-transaction').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------------------------------------------------
     20. THEME (DARK MODE)
  --------------------------------------------------------- */
  function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    Storage.set(THEME_KEY, theme);
    if (charts.pie) buildCharts();
  }
  applyTheme(Storage.get(THEME_KEY, 'light'));

  els.themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
  });

  /* ---------------------------------------------------------
     21. NAVBAR SCROLL + MOBILE MENU
  --------------------------------------------------------- */
  window.addEventListener('scroll', () => {
    els.navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  els.hamburger.addEventListener('click', () => {
    els.navLinks.classList.toggle('open');
  });
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      els.navLinks.classList.remove('open');
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  /* ---------------------------------------------------------
     22. SCROLL REVEAL
  --------------------------------------------------------- */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  $$('.reveal').forEach(el => observer.observe(el));

  /* ---------------------------------------------------------
     23. HERO FLOAT-CARD COUNT-UP (runs once on load)
  --------------------------------------------------------- */
  function animateHeroCards() {
    $$('.fc-value').forEach(el => {
      const target = Number(el.dataset.count);
      countUp(el, target, '₹', 1500);
    });
  }

  /* ---------------------------------------------------------
     24. HELPERS
  --------------------------------------------------------- */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---------------------------------------------------------
     25. INIT
  --------------------------------------------------------- */
  function init() {
    els.footerYear.textContent = new Date().getFullYear();
    els.date.value = new Date().toISOString().slice(0, 10);
    renderAll();
    animateHeroCards();

    window.addEventListener('load', () => {
      setTimeout(() => els.loader.classList.add('hidden'), 400);
    });
    // Fallback in case 'load' already fired
    setTimeout(() => els.loader.classList.add('hidden'), 1200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
