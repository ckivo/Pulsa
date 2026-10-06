// Finance: accounts, transactions, CSV import, live alerts, trading business.
/* ================= Finance ================= */
const Finance = (() => {
  const KEY = 'finance_v1';
  const $ = id => document.getElementById(id);
  const EXPENSE_CATS = ['Food & dining', 'Groceries', 'Transport', 'Shopping', 'Bills & utilities', 'Subscriptions', 'Entertainment', 'Health', 'Trading', 'Travel', 'Transfers', 'Other'];
  const INCOME_CATS = ['Salary', 'Deposit', 'Trading', 'Freelance', 'Transfer in', 'Refund', 'Gift', 'Other'];
  // Refunds offset spending rather than counting as income.
  const isRefund = t => t.kind === 'income' && t.category === 'Refund';
  const spentOf = list => list.reduce((s, t) => s + (t.kind === 'expense' ? t.amount : isRefund(t) ? -t.amount : 0), 0);
  const incomeOf = list => list.reduce((s, t) => s + (t.kind !== 'expense' && !isRefund(t) ? t.amount : 0), 0);
  const ACCOUNT_TYPES = ['Checking', 'Savings', 'Credit card', 'Cash', 'Brokerage', 'Crypto', 'Other'];
  const CYCLES = [['monthly', 'Monthly'], ['yearly', 'Yearly'], ['weekly', 'Weekly']];
  const open = { acct: false, inv: false, sub: false, bill: false, payout: false, budget: false };
  let txnKind = 'expense';
  let editingTxn = null;   // id of the transaction open in the inline editor
  let recentLimit = 12;    // how many Recent rows to show

  function load() {
    return Object.assign({ accounts: [], txns: [], subs: [], bills: [], investments: [], budget: null }, storeGet(KEY) || {});
  }
  function save(data) {
    try {
      Store.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      alert('Browser storage is full.');
    }
    render();
  }

  function money(n) {
    const abs = Math.abs(n);
    return (n < 0 ? '−$' : '$') + abs.toLocaleString('en-US', { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  const signed = t => (t.kind === 'expense' ? -t.amount : t.amount);
  const balanceOf = (data, a) => a.base + data.txns.filter(t => t.accountId === a.id).reduce((s, t) => s + signed(t), 0);
  const today = () => getActiveDateString();
  const monthPrefix = () => today().slice(0, 7);
  const dayMs = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  const daysUntil = ds => Math.round((dayMs(ds) - dayMs(today())) / 86400000);

  function dueChip(ds) {
    const n = daysUntil(ds);
    const text = n < 0 ? (-n) + 'd late' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n <= 14 ? 'In ' + n + 'd' : shortDate(ds);
    return el('span', 'fin-due' + (n < 0 ? ' late' : n <= 3 ? ' soon' : ''), text);
  }

  /* Subscriptions: every charge date is derived from the first one, so months with fewer days clamp correctly. */
  function occurrence(sub, k) {
    if (sub.cycle === 'weekly') return shiftDate(sub.start, 7 * k);
    const [y, m, d] = sub.start.split('-').map(Number);
    const months = sub.cycle === 'yearly' ? 12 * k : k;
    const first = new Date(y, m - 1 + months, 1);
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return toDateString(new Date(first.getFullYear(), first.getMonth(), Math.min(d, dim)));
  }
  function nextDue(sub) {
    const from = sub.loggedThrough && sub.loggedThrough >= today() ? shiftDate(sub.loggedThrough, 1) : today();
    for (let k = 0; k < 3000; k++) {
      const ds = occurrence(sub, k);
      if (ds >= from) return ds;
    }
    return sub.start;
  }
  const monthlyCost = s => (s.cycle === 'weekly' ? s.amount * 52 / 12 : s.cycle === 'yearly' ? s.amount / 12 : s.amount);

  /* Small builders */
  function cardHead(title, count, addLabel, onAdd) {
    const head = el('header', 'col-head');
    head.appendChild(el('span', 'col-title', title));
    if (count != null) head.appendChild(el('span', 'col-count', String(count)));
    if (addLabel) {
      const b = el('button', 'btn-ghost btn-xs', addLabel);
      b.type = 'button';
      b.addEventListener('click', onAdd);
      head.appendChild(b);
    }
    return head;
  }

  function buildForm(fields, submitLabel, onSubmit, onCancel) {
    const form = el('form', 'fin-form');
    fields.forEach(f => {
      const wrap = el('label', 'field' + (f.span ? ' span-2' : ''));
      wrap.appendChild(el('span', 'field-label', f.label));
      let input;
      if (f.type === 'select') {
        input = el('select', 'goal-input sm');
        f.options.forEach(o => {
          const [value, text] = Array.isArray(o) ? o : [o, o];
          const op = el('option', null, text);
          op.value = value;
          input.appendChild(op);
        });
      } else {
        input = el('input', 'goal-input sm');
        input.type = f.type || 'text';
        if (f.type === 'number') { input.step = 'any'; input.inputMode = 'decimal'; }
        if (f.min != null) input.min = f.min;
      }
      input.name = f.name;
      if (f.id) input.id = f.id;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.value != null) input.value = f.value;
      if (f.required) input.required = true;
      wrap.appendChild(input);
      form.appendChild(wrap);
    });
    const actions = el('div', 'form-actions span-2');
    const ok = el('button', 'btn-primary', submitLabel);
    ok.type = 'submit';
    actions.appendChild(ok);
    if (onCancel) {
      const cancel = el('button', 'btn-secondary', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', onCancel);
      actions.appendChild(cancel);
    }
    form.appendChild(actions);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = {};
      fields.forEach(f => { v[f.name] = form.elements.namedItem(f.name).value; });
      onSubmit(v);
    });
    return form;
  }

  function finRow({ name, sub, amount, amountClass, chip, onEditAmount, editValue, actions, fresh, onOpen }) {
    const li = el('li', 'fin-row' + (fresh ? ' just-added' : ''));
    const main = el('div', 'fr-main');
    if (onOpen) {
      main.classList.add('tappable');
      main.title = 'Edit';
      main.addEventListener('click', onOpen);
    }
    main.appendChild(el('div', 'fr-name', name));
    if (sub) main.appendChild(el('div', 'fr-sub', sub));
    li.appendChild(main);
    if (chip) li.appendChild(chip);
    const amt = el('span', 'fin-amt' + (amountClass ? ' ' + amountClass : '') + (onEditAmount ? ' editable' : ''), amount);
    if (onEditAmount) {
      amt.title = 'Click to update';
      amt.addEventListener('click', () => {
        const input = el('input', 'goal-input sm fin-amt-input');
        input.type = 'number';
        input.step = 'any';
        input.value = editValue;
        let done = false;
        const finish = commit => {
          if (done) return;
          done = true;
          const v = parseFloat(input.value);
          if (commit && isFinite(v)) onEditAmount(v);
          else input.replaceWith(amt);
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
        amt.replaceWith(input);
        input.focus();
        input.select();
      });
    }
    li.appendChild(amt);
    (actions || []).forEach(a => {
      const b = el('button', 'icon-btn' + (a.danger ? ' danger' : ''), a.label);
      b.type = 'button';
      b.title = a.title;
      b.addEventListener('click', a.onClick);
      li.appendChild(b);
    });
    return li;
  }

  const accountOptions = data => [['', 'No account']].concat(data.accounts.map(a => [a.id, a.name]));

  // Delete with a 5-second Undo instead of a confirm dialog.
  function removeWithUndo(message, mutate) {
    const before = load();
    const d = load();
    mutate(d);
    save(d);
    Toast.show(message, { undo: () => save(before) });
  }

  function addTxn(data, t) {
    data.txns.push(Object.assign({ id: uid(), created: Date.now() }, t));
  }

  /* Stats row */
  function renderStats(data) {
    const box = $('finStats');
    box.innerHTML = '';
    const stat = (label, value, cls, sub) => {
      const s = el('div', 'jr-stat');
      s.appendChild(el('div', 'jr-stat-label', label));
      const v = el('div', 'jr-stat-value' + (cls ? ' ' + cls : ''), value);
      if (sub) v.appendChild(el('span', 'jr-stat-sub', sub));
      s.appendChild(v);
      box.appendChild(s);
    };
    const balances = data.accounts.map(a => ({ a, bal: balanceOf(data, a) }));
    const invested = data.investments.reduce((s, i) => s + i.value, 0);
    const netWorth = balances.reduce((s, b) => s + b.bal, 0) + invested;
    const cash = balances.filter(b => b.a.type !== 'Credit card' && b.a.type !== 'Brokerage' && b.a.type !== 'Crypto').reduce((s, b) => s + b.bal, 0);
    const month = data.txns.filter(t => t.date.startsWith(monthPrefix()));
    const spent = spentOf(month);
    const income = incomeOf(month);
    stat('Net worth', money(netWorth), netWorth < 0 ? 'neg' : '');
    stat('Cash', money(cash));
    stat('Spent this month', money(spent), '', data.budget ? 'of ' + money(data.budget) : '');
    stat('Income this month', money(income), income > 0 ? 'pos' : '');
  }

  /* Accounts */
  function renderAccounts(data) {
    const card = $('finAccounts');
    card.innerHTML = '';
    card.appendChild(cardHead('Accounts', data.accounts.length, open.acct ? null : '+ Add', () => { open.acct = true; render(); }));
    const total = data.accounts.reduce((s, a) => s + balanceOf(data, a), 0);
    if (data.accounts.length) {
      const t = el('div', 'fin-total', money(total));
      t.appendChild(el('small', null, 'total balance'));
      card.appendChild(t);
    }
    if (open.acct) {
      card.appendChild(buildForm([
        { name: 'name', label: 'Name', placeholder: 'e.g. Chase checking', required: true, span: true },
        { name: 'type', label: 'Type', type: 'select', options: ACCOUNT_TYPES },
        { name: 'balance', label: 'Current balance', type: 'number', placeholder: '0', required: true }
      ], 'Add account', v => {
        const d = load();
        d.accounts.push({ id: uid(), name: v.name.trim(), type: v.type, base: parseFloat(v.balance) || 0 });
        open.acct = false;
        save(d);
      }, () => { open.acct = false; render(); }));
    }
    const list = el('ul', 'fin-list');
    data.accounts.forEach(a => {
      const bal = balanceOf(data, a);
      list.appendChild(finRow({
        name: a.name,
        sub: a.type,
        amount: money(bal),
        amountClass: bal < 0 ? 'neg' : '',
        editValue: round2(bal),
        onEditAmount: v => {
          const d = load();
          const acct = d.accounts.find(x => x.id === a.id);
          acct.base = v - (balanceOf(d, acct) - acct.base);
          save(d);
        },
        actions: [{ label: '×', title: 'Delete account', danger: true, onClick: () => {
          removeWithUndo('Deleted account ' + a.name, d => {
            d.accounts = d.accounts.filter(x => x.id !== a.id);
            d.txns.forEach(t => { if (t.accountId === a.id) t.accountId = ''; });
          });
        } }]
      }));
    });
    card.appendChild(list);
    if (!data.accounts.length && !open.acct) {
      card.appendChild(el('div', 'fin-empty', 'Add your checking, savings and cards. Enter credit card debt as a negative balance.'));
    } else if (data.accounts.length) {
      card.appendChild(el('div', 'fin-note', 'Transactions linked to an account update its balance. Click a balance to correct it.'));
    }
  }

  /* Investments */
  function renderInvestments(data) {
    const card = $('finInvest');
    card.innerHTML = '';
    card.appendChild(cardHead('Investments', data.investments.length, open.inv ? null : '+ Add', () => { open.inv = true; render(); }));
    const value = data.investments.reduce((s, i) => s + i.value, 0);
    const cost = data.investments.reduce((s, i) => s + i.cost, 0);
    if (data.investments.length) {
      const gain = value - cost;
      const t = el('div', 'fin-total', money(value));
      const small = el('small', signClass(gain), (gain >= 0 ? '+' : '') + money(gain) + (cost ? ' (' + (gain >= 0 ? '+' : '') + (gain / cost * 100).toFixed(1) + '%)' : ''));
      t.appendChild(small);
      card.appendChild(t);
    }
    if (open.inv) {
      card.appendChild(buildForm([
        { name: 'name', label: 'Name', placeholder: 'e.g. S&P 500 ETF', required: true },
        { name: 'symbol', label: 'Ticker', placeholder: 'VOO' },
        { name: 'cost', label: 'Amount invested', type: 'number', placeholder: '0', required: true },
        { name: 'value', label: 'Current value', type: 'number', placeholder: 'Same as invested' }
      ], 'Add investment', v => {
        const d = load();
        const c = parseFloat(v.cost) || 0;
        const val = v.value === '' ? c : parseFloat(v.value) || 0;
        d.investments.push({ id: uid(), name: v.name.trim(), symbol: v.symbol.trim().toUpperCase(), cost: c, value: val, updated: today() });
        open.inv = false;
        save(d);
      }, () => { open.inv = false; render(); }));
    }
    const list = el('ul', 'fin-list');
    data.investments.forEach(i => {
      const gain = i.value - i.cost;
      const pct = i.cost ? (gain / i.cost * 100).toFixed(1) + '%' : '—';
      list.appendChild(finRow({
        name: i.name + (i.symbol ? ' · ' + i.symbol : ''),
        sub: 'Invested ' + money(i.cost) + ' · ' + (gain >= 0 ? '▲ +' : '▼ ') + pct,
        amount: money(i.value),
        amountClass: signClass(gain),
        editValue: i.value,
        onEditAmount: v => {
          const d = load();
          const inv = d.investments.find(x => x.id === i.id);
          inv.value = v;
          inv.updated = today();
          save(d);
        },
        actions: [{ label: '×', title: 'Delete', danger: true, onClick: () => {
          removeWithUndo('Deleted ' + i.name, d => { d.investments = d.investments.filter(x => x.id !== i.id); });
        } }]
      }));
    });
    card.appendChild(list);
    if (!data.investments.length && !open.inv) card.appendChild(el('div', 'fin-empty', 'Track stocks, ETFs, crypto or funds. Click a value to update it.'));
  }

  /* Spending + income */
  function renderSpending(data) {
    const card = $('finSpend');
    card.innerHTML = '';
    const monthName = new Date(dayMs(today())).toLocaleDateString('en-US', { month: 'long' });
    card.appendChild(cardHead('Spending', monthName));

    const month = data.txns.filter(t => t.date.startsWith(monthPrefix()));
    const spent = spentOf(month);

    const line = el('div', 'budget-line');
    const left = el('span');
    left.append(document.createTextNode('Spent '), el('b', null, money(spent)));
    const budgetBtn = el('button', 'link', data.budget ? 'Budget ' + money(data.budget) : 'Set a monthly budget');
    budgetBtn.type = 'button';
    budgetBtn.style.cssText = 'border:none;background:none;color:var(--text-secondary);cursor:pointer;font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:0';
    budgetBtn.addEventListener('click', () => { open.budget = !open.budget; render(); });
    line.append(left, budgetBtn);
    card.appendChild(line);
    if (data.budget) {
      const meter = el('div', 'meter fin-meter');
      const fill = el('div', 'meter-fill meter-done' + (spent > data.budget ? ' over' : ''));
      fill.style.width = Math.min(100, spent / data.budget * 100) + '%';
      meter.appendChild(fill);
      card.appendChild(meter);
    }
    if (open.budget) {
      card.appendChild(buildForm([
        { name: 'budget', label: 'Monthly budget (blank to remove)', type: 'number', value: data.budget || '', span: true }
      ], 'Save budget', v => {
        const d = load();
        d.budget = parseFloat(v.budget) > 0 ? parseFloat(v.budget) : null;
        open.budget = false;
        save(d);
      }, () => { open.budget = false; render(); }));
    }

    // Add transaction
    const seg = el('div', 'kind-seg');
    [['expense', 'Expense'], ['income', 'Income']].forEach(([k, label]) => {
      const b = el('button', txnKind === k ? 'active' : '', label);
      b.type = 'button';
      b.addEventListener('click', () => { txnKind = k; renderSpending(load()); });
      seg.appendChild(b);
    });
    card.appendChild(seg);
    card.appendChild(buildForm([
      { name: 'amount', id: 'finTxnAmount', label: 'Amount', type: 'number', min: '0', placeholder: '0.00', required: true },
      { name: 'category', label: 'Category', type: 'select', options: txnKind === 'expense' ? EXPENSE_CATS : INCOME_CATS },
      { name: 'date', label: 'Date', type: 'date', value: today() },
      { name: 'account', label: 'Account', type: 'select', options: accountOptions(data) },
      { name: 'note', label: 'Note', placeholder: txnKind === 'expense' ? 'e.g. Lunch with Sam' : 'e.g. Paycheck', span: true }
    ], txnKind === 'expense' ? 'Add expense' : 'Add income', v => {
      const amount = Math.abs(parseFloat(v.amount));
      if (!amount) return;
      const d = load();
      addTxn(d, { kind: txnKind, amount, category: v.category, date: v.date || today(), accountId: v.account, note: v.note.trim() });
      save(d);
      Toast.show((txnKind === 'expense' ? 'Expense' : 'Income') + ' of ' + money(amount) + ' added');
      const input = $('finTxnAmount');
      if (input) input.focus();
    }));

    // By category (this month's expenses)
    const byCat = new Map();
    month.filter(t => t.kind === 'expense').forEach(t => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount));
    if (byCat.size) {
      card.appendChild(el('div', 'fin-sub-head')).appendChild(el('span', 'gm-eyebrow', 'By category'));
      const bars = el('div', 'cat-bars');
      const max = Math.max(...byCat.values());
      [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([cat, amt]) => {
        const row = el('div');
        const top = el('div', 'cat-top');
        top.append(el('span', null, cat), el('b', null, money(amt)));
        const meter = el('div', 'meter');
        const fill = el('div', 'meter-fill meter-done');
        fill.style.width = (amt / max * 100) + '%';
        meter.appendChild(fill);
        row.append(top, meter);
        bars.appendChild(row);
      });
      card.appendChild(bars);
    }

    // Recent transactions — tap one to edit it (name, amount, type, category, date, account).
    const sorted = data.txns.slice().sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
    const recent = sorted.slice(0, recentLimit);
    const head = card.appendChild(el('div', 'fin-sub-head'));
    head.append(el('span', 'gm-eyebrow', 'Recent'), el('span', 'fin-hint', 'Tap to edit'));
    const list = el('ul', 'fin-list');
    const accountName = id => (data.accounts.find(a => a.id === id) || {}).name;
    recent.forEach(t => {
      const parts = [shortDate(t.date), t.kind === 'payout' ? 'Payout' : t.category];
      const acct = accountName(t.accountId);
      if (acct) parts.push(acct);
      const row = finRow({
        name: t.note || (t.kind === 'payout' ? 'Payout' : t.category),
        sub: parts.join(' · '),
        amount: (t.kind === 'expense' ? '−' : '+') + money(t.amount),
        amountClass: t.kind === 'expense' ? '' : 'pos',
        chip: t.pending ? el('span', 'fin-due soon', 'Live') : null,
        fresh: t.created && Date.now() - t.created < 1500,
        onOpen: () => { editingTxn = editingTxn === t.id ? null : t.id; renderSpending(load()); },
        actions: [{ label: '×', title: 'Delete', danger: true, onClick: () => {
          removeWithUndo('Deleted ' + (t.note || t.category), d => { d.txns = d.txns.filter(x => x.id !== t.id); });
        } }]
      });
      if (editingTxn === t.id) row.classList.add('editing');
      list.appendChild(row);
      if (editingTxn === t.id) list.appendChild(buildTxnEditor(t, data));
    });
    card.appendChild(list);
    if (sorted.length > recentLimit) {
      const more = el('button', 'col-add', 'Show more (' + (sorted.length - recentLimit) + ' older)');
      more.type = 'button';
      more.addEventListener('click', () => { recentLimit += 20; renderSpending(load()); });
      card.appendChild(more);
    }
    if (!recent.length) card.appendChild(el('div', 'fin-empty', 'No transactions yet.'));
  }

  // Inline editor for one transaction. Type decides which categories are offered.
  function buildTxnEditor(t, data) {
    const li = el('li', 'fin-edit');
    const form = el('form', 'fin-form');
    const field = (label, input, span) => {
      const f = el('label', 'field' + (span ? ' span-2' : ''));
      f.append(el('span', 'field-label', label), input);
      form.appendChild(f);
      return input;
    };
    const select = (options, value) => {
      const s = el('select', 'goal-input sm');
      options.forEach(([v, text]) => { const o = el('option', null, text); o.value = v; s.appendChild(o); });
      s.value = value;
      return s;
    };
    const input = (type, value) => {
      const i = el('input', 'goal-input sm');
      i.type = type;
      if (type === 'number') { i.step = 'any'; i.min = '0'; i.inputMode = 'decimal'; }
      i.value = value;
      return i;
    };

    const name = field('Name', input('text', t.note || ''), true);
    const amount = field('Amount', input('number', t.amount));
    const date = field('Date', input('date', t.date));
    const kind = field('Type', select([['expense', 'Expense'], ['income', 'Income / refund'], ['payout', 'Payout']], t.kind));
    const category = field('Category', select([], ''));
    const account = field('Account', select(accountOptions(data), t.accountId || ''), true);

    const fillCategories = keep => {
      const opts = kind.value === 'expense' ? EXPENSE_CATS : kind.value === 'income' ? INCOME_CATS : ['Trading'];
      category.innerHTML = '';
      opts.forEach(c => { const o = el('option', null, c); o.value = c; category.appendChild(o); });
      category.value = opts.includes(keep) ? keep : opts[0];
      category.disabled = kind.value === 'payout';
    };
    fillCategories(t.category);
    kind.addEventListener('change', () => fillCategories(category.value));

    const actions = el('div', 'form-actions span-2');
    const saveBtn = el('button', 'btn-primary', 'Save');
    saveBtn.type = 'submit';
    const cancel = el('button', 'btn-secondary', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => { editingTxn = null; renderSpending(load()); });
    actions.append(saveBtn, cancel);
    form.appendChild(actions);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const amt = Math.abs(parseFloat(amount.value));
      if (!amt) { amount.focus(); return; }
      const d = load();
      const tx = d.txns.find(x => x.id === t.id);
      if (!tx) return;
      Object.assign(tx, {
        note: name.value.trim(),
        amount: amt,
        date: date.value || tx.date,
        kind: kind.value,
        category: kind.value === 'payout' ? 'Trading' : category.value,
        accountId: account.value
      });
      editingTxn = null;
      save(d);
      Toast.show('Transaction updated');
    });
    li.appendChild(form);
    return li;
  }

  /* Upcoming payments: one-off bills + subscription charges in the next 30 days */
  function renderUpcoming(data) {
    const card = $('finUpcoming');
    card.innerHTML = '';
    const items = [];
    data.bills.forEach(b => items.push({ kind: 'bill', date: b.due, amount: b.amount, item: b }));
    data.subs.forEach(s => {
      const due = nextDue(s);
      if (daysUntil(due) <= 30) items.push({ kind: 'sub', date: due, amount: s.amount, item: s });
    });
    items.sort((a, b) => a.date.localeCompare(b.date));

    card.appendChild(cardHead('Upcoming payments', items.length, open.bill ? null : '+ Bill', () => { open.bill = true; render(); }));
    if (items.length) {
      const t = el('div', 'fin-total', money(items.reduce((s, x) => s + x.amount, 0)));
      t.appendChild(el('small', null, 'due in the next 30 days'));
      card.appendChild(t);
    }
    if (open.bill) {
      card.appendChild(buildForm([
        { name: 'name', label: 'Payment', placeholder: 'e.g. Rent', required: true, span: true },
        { name: 'amount', label: 'Amount', type: 'number', min: '0', required: true },
        { name: 'due', label: 'Due date', type: 'date', value: today(), required: true },
        { name: 'account', label: 'Pay from', type: 'select', options: accountOptions(data), span: true }
      ], 'Add payment', v => {
        const d = load();
        d.bills.push({ id: uid(), name: v.name.trim(), amount: Math.abs(parseFloat(v.amount)) || 0, due: v.due, accountId: v.account });
        open.bill = false;
        save(d);
      }, () => { open.bill = false; render(); }));
    }
    const list = el('ul', 'fin-list');
    items.forEach(x => {
      const isBill = x.kind === 'bill';
      list.appendChild(finRow({
        name: x.item.name,
        sub: (isBill ? 'Bill' : 'Subscription') + ' · ' + shortDate(x.date),
        chip: dueChip(x.date),
        amount: money(x.amount),
        actions: [
          { label: '✓', title: isBill ? 'Mark paid (logs an expense)' : 'Log this charge as an expense', onClick: () => {
            const d = load();
            if (isBill) {
              addTxn(d, { kind: 'expense', amount: x.amount, category: 'Bills & utilities', date: today(), accountId: x.item.accountId || '', note: x.item.name });
              d.bills = d.bills.filter(b => b.id !== x.item.id);
            } else {
              const sub = d.subs.find(s => s.id === x.item.id);
              addTxn(d, { kind: 'expense', amount: x.amount, category: 'Subscriptions', date: x.date, accountId: sub.accountId || '', note: sub.name });
              sub.loggedThrough = x.date;
            }
            save(d);
          } }
        ].concat(isBill ? [{ label: '×', title: 'Delete', danger: true, onClick: () => {
          removeWithUndo('Deleted ' + x.item.name, d => { d.bills = d.bills.filter(b => b.id !== x.item.id); });
        } }] : [])
      }));
    });
    card.appendChild(list);
    if (!items.length && !open.bill) card.appendChild(el('div', 'fin-empty', 'Nothing due in the next 30 days.'));
  }

  /* Subscriptions */
  function renderSubs(data) {
    const card = $('finSubs');
    card.innerHTML = '';
    card.appendChild(cardHead('Subscriptions', data.subs.length, open.sub ? null : '+ Add', () => { open.sub = true; render(); }));
    if (data.subs.length) {
      const perMonth = data.subs.reduce((s, x) => s + monthlyCost(x), 0);
      const t = el('div', 'fin-total', money(perMonth));
      t.appendChild(el('small', null, '/ month · ' + money(perMonth * 12) + ' / year'));
      card.appendChild(t);
    }
    if (open.sub) {
      card.appendChild(buildForm([
        { name: 'name', label: 'Name', placeholder: 'e.g. Netflix', required: true, span: true },
        { name: 'amount', label: 'Amount', type: 'number', min: '0', required: true },
        { name: 'cycle', label: 'Billed', type: 'select', options: CYCLES },
        { name: 'start', label: 'Next charge', type: 'date', value: today(), required: true },
        { name: 'account', label: 'Paid from', type: 'select', options: accountOptions(data) }
      ], 'Add subscription', v => {
        const d = load();
        d.subs.push({ id: uid(), name: v.name.trim(), amount: Math.abs(parseFloat(v.amount)) || 0, cycle: v.cycle, start: v.start, accountId: v.account });
        open.sub = false;
        save(d);
      }, () => { open.sub = false; render(); }));
    }
    const label = { monthly: '/mo', yearly: '/yr', weekly: '/wk' };
    const list = el('ul', 'fin-list');
    data.subs.slice().sort((a, b) => nextDue(a).localeCompare(nextDue(b))).forEach(s => {
      list.appendChild(finRow({
        name: s.name,
        sub: (CYCLES.find(c => c[0] === s.cycle) || ['', ''])[1] + ' · next ' + shortDate(nextDue(s)),
        amount: money(s.amount) + label[s.cycle],
        actions: [{ label: '×', title: 'Cancel subscription', danger: true, onClick: () => {
          removeWithUndo('Removed ' + s.name, d => { d.subs = d.subs.filter(x => x.id !== s.id); });
        } }]
      }));
    });
    card.appendChild(list);
    if (!data.subs.length && !open.sub) card.appendChild(el('div', 'fin-empty', 'Add Netflix, Spotify, gym, trading tools…'));
  }

  /* ----- Bank CSV import ----- */
  // Handles Bank of America's export (summary block, then Date/Description/Amount/Running Bal.)
  // and most other banks (separate Debit/Credit columns, different header names).
  const COLS = {
    date: ['date', 'posted date', 'posting date', 'transaction date', 'trans. date', 'trans date'],
    desc: ['description', 'payee', 'merchant', 'name', 'details', 'memo', 'transaction description', 'original description'],
    amount: ['amount', 'transaction amount', 'amount (usd)'],
    debit: ['debit', 'debits', 'withdrawal', 'withdrawals', 'debit amount', 'money out'],
    credit: ['credit', 'credits', 'deposit', 'deposits', 'credit amount', 'money in'],
    balance: ['running bal.', 'running balance', 'balance', 'running bal']
  };

  const CATEGORY_RULES = [
    [/DASHPASS|NETFLIX|SPOTIFY|HULU|DISNEY\+|APPLE\.COM\/BILL|YOUTUBE|PRIME VIDEO|CHATGPT|OPENAI|ANTHROPIC|PATREON/, 'Subscriptions'],
    [/TRADINGVIEW|TRADEIFY|TOPSTEP|APEX TRADER|SIM2FUNDED|WHOP\*|NINJATRADER|TRADOVATE|RITHMIC|PROFITHUB|FTMO|MYFUNDED|TAKE ?PROFIT|DATABENTO/, 'Trading'],
    [/DOORDASH|UBER ?EATS|GRUBHUB|CHICK-FIL-A|WINGSTOP|CHIPOTLE|MCDONALD|STARBUCKS|TACO|PIZZA|DOMINO|SUBWAY|BURGER|WENDY|KFC|PANDA|SHAWARMA|CARNE ASADA|^SQ \*|^TST\*|RESTAURANT|CAFE|COFFEE|DUNKIN|POPEYES|JACK IN THE BOX/, 'Food & dining'],
    [/SAFEWAY|KROGER|QFC|FRED ?MEYER|WHOLE ?FOODS|TRADER JOE|COSTCO|WALMART|ALDI|GROCERY|SUPERMARKET|WINCO/, 'Groceries'],
    [/UBER|LYFT|SHELL|CHEVRON|ARCO|EXXON|PARKING|TRANSIT|ORCA|GAS STATION|76 #/, 'Transport'],
    [/EPIC GAMES|FORTNITE|ROBLOX|STEAM|PLAYSTATION|XBOX|NINTENDO|CINEMA|AMC THEAT|TICKETMASTER|SMASH BROS/, 'Entertainment'],
    [/AMAZON|AMZN|TARGET|PAYPAL|DOLLAR ?TREE|BEST BUY|EBAY|NIKE|ROSS STORES|SHEIN/, 'Shopping'],
    [/CLUB FEES|ICLUB|FITNESS|GYM|PHARMACY|CVS|WALGREENS|HOSPITAL|DENTAL|CLINIC/, 'Health'],
    [/ELECTRIC|PUGET SOUND|COMCAST|XFINITY|T-MOBILE|VERIZON|AT&T|INSURANCE|RENT|WATER/, 'Bills & utilities'],
    [/ZELLE PAYMENT TO|VENMO|CASH APP|TRANSFER TO/, 'Transfers']
  ];

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.map(r => r.map(c => c.trim()));
  }

  function parseMoney(s) {
    if (!s) return null;
    const neg = /^\(.*\)$/.test(s) || /-/.test(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  function parseDateCell(s) {
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return y + '-' + pad2(+m[1]) + '-' + pad2(+m[2]);
    }
    return null;
  }

  // Never keep full card/account numbers: anything 9+ digits becomes ••••1234.
  const maskDigits = s => s.replace(/\d{9,}/g, m => '••••' + m.slice(-4));

  function niceCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/(^|[\s*\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }

  function cleanName(raw) {
    const u = raw.toUpperCase();
    if (/^ZELLE PAYMENT (TO|FROM)/.test(u)) {
      return raw.replace(/\s*Conf#.*$/i, '').replace(/\s+for\s.*$/i, '').replace(/^Zelle payment/i, 'Zelle');
    }
    if (/CREDIT ADJUSTMENT/.test(u)) return 'Credit adjustment (dispute)';
    if (/ATM.*DEPOSIT/.test(u)) return 'ATM deposit';
    // BofA appends " MM/DD PURCHASE city ST" and ACH details after " DES:".
    let s = raw.split(/\sDES:/)[0].replace(/\s\d{2}\/\d{2}\s.*$/, '');
    let prefix = '';
    if (/^PAYPAL \*/i.test(s)) { prefix = 'PayPal · '; s = s.replace(/^PAYPAL \*/i, ''); }
    if (/^WHOP\*/i.test(s)) { prefix = 'Whop · '; s = s.replace(/^WHOP\*/i, ''); }
    s = s.replace(/^(DD|SQ) \*/i, '').replace(/^TST\*/i, '')
      .replace(/^AMAZON MKTPL\*\S+/i, 'AMAZON MARKETPLACE')
      .replace(/^TRADINGVIEWV?\*.*/i, 'TradingView')
      .replace(/^DOORDASHDASHPASS/i, 'DoorDash DashPass');
    s = s.replace(/\s\*\s/g, ' ')
      .replace(/#\s?\d+/g, '')
      .replace(/\s[\d.\-]{7,}(?=\s|$)/g, '')   // phone numbers
      .replace(/\s\d{3,}$/, '')                // store numbers
      .replace(/\s{2,}/g, ' ')
      .trim();
    s = niceCase(maskDigits(s)).replace(/^Doordash\b/, 'DoorDash');
    return s ? prefix + s : 'Transaction';
  }

  function classify(raw, amount) {
    const u = raw.toUpperCase();
    if (amount > 0) {
      if (/REFUND|CREDIT ADJUSTMENT|REVERSAL|RETURN/.test(u)) return { kind: 'income', category: 'Refund' };
      if (/TOPSTEP|APEX TRADER|TRADEIFY|FTMO|PAYOUT|RISE ?WORKS|DEEL|MYFUNDED|TAKE ?PROFIT/.test(u)) return { kind: 'payout', category: 'Trading' };
      if (/PAYROLL|DIRECT DEP|SALARY/.test(u)) return { kind: 'income', category: 'Salary' };
      if (/DEPOSIT/.test(u)) return { kind: 'income', category: 'Deposit' };
      if (/ZELLE PAYMENT FROM|VENMO|CASH APP|TRANSFER FROM/.test(u)) return { kind: 'income', category: 'Transfer in' };
      return { kind: 'income', category: 'Other' };
    }
    for (const [re, cat] of CATEGORY_RULES) if (re.test(u)) return { kind: 'expense', category: cat };
    return { kind: 'expense', category: 'Other' };
  }

  function guessBank(text) {
    if (/BKOFAMERICA|BANK OF AMERICA/i.test(text)) return 'Bank of America';
    if (/CHASE/i.test(text)) return 'Chase';
    if (/WELLS FARGO/i.test(text)) return 'Wells Fargo';
    return 'Bank account';
  }

  function readStatement(text) {
    const rows = parseCsv(text).filter(r => r.some(c => c));
    const lower = r => r.map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());
    const find = (h, names) => h.findIndex(c => names.includes(c));
    let headerIdx = -1;
    let cols = null;
    for (let i = 0; i < rows.length; i++) {
      const h = lower(rows[i]);
      const c = {
        date: find(h, COLS.date), desc: find(h, COLS.desc), amount: find(h, COLS.amount),
        debit: find(h, COLS.debit), credit: find(h, COLS.credit), balance: find(h, COLS.balance)
      };
      if (c.date >= 0 && (c.amount >= 0 || c.debit >= 0 || c.credit >= 0)) { headerIdx = i; cols = c; break; }
    }
    if (headerIdx < 0) throw new Error('Couldn’t find Date and Amount columns in that file.');

    let ending = null;
    rows.slice(0, headerIdx).forEach(r => {
      if (/ending balance/i.test(r[0] || '')) ending = parseMoney(r[r.length - 1]);
    });

    const items = [];
    let lastBalance = null;
    rows.slice(headerIdx + 1).forEach((r, i) => {
      const date = parseDateCell(r[cols.date] || '');
      if (!date) return;
      let amount;
      if (cols.amount >= 0) amount = parseMoney(r[cols.amount]);
      else {
        const cr = parseMoney(r[cols.credit]);
        const db = parseMoney(r[cols.debit]);
        amount = cr == null && db == null ? null : Math.abs(cr || 0) - Math.abs(db || 0);
      }
      if (cols.balance >= 0) {
        const b = parseMoney(r[cols.balance]);
        if (b != null) lastBalance = b;
      }
      if (amount == null || amount === 0) return;
      const raw = maskDigits(cols.desc >= 0 ? r[cols.desc] : r.filter((_, j) => j !== cols.date).join(' '));
      const cls = classify(raw, amount);
      items.push({
        date, raw, amount, kind: cls.kind, category: cls.category,
        name: cleanName(raw), include: true, dup: false, order: i,
        key: date + '|' + amount.toFixed(2) + '|' + raw.toLowerCase()
      });
    });
    if (!items.length) throw new Error('No transactions found in that file.');
    return { items, ending: ending != null ? ending : lastBalance, bank: guessBank(text) };
  }

  let imp = null;

  function markDuplicates() {
    // Count-based, so four identical $14.50 credits in one file all import, but re-importing the same file skips them.
    const counts = new Map();
    load().txns.forEach(t => { if (t.importKey) counts.set(t.importKey, (counts.get(t.importKey) || 0) + 1); });
    imp.items.forEach(it => {
      const n = counts.get(it.key) || 0;
      it.dup = n > 0;
      it.include = !it.dup;
      if (n > 0) counts.set(it.key, n - 1);
    });
  }

  function startImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = readStatement(String(reader.result));
        imp = Object.assign(parsed, { fileName: file.name });
        markDuplicates();
        renderImport();
        $('importModal').hidden = false;
        document.body.style.overflow = 'hidden';
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
  }

  function closeImport() {
    $('importModal').hidden = true;
    document.body.style.overflow = '';
    $('importPanel').innerHTML = '';
    imp = null;
  }

  function categoryOptions(it) {
    return it.amount < 0 ? EXPENSE_CATS.map(c => [c, c]) : [['Payout', 'Payout (trading)']].concat(INCOME_CATS.map(c => [c, c]));
  }

  function renderImport() {
    const panel = $('importPanel');
    panel.innerHTML = '';
    const data = load();

    const top = el('div', 'peek-top');
    top.appendChild(el('span', 'peek-crumb', 'Finance / Import · ' + imp.fileName));
    const x = el('button', 'icon-btn', '×');
    x.type = 'button';
    x.title = 'Close (Esc)';
    x.addEventListener('click', closeImport);
    top.appendChild(x);
    panel.appendChild(top);

    const body = el('div', 'peek-body');
    const items = imp.items;
    const dates = items.map(i => i.date).sort();
    const out = items.filter(i => i.amount < 0).reduce((s, i) => s + i.amount, 0);
    const inn = items.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0);
    const dupCount = items.filter(i => i.dup).length;
    body.appendChild(el('div', 'imp-title', 'Review ' + items.length + ' transactions'));
    body.appendChild(el('div', 'imp-summary',
      shortDate(dates[0]) + ' – ' + shortDate(dates[dates.length - 1]) + ' · ' + money(out) + ' out · +' + money(inn) + ' in' +
      (dupCount ? ' · ' + dupCount + ' already imported (unticked)' : '')));

    // Account + balance
    const controls = el('div', 'imp-controls');
    const acctField = el('label', 'field');
    acctField.appendChild(el('span', 'field-label', 'Import into'));
    const acctSel = el('select', 'goal-input sm');
    data.accounts.forEach(a => { const o = el('option', null, a.name); o.value = a.id; acctSel.appendChild(o); });
    const newOpt = el('option', null, '+ New account');
    newOpt.value = '__new';
    acctSel.appendChild(newOpt);
    const match = data.accounts.find(a => a.name.toLowerCase().includes(imp.bank.toLowerCase().split(' ')[0]));
    acctSel.value = imp.accountId || (match ? match.id : (data.accounts.length ? data.accounts[0].id : '__new'));
    acctField.appendChild(acctSel);

    const nameField = el('label', 'field');
    nameField.appendChild(el('span', 'field-label', 'New account name'));
    const nameInput = el('input', 'goal-input sm');
    nameInput.value = imp.newName || imp.bank + ' checking';
    nameField.appendChild(nameInput);

    const balField = el('label', 'field');
    balField.appendChild(el('span', 'field-label', 'Balance after import'));
    const balInput = el('input', 'goal-input sm');
    balInput.type = 'number';
    balInput.step = 'any';
    balInput.placeholder = 'Leave blank to keep';
    if (imp.balance !== undefined) balInput.value = imp.balance;
    else if (imp.ending != null) balInput.value = imp.ending;
    balField.appendChild(balInput);

    const syncNew = () => { nameField.style.visibility = acctSel.value === '__new' ? 'visible' : 'hidden'; };
    acctSel.addEventListener('change', () => { imp.accountId = acctSel.value; syncNew(); });
    nameInput.addEventListener('input', () => { imp.newName = nameInput.value; });
    balInput.addEventListener('input', () => { imp.balance = balInput.value; });
    syncNew();
    controls.append(acctField, nameField, balField);
    body.appendChild(controls);
    body.appendChild(el('div', 'imp-hint', imp.ending != null
      ? 'Balance is pre-filled from the statement’s ending balance, so the account matches your bank.'
      : 'Enter your current bank balance to keep the account in sync, or leave blank.'));

    // Bulk select
    const bulk = el('div', 'imp-bulk');
    const counter = el('span');
    const all = el('button', null, 'Select all');
    all.type = 'button';
    const none = el('button', null, 'Select none');
    none.type = 'button';
    bulk.append(counter, all, none);
    body.appendChild(bulk);

    const list = el('div', 'imp-list');
    const importBtn = el('button', 'btn-primary');
    importBtn.type = 'button';
    const refreshCount = () => {
      const n = items.filter(i => i.include).length;
      counter.textContent = n + ' of ' + items.length + ' selected';
      importBtn.textContent = 'Import ' + n + ' transaction' + (n === 1 ? '' : 's');
      importBtn.disabled = !n;
    };

    items.slice().sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order).forEach(it => {
      const row = el('div', 'imp-row' + (it.include ? '' : ' off'));
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = it.include;
      cb.setAttribute('aria-label', 'Include');
      cb.addEventListener('change', () => { it.include = cb.checked; row.classList.toggle('off', !cb.checked); refreshCount(); });

      const date = el('span', 'imp-date', shortDate(it.date));
      const nameBox = el('div', 'imp-name');
      const name = el('input', 'goal-input sm');
      name.value = it.name;
      name.setAttribute('aria-label', 'Name');
      name.addEventListener('input', () => { it.name = name.value; });
      nameBox.appendChild(name);
      const rawLine = el('div', 'imp-raw', it.raw);
      rawLine.title = it.raw;
      if (it.dup) rawLine.appendChild(el('span', 'imp-dup', 'Already imported'));
      nameBox.appendChild(rawLine);

      const cat = el('select', 'goal-input sm');
      categoryOptions(it).forEach(([v, t]) => { const o = el('option', null, t); o.value = v; cat.appendChild(o); });
      cat.value = it.kind === 'payout' ? 'Payout' : it.category;
      cat.setAttribute('aria-label', 'Category');
      cat.addEventListener('change', () => {
        if (cat.value === 'Payout') { it.kind = 'payout'; it.category = 'Trading'; }
        else { it.kind = it.amount < 0 ? 'expense' : 'income'; it.category = cat.value; }
      });

      const amt = el('span', 'imp-amt' + (it.amount > 0 ? ' pos' : ''), (it.amount > 0 ? '+' : '') + money(it.amount));
      row.append(cb, date, nameBox, cat, amt);
      list.appendChild(row);
    });
    body.appendChild(list);

    all.addEventListener('click', () => { items.forEach(i => { i.include = true; }); renderImport(); });
    none.addEventListener('click', () => { items.forEach(i => { i.include = false; }); renderImport(); });

    const actions = el('div', 'form-actions');
    importBtn.addEventListener('click', () => commitImport(acctSel.value, nameInput.value, balInput.value));
    const cancel = el('button', 'btn-secondary', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', closeImport);
    actions.append(importBtn, cancel);
    body.appendChild(actions);
    refreshCount();
    panel.appendChild(body);
  }

  function commitImport(accountChoice, newName, balanceValue) {
    const chosen = imp.items.filter(i => i.include);
    if (!chosen.length) return;
    const d = load();
    let accountId = accountChoice;
    if (accountChoice === '__new') {
      accountId = uid();
      d.accounts.push({ id: accountId, name: (newName || '').trim() || imp.bank, type: 'Checking', base: 0 });
    }
    const stamp = Date.now();
    const confirmed = new Set();
    chosen.forEach((it, i) => {
      // A live alert for this transaction already exists: confirm it with the statement's details instead of adding a copy.
      const pending = findMatch(d, { kind: it.kind, amount: Math.abs(it.amount), date: it.date, accountId },
        t => t.pending && !confirmed.has(t.id));
      if (pending) {
        confirmed.add(pending.id);
        Object.assign(pending, {
          date: it.date,
          kind: it.kind,
          category: it.category,
          accountId,
          note: (it.name || '').trim() || pending.note,
          importKey: it.key,
          pending: false
        });
        return;
      }
      d.txns.push({
        id: uid() + i,
        created: stamp + it.order,
        kind: it.kind,
        amount: Math.abs(it.amount),
        category: it.category,
        date: it.date,
        accountId,
        note: (it.name || '').trim() || cleanName(it.raw),
        importKey: it.key
      });
    });
    const target = parseFloat(balanceValue);
    if (isFinite(target)) {
      const acct = d.accounts.find(a => a.id === accountId);
      acct.base = target - (balanceOf(d, acct) - acct.base);
    }
    closeImport();
    save(d);
    const matched = confirmed.size;
    Toast.show('Imported ' + (chosen.length - matched) + ' transaction' + (chosen.length - matched === 1 ? '' : 's') +
      (matched ? ' · ' + matched + ' live alert' + (matched === 1 ? '' : 's') + ' confirmed' : ''));
  }

  /* ----- Live alerts (Gmail → Apps Script → here) ----- */
  const LIVE_POLL_MS = 2 * 60 * 1000;
  let liveSetupOpen = false;
  let syncing = false;

  // Same money direction, amount within a cent, dates within 4 days (alerts and statements can post on different days).
  function findMatch(d, it, filter) {
    const out = it.kind === 'expense';
    return d.txns.find(t => filter(t) &&
      (t.kind === 'expense') === out &&
      Math.abs(t.amount - it.amount) < 0.005 &&
      (!it.accountId || !t.accountId || t.accountId === it.accountId) &&
      Math.abs(dayMs(t.date) - dayMs(it.date)) <= 4 * 86400000);
  }

  function mergeAlerts(d, alerts) {
    const live = d.live;
    const known = new Set(d.txns.filter(t => t.liveId).map(t => t.liveId));
    let added = 0;
    alerts.forEach(a => {
      if (!a || !a.id || known.has(a.id) || !a.date || a.date < live.since) return;
      const amount = Math.abs(Number(a.amount));
      if (!amount) return;
      const raw = maskDigits(String(a.merchant || a.subject || 'Transaction'));
      const cls = classify(raw, Number(a.amount));
      // Already in the books from a statement import? Just link it.
      const match = findMatch(d, { kind: cls.kind, amount, date: a.date, accountId: live.accountId }, t => !t.liveId);
      if (match) {
        match.liveId = a.id;
        known.add(a.id);
        return;
      }
      d.txns.push({
        id: uid() + added,
        created: Date.now() + added,
        kind: cls.kind,
        amount,
        category: cls.category,
        date: a.date,
        accountId: live.accountId || '',
        note: cleanName(raw),
        liveId: a.id,
        source: 'alert',
        pending: true
      });
      known.add(a.id);
      added++;
    });
    return added;
  }

  // Don't rebuild the page under someone's cursor; just refresh the live card and totals.
  function persist(d, full) {
    try { Store.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage full */ }
    const active = document.activeElement;
    const typing = active && active.closest && active.closest('[data-page="finance"]') && /INPUT|SELECT|TEXTAREA/.test(active.tagName);
    if (full && !typing) render();
    else {
      renderLive(d);
      renderStats(d);
    }
  }

  async function sync(manual) {
    const d0 = load();
    if (!d0.live || !d0.live.url || syncing) return;
    syncing = true;
    if (manual) { d0.live.checking = true; renderLive(d0); }
    try {
      const live = d0.live;
      const sep = live.url.includes('?') ? '&' : '?';
      const res = await fetch(live.url + sep + 'key=' + encodeURIComponent(live.key) + '&days=30');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'The script returned an error.');
      const d = load();
      if (!d.live) return;
      const added = mergeAlerts(d, body.txns || []);
      d.live.lastSync = Date.now();
      d.live.lastError = '';
      d.live.unparsed = (body.unparsed || []).length;
      d.live.lastAdded = added;
      persist(d, added > 0 || manual);
    } catch (err) {
      const d = load();
      if (d.live) {
        d.live.lastSync = Date.now();
        d.live.lastError = /Failed to fetch|NetworkError|Unexpected token|JSON/i.test(err.message)
          ? 'Couldn’t reach the script. Check the Web app URL, that access is set to “Anyone”, and that you’re online.'
          : err.message;
        persist(d, false);
      }
    } finally {
      syncing = false;
    }
  }

  function defaultSince(d, accountId) {
    const dates = d.txns.filter(t => !accountId || t.accountId === accountId).map(t => t.date).sort();
    // Overlap the last statement by a few days; matching links any repeats instead of double-counting.
    return dates.length ? shiftDate(dates[dates.length - 1], -3) : shiftDate(today(), -14);
  }

  function renderLive(data) {
    const card = $('finLive');
    card.innerHTML = '';
    const live = data.live;
    const head = cardHead('Live alerts', null);
    const dot = el('span', 'live-dot' + (live && live.url ? (live.lastError ? ' err' : ' on') : ''));
    head.insertBefore(dot, head.firstChild.nextSibling);
    card.appendChild(head);

    if (!live || !live.url || liveSetupOpen) {
      card.appendChild(el('div', 'live-status',
        'Adds Bank of America purchases, deposits and Zelle alerts from Gmail every 2 minutes. ' +
        'Set up gmail-alerts.gs (in your dashboard folder) in Google Apps Script, then paste its Web app URL and key here.'));
      const accounts = accountOptions(data).filter(o => o[0]);
      const current = live || {};
      const acctDefault = current.accountId || (accounts[0] ? accounts[0][0] : '');
      card.appendChild(buildForm([
        { name: 'url', label: 'Web app URL', placeholder: 'https://script.google.com/macros/s/…/exec', value: current.url || '', required: true, span: true },
        { name: 'key', label: 'Dashboard key', placeholder: 'From the setup() log', value: current.key || '', required: true, span: true },
        { name: 'account', label: 'Add to account', type: 'select', options: accounts.length ? accounts : [['', 'No account']], value: acctDefault },
        { name: 'since', label: 'Start from', type: 'date', value: current.since || defaultSince(data, acctDefault) }
      ], live && live.url ? 'Save' : 'Connect', v => {
        const url = v.url.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
          alert('That doesn’t look like an Apps Script Web app URL (it should start with https://script.google.com/macros/s/ and end in /exec).');
          return;
        }
        const d = load();
        d.live = Object.assign({}, d.live || {}, { url, key: v.key.trim(), accountId: v.account, since: v.since || today(), lastError: '' });
        liveSetupOpen = false;
        save(d);
        sync(true);
      }, live && live.url ? () => { liveSetupOpen = false; render(); } : null));
      return;
    }

    const acct = data.accounts.find(a => a.id === live.accountId);
    const status = el('div', 'live-status');
    if (live.checking) status.append(el('span', 'spinner'), document.createTextNode('Checking Gmail…'));
    else if (live.lastError) status.appendChild(el('span', 'err', live.lastError));
    else {
      status.append(el('b', null, 'Connected'), document.createTextNode(
        ' · checked ' + (live.lastSync ? timeAgo(live.lastSync).toLowerCase() : 'not yet') +
        (live.lastAdded ? ' · ' + live.lastAdded + ' new' : '')));
    }
    status.appendChild(el('br'));
    status.appendChild(document.createTextNode('Adding to ' + (acct ? acct.name : 'no account') + ' from ' + shortDate(live.since) + '.'));
    const pendingCount = data.txns.filter(t => t.pending).length;
    if (pendingCount) {
      status.appendChild(el('br'));
      status.appendChild(document.createTextNode(pendingCount + ' live transaction' + (pendingCount === 1 ? '' : 's') + ' waiting to be confirmed by your next statement import.'));
    }
    if (live.unparsed) {
      status.appendChild(el('br'));
      status.appendChild(el('span', 'err', live.unparsed + ' alert email' + (live.unparsed === 1 ? '' : 's') + ' couldn’t be read — run debugLatest() in the script.'));
    }
    card.appendChild(status);

    const actions = el('div', 'live-actions');
    const btn = (label, fn) => {
      const b = el('button', 'btn-ghost', label);
      b.type = 'button';
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    btn('Check now', () => sync(true));
    btn('Settings', () => { liveSetupOpen = true; renderLive(load()); });
    btn('Disconnect', () => {
      if (!confirm('Disconnect live alerts? Transactions already added stay.')) return;
      const d = load();
      delete d.live;
      save(d);
    });
    card.appendChild(actions);
  }

  function render() {
    const data = load();
    $('finMonth').textContent = new Date(dayMs(today())).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    renderStats(data);
    renderAccounts(data);
    renderInvestments(data);
    renderSpending(data);
    renderLive(data);
    renderUpcoming(data);
    renderSubs(data);
  }

  function init() {
    const fileInput = $('finImportFile');
    $('importCsvBtn').addEventListener('click', () => fileInput.click());
    $('importCsvBtnMobile').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) startImport(fileInput.files[0]);
      fileInput.value = '';
    });
    $('importModal').addEventListener('mousedown', e => { if (e.target === $('importModal')) closeImport(); });

    // Live alerts: check shortly after opening, every 2 minutes, and whenever the tab comes back into view.
    setTimeout(() => sync(false), 1500);
    setInterval(() => { if (!document.hidden) sync(false); }, LIVE_POLL_MS);
    document.addEventListener('visibilitychange', () => {
      const live = load().live;
      if (!document.hidden && live && live.url && Date.now() - (live.lastSync || 0) > 30000) sync(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && imp) closeImport(); });

    document.getElementById('addTxnBtn').addEventListener('click', () => {
      const input = $('finTxnAmount');
      if (!input) return;
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    });
  }

  // Shared with the Trades page's business tracker so payouts and trading costs live in one place.
  const api = {
    init,
    render,
    load,
    commit: save,
    addTxn,
    ui: { buildForm, finRow, cardHead, money, accountOptions }
  };
  return api;
})();

/* ================= Trading business (Trades page) ================= */
const TradingBiz = (() => {
  const $ = id => document.getElementById(id);
  // Trading costs: imported/live bank charges in the Trading category, plus anything added here.
  const TYPE_RULES = [
    [/tradingview|charting|sierra|ninjatrader|tradovate|jigsaw|bookmap/i, 'Platforms & charting'],
    [/tradeify|topstep|apex|sim2funded|ftmo|myfunded|take ?profit|funded|eval|lucid|alpha futures|bulenox/i, 'Evaluations'],
    [/whop|discord|course|mentor|profithub|community|education|real trading/i, 'Education'],
    [/data|rithmic|databento|cme|cqg/i, 'Market data']
  ];
  const TYPES = ['Evaluations', 'Platforms & charting', 'Education', 'Market data', 'Other'];
  const TRADING_NAME = /tradingview|tradeify|topstep|apex|sim2funded|ftmo|whop|profithub|ninjatrader|tradovate|rithmic|databento|funded|real trading/i;
  let period = 'month';
  let formOpen = null; // 'payout' | 'expense' | null

  const typeOf = t => t.tradeType || (TYPE_RULES.find(([re]) => re.test(t.note || '')) || [, 'Other'])[1];
  const vendorOf = t => String(t.note || 'Other').replace(/\s·\s.*$/, '').trim() || 'Other';
  const isTradingExpense = t => t.kind === 'expense' && t.category === 'Trading';
  const isTradingRefund = t => t.kind === 'income' && t.category === 'Refund' && TRADING_NAME.test(t.note || '');

  function inPeriod(ds) {
    const now = getActiveDateString();
    if (period === 'month') return ds.slice(0, 7) === now.slice(0, 7);
    if (period === 'year') return ds.slice(0, 4) === now.slice(0, 4);
    return true;
  }

  function totals(txns, filter) {
    const list = txns.filter(t => filter(t.date));
    const payouts = list.filter(t => t.kind === 'payout').reduce((s, t) => s + t.amount, 0);
    const expenses = list.filter(isTradingExpense).reduce((s, t) => s + t.amount, 0) -
      list.filter(isTradingRefund).reduce((s, t) => s + t.amount, 0);
    return { payouts, expenses, net: payouts - expenses };
  }

  function render() {
    const card = $('tradeBiz');
    const { buildForm, finRow, cardHead, money, accountOptions } = Finance.ui;
    const data = Finance.load();
    const txns = data.txns;
    card.innerHTML = '';

    // Header with period switch
    const head = cardHead('Trading business', null);
    const seg = el('div', 'seg seg-sm');
    [['month', 'Month'], ['year', 'Year'], ['all', 'All time']].forEach(([k, label]) => {
      const b = el('button', period === k ? 'active' : '', label);
      b.type = 'button';
      b.addEventListener('click', () => { period = k; render(); });
      seg.appendChild(b);
    });
    head.appendChild(seg);
    card.appendChild(head);

    // Stats
    const t = totals(txns, inPeriod);
    const stats = el('div', 'biz-stats');
    const stat = (label, value, cls, sub, hero) => {
      const box = el('div', 'biz-stat' + (hero ? ' hero' + (cls === 'neg' ? ' neg' : '') : ''));
      box.appendChild(el('div', 'jr-stat-label', label));
      const v = el('div', 'jr-stat-value' + (cls ? ' ' + cls : ''), value);
      if (sub) v.appendChild(el('span', 'jr-stat-sub', sub));
      box.appendChild(v);
      stats.appendChild(box);
    };
    const periodWord = period === 'month' ? 'this month' : period === 'year' ? 'this year' : 'all time';
    stat('Payouts', money(t.payouts), t.payouts > 0 ? 'pos' : '');
    stat('Trading expenses', money(t.expenses));
    stat('Net after expenses', (t.net > 0 ? '+' : '') + money(t.net), signClass(t.net), periodWord, true);
    if (t.expenses > 0) {
      const pct = Math.round(t.payouts / t.expenses * 100);
      stat('Expenses covered', pct + '%', pct >= 100 ? 'pos' : '', t.net < 0 ? money(-t.net) + ' to break even' : 'profitable');
    } else {
      stat('Expenses covered', t.payouts > 0 ? '∞' : '—');
    }
    card.appendChild(stats);

    const grid = el('div', 'biz-grid');

    // Column 1: net per month, last 6 months
    const c1 = el('div', 'biz-col');
    c1.appendChild(el('div', 'fin-sub-head')).appendChild(el('span', 'gm-eyebrow', 'Net per month'));
    const chart = el('div', 'biz-chart');
    c1.appendChild(chart);
    const months = el('div', 'biz-months');
    c1.appendChild(months);
    grid.appendChild(c1);

    // Column 2: where the money goes
    const c2 = el('div', 'biz-col');
    c2.appendChild(el('div', 'fin-sub-head')).appendChild(el('span', 'gm-eyebrow', 'Expenses by ' + (period === 'month' ? 'vendor this month' : 'vendor')));
    const byVendor = new Map();
    txns.filter(x => inPeriod(x.date)).forEach(x => {
      if (isTradingExpense(x)) byVendor.set(vendorOf(x), (byVendor.get(vendorOf(x)) || 0) + x.amount);
      if (isTradingRefund(x)) byVendor.set(vendorOf(x), (byVendor.get(vendorOf(x)) || 0) - x.amount);
    });
    const vendors = [...byVendor.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (vendors.length) {
      const bars = el('div', 'cat-bars');
      const max = vendors[0][1];
      vendors.forEach(([name, amt]) => {
        const sample = txns.find(x => vendorOf(x) === name && isTradingExpense(x));
        const row = el('div');
        const top = el('div', 'cat-top');
        const label = el('span', null, name);
        label.title = sample ? typeOf(sample) : '';
        top.append(label, el('b', null, money(amt)));
        const meter = el('div', 'meter');
        const fill = el('div', 'meter-fill meter-done');
        fill.style.width = (amt / max * 100) + '%';
        meter.appendChild(fill);
        row.append(top, meter);
        bars.appendChild(row);
      });
      c2.appendChild(bars);
    } else {
      c2.appendChild(el('div', 'fin-empty', 'No trading expenses ' + periodWord + '. Bank imports tag TradingView, prop firms and Whop automatically.'));
    }
    grid.appendChild(c2);

    // Column 3: payouts + add buttons
    const c3 = el('div', 'biz-col');
    c3.appendChild(el('div', 'fin-sub-head')).appendChild(el('span', 'gm-eyebrow', 'Payouts'));
    const actions = el('div', 'biz-actions');
    [['payout', '+ Payout'], ['expense', '+ Expense']].forEach(([k, label]) => {
      const b = el('button', 'btn-ghost', label);
      b.type = 'button';
      b.addEventListener('click', () => { formOpen = formOpen === k ? null : k; render(); });
      actions.appendChild(b);
    });
    c3.appendChild(actions);
    const today = getActiveDateString();
    if (formOpen === 'payout') {
      c3.appendChild(buildForm([
        { name: 'amount', label: 'Amount', type: 'number', min: '0', required: true },
        { name: 'date', label: 'Date', type: 'date', value: today },
        { name: 'source', label: 'From', placeholder: 'e.g. Tradeify, Topstep', span: true },
        { name: 'account', label: 'Deposited to', type: 'select', options: accountOptions(data), span: true }
      ], 'Add payout', v => {
        const d = Finance.load();
        Finance.addTxn(d, { kind: 'payout', amount: Math.abs(parseFloat(v.amount)) || 0, category: 'Trading', date: v.date || today, accountId: v.account, note: v.source.trim() || 'Payout' });
        formOpen = null;
        Finance.commit(d);
        render();
        Toast.show('Payout of ' + money(Math.abs(parseFloat(v.amount)) || 0) + ' added');
      }, () => { formOpen = null; render(); }));
    }
    if (formOpen === 'expense') {
      c3.appendChild(buildForm([
        { name: 'amount', label: 'Amount', type: 'number', min: '0', required: true },
        { name: 'date', label: 'Date', type: 'date', value: today },
        { name: 'vendor', label: 'Paid to', placeholder: 'e.g. Topstep eval reset', required: true, span: true },
        { name: 'type', label: 'Type', type: 'select', options: TYPES },
        { name: 'account', label: 'Paid from', type: 'select', options: accountOptions(data) }
      ], 'Add expense', v => {
        const d = Finance.load();
        Finance.addTxn(d, { kind: 'expense', amount: Math.abs(parseFloat(v.amount)) || 0, category: 'Trading', tradeType: v.type, date: v.date || today, accountId: v.account, note: v.vendor.trim() });
        formOpen = null;
        Finance.commit(d);
        render();
        Toast.show('Trading expense added');
      }, () => { formOpen = null; render(); }));
    }
    const payouts = txns.filter(x => x.kind === 'payout').sort((a, b) => b.date.localeCompare(a.date));
    const list = el('ul', 'fin-list');
    payouts.slice(0, 5).forEach(p => {
      list.appendChild(finRow({
        name: p.note || 'Payout',
        sub: shortDate(p.date),
        amount: '+' + money(p.amount),
        amountClass: 'pos',
        actions: [{ label: '×', title: 'Delete payout', danger: true, onClick: () => {
          const before = Finance.load();
          const d = Finance.load();
          d.txns = d.txns.filter(x => x.id !== p.id);
          Finance.commit(d);
          render();
          Toast.show('Deleted payout', { undo: () => { Finance.commit(before); render(); } });
        } }]
      }));
    });
    c3.appendChild(list);
    if (!payouts.length && !formOpen) c3.appendChild(el('div', 'fin-empty', 'No payouts yet — log one when a withdrawal hits your bank.'));
    grid.appendChild(c3);
    card.appendChild(grid);

    drawMonths(chart, months, txns);
  }

  // Net (payouts − expenses) for the last 6 months; blue above zero, red below.
  function drawMonths(wrap, labels, txns) {
    const W = wrap.clientWidth;
    if (!W) return;
    const H = wrap.clientHeight || 120;
    const [y, m] = getActiveDateString().split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      const t = totals(txns, ds => ds.slice(0, 7) === key);
      months.push({ key, label: d.toLocaleDateString('en-US', { month: 'short' }), t });
    }
    const vals = months.map(x => x.t.net);
    const maxAbs = Math.max(1, ...vals.map(Math.abs));
    const hasPos = vals.some(v => v > 0);
    const hasNeg = vals.some(v => v < 0);
    const zeroY = hasPos && hasNeg ? H / 2 : hasNeg ? 4 : H - 4;
    const room = hasPos && hasNeg ? H / 2 - 4 : H - 8;
    const slot = W / months.length;
    const bw = Math.min(34, slot * 0.55);
    let bars = '';
    months.forEach((mo, i) => {
      const v = mo.t.net;
      const tip = mo.label + ': payouts ' + Finance.ui.money(mo.t.payouts) + ' − expenses ' + Finance.ui.money(mo.t.expenses) + ' = ' + fmtMoney(v);
      const x = i * slot + (slot - bw) / 2;
      if (Math.abs(v) < 0.005) {
        bars += '<rect x="' + x.toFixed(1) + '" y="' + (zeroY - 1) + '" width="' + bw.toFixed(1) + '" height="2" rx="1" fill="rgba(255,255,255,0.25)"><title>' + tip + '</title></rect>';
        return;
      }
      const h = Math.max(3, Math.abs(v) / maxAbs * room);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + (v > 0 ? zeroY - h : zeroY).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="3" fill="' + (v > 0 ? 'var(--accent)' : 'var(--loss)') + '"><title>' + tip + '</title></rect>';
    });
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net trading income per month">' +
      '<line x1="0" x2="' + W + '" y1="' + zeroY + '" y2="' + zeroY + '" stroke="rgba(255,255,255,0.18)"/>' + bars + '</svg>';
    labels.style.gridTemplateColumns = 'repeat(' + months.length + ', minmax(0, 1fr))';
    labels.innerHTML = '';
    months.forEach(mo => labels.appendChild(el('span', null, mo.label)));
  }

  return { render };
})();

