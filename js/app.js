// App shell: navigation, sync loop, display, settings, islands, greeting, boot. Loaded last.
/* ---------------- Shell: nav, view, sidebar, search ---------------- */
const app = document.getElementById('app');
const board = document.getElementById('board');
const uiState = Object.assign({ view: 'board', sidebar: false }, storeGet(UI_KEY) || {});

function saveUi() { storeSet(UI_KEY, uiState); }

const PAGES = ['dashboard', 'trades', 'mental', 'review', 'finance', 'nutrition', 'gym', 'peptides'];
// Pages are grouped into four categories: the sidebar (bottom bar on phones) shows the categories,
// and each category shows its pages as tabs at the top.
const CATS = [
  { id: 'home', label: 'Home', pages: ['dashboard'] },
  { id: 'journals', label: 'Journals', pages: ['trades', 'mental', 'review'] },
  { id: 'money', label: 'Money', pages: ['finance'] },
  { id: 'health', label: 'Health', pages: ['nutrition', 'gym', 'peptides'] }
];
const catOf = page => CATS.find(c => c.pages.includes(page)) || CATS[0];
const pageLabel = page => { const n = document.querySelector('#pageIcons [data-page="' + page + '"] .side-label'); return n ? n.textContent : page; };
const pageIcon = page => { const n = document.querySelector('#pageIcons [data-page="' + page + '"] svg'); return n ? n.outerHTML : ''; };
// Entry counts shown next to journal tabs.
const pageCount = page => {
  const j = { trades: () => Trades, mental: () => Mental, review: () => Review }[page];
  return j ? j().getEntries().length : null;
};

// Category header at the top of the page: its name + a tab per page (+ settings / privacy on phones).
function renderCatBar(page) {
  const bar = document.getElementById('catBar');
  const cat = catOf(page);
  const multi = cat.pages.length > 1;
  app.classList.toggle('cat-multi', multi);
  bar.innerHTML = '';
  if (multi) {
    bar.appendChild(el('h1', 'dash-title cat-title', cat.label));
    const tabs = el('div', 'cat-tabs');
    tabs.setAttribute('role', 'tablist');
    cat.pages.forEach(pg => {
      const b = el('button', 'cat-tab' + (pg === page ? ' active' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(pg === page));
      b.innerHTML = pageIcon(pg);
      b.appendChild(el('span', null, pageLabel(pg)));
      const n = pageCount(pg);
      if (n != null) b.appendChild(el('em', null, String(n)));
      b.addEventListener('click', () => { if (pg !== uiState.page) setPage(pg); });
      tabs.appendChild(b);
    });
    bar.appendChild(tabs);
  }
  // Phones have no sidebar gear or top bar, so privacy + settings sit here.
  const tools = el('div', 'cat-tools mobile-only');
  const eye = el('button', 'icon-btn privacy-btn');
  eye.type = 'button';
  const gear = el('button', 'icon-btn cat-gear');
  gear.type = 'button';
  gear.title = 'Settings';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML = document.querySelector('#sideSettings svg').outerHTML;
  gear.addEventListener('click', () => Islands.openSettings());
  tools.append(eye, gear);
  bar.appendChild(tools);
  Privacy.paintButtons();
  const crumb = document.getElementById('topbarPage');
  crumb.innerHTML = '';
  crumb.append(el('span', 'crumb-cat', cat.label + ' / '), el('b', null, pageLabel(page)));
}

// Sidebar categories: click opens the last page you used in it; on PC, hovering shows its pages.
function initCategories() {
  const fly = el('div', 'cat-fly');
  fly.hidden = true;
  document.body.appendChild(fly);
  let hideTimer = null;
  const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
  const closeFly = now => {
    clearTimeout(hideTimer);
    const go = () => { fly.hidden = true; document.querySelectorAll('.side-item.fly-open').forEach(b => b.classList.remove('fly-open')); };
    if (now) go(); else hideTimer = setTimeout(go, 180);
  };
  const openFly = (btn, cat) => {
    clearTimeout(hideTimer);
    if (cat.pages.length < 2 || isPhone()) { closeFly(true); return; }
    fly.innerHTML = '';
    fly.appendChild(el('div', 'cat-fly-head', cat.label));
    cat.pages.forEach(pg => {
      const item = el('button', 'cat-fly-item' + (pg === uiState.page ? ' active' : ''));
      item.type = 'button';
      item.innerHTML = pageIcon(pg);
      item.appendChild(el('span', null, pageLabel(pg)));
      const n = pageCount(pg);
      if (n != null) item.appendChild(el('em', null, String(n)));
      item.addEventListener('click', () => { closeFly(true); setPage(pg); });
      fly.appendChild(item);
    });
    const r = btn.getBoundingClientRect();
    fly.style.left = Math.round(r.right + 10) + 'px';
    fly.style.top = Math.round(r.top - 8) + 'px';
    document.querySelectorAll('.side-item.fly-open').forEach(b => b.classList.remove('fly-open'));
    btn.classList.add('fly-open');
    fly.hidden = false;
  };
  document.querySelectorAll('.side-item[data-cat]').forEach(btn => {
    const cat = CATS.find(c => c.id === btn.dataset.cat);
    if (cat.pages.length > 1) btn.classList.add('has-fly');
    btn.addEventListener('click', () => {
      const last = uiState.catLast && uiState.catLast[cat.id];
      const target = cat.pages.includes(last) ? last : cat.pages[0];
      if (target !== uiState.page) setPage(target);
      closeFly(true);
    });
    btn.addEventListener('mouseenter', () => openFly(btn, cat));
    btn.addEventListener('mouseleave', () => closeFly());
    btn.addEventListener('focus', () => { if (!isPhone()) openFly(btn, cat); });
  });
  fly.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  fly.addEventListener('mouseleave', () => closeFly());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFly(true); });
  document.addEventListener('click', e => { if (!fly.hidden && !e.target.closest('.cat-fly, .side-item[data-cat]')) closeFly(true); });
}

// Dashboard: "Today's focus" from last night's Daily review.
function renderFocus() {
  const banner = document.getElementById('focusBanner');
  const today = getActiveDateString();
  const recent = Review.getEntries()
    .filter(e => (e.focus || '').trim() && e.date < today && e.date >= shiftDate(today, -2))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated - a.updated)[0];
  banner.hidden = !recent;
  if (!recent) return;
  banner.innerHTML = '';
  const icon = el('span', 'fb-icon');
  icon.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/></svg>';
  const txt = el('span', 'fb-text');
  txt.append(el('span', 'fb-label', 'Today’s focus'), el('span', 'fb-focus', recent.focus.trim()));
  banner.append(icon, txt, el('span', 'fb-from', 'from ' + (recent.date === shiftDate(today, -1) ? 'last night’s' : shortDate(recent.date)) + ' review'));
  banner.onclick = () => Peek.open(Review, recent.id);
}

function applyUi() {
  board.classList.toggle('is-list', uiState.view === 'list');
  document.querySelectorAll('.seg [data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === uiState.view);
  });
  app.classList.toggle('sidebar-expanded', !!uiState.sidebar);
  document.getElementById('sideExpandLabel').textContent = uiState.sidebar ? 'Collapse' : 'Expand';
}

document.querySelectorAll('.seg [data-view]').forEach(b => {
  b.addEventListener('click', () => {
    uiState.view = b.dataset.view;
    saveUi();
    applyUi();
  });
});

document.getElementById('sideExpand').addEventListener('click', () => {
  uiState.sidebar = !uiState.sidebar;
  saveUi();
  applyUi();
  if (uiState.page === 'gym') Gym.renderChart();
  if (uiState.page === 'dashboard') Overview.render();
});

function setPage(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  uiState.page = page;
  saveUi();
  app.dataset.page = page;
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== page; });
  const cat = catOf(page);
  uiState.catLast = Object.assign({}, uiState.catLast, { [cat.id]: page });
  saveUi();
  document.querySelectorAll('.side-item[data-cat]').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat.id);
  });
  renderCatBar(page);
  document.querySelectorAll('[data-only]').forEach(n => {
    n.classList.toggle('page-hidden', !n.dataset.only.split(' ').includes(page));
  });
  try {
    if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  } catch (e) { /* file:// may block this; harmless */ }
  document.getElementById('mainScroll').scrollTop = 0;
  window.scrollTo(0, 0);
  FinLock.onPage(page);
  renderPage(page);

  // Bars sweep in only while a page has just opened (so later updates don't replay it).
  const pageEl = document.querySelector('.page[data-page="' + page + '"]');
  document.querySelectorAll('.page-enter').forEach(p => p.classList.remove('page-enter'));
  void pageEl.offsetWidth;
  pageEl.classList.add('page-enter');
  clearTimeout(setPage.enterTimer);
  setPage.enterTimer = setTimeout(() => pageEl.classList.remove('page-enter'), 1200);
}

// Re-draws one page from storage (used on navigation and when synced changes arrive).
function renderPage(page) {
  if (page === 'dashboard') { Overview.render(); renderFocus(); }
  if (['trades', 'mental', 'review'].includes(page)) renderCatBar(page); // keeps tab counts current
  if (page === 'finance' && !FinLock.locked()) Finance.render();
  if (page === 'peptides') Peptides.render();
  if (page === 'trades') { Trades.render(); TradingBiz.render(); }
  if (page === 'mental') Mental.render();
  if (page === 'review') Review.render();
  if (page === 'nutrition') Nutrition.render();
  if (page === 'gym') Gym.render();
}

/* ---------------- Sync loop ---------------- */
// Changes from the other device: refresh what's on screen without jumping to the top.
async function syncNow() {
  const result = await Sync.pull();
  if (result && result.changed) {
    runRollover();
    loadToday();
    renderStreak();
    GoalTicker.start();
    updateGreeting();
    renderPage(uiState.page);
    window.dispatchEvent(new Event('pulse:synced'));
    // Bring down any new journal photos, then redraw the journals so covers appear.
    PhotoSync.prefetch().then(got => {
      if (got && ['trades', 'mental', 'review'].includes(uiState.page)) renderPage(uiState.page);
    });
  }
  if (PhotoSync.pending()) PhotoSync.flush();
}
setInterval(() => { if (!document.hidden && Sync.configured()) syncNow(); }, 15000);
document.addEventListener('visibilitychange', () => {
  if (!Sync.configured()) return;
  if (document.hidden) Sync.push(true); // send anything unsent before the app is put away
  else syncNow();
});

// Cascade order for each page's main blocks (they rise in one after another when the page opens).
document.querySelectorAll('.page').forEach(pageEl => {
  let i = 0;
  pageEl.querySelectorAll('.title-row, .day-line, .ticker-row, .section-title, .column, .jr-head, .jr-stats, .jr-strip, .cal, .jr-feed, .pep-block').forEach(block => {
    const outer = block.parentElement && block.parentElement.closest('.column, .cal');
    if (outer && pageEl.contains(outer)) return; // only top-level blocks
    block.classList.add('enter');
    block.style.setProperty('--i', String(Math.min(i++, 9)));
  });
});

initCategories();


window.addEventListener('hashchange', () => {
  const page = location.hash.slice(1);
  if (PAGES.includes(page) && page !== uiState.page) setPage(page);
});

/* ---------------- Display: layout zoom + text size (per device) ---------------- */
const Display = (() => {
  const KEY = 'pasive_display_v1';
  const LIMITS = { layout: [70, 120], text: [80, 140] };
  const STEP = 5;
  const state = { layout: 100, text: 100 };
  try { Object.assign(state, JSON.parse(Store.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }

  // Every px font-size in the stylesheet follows --text-scale, so text can grow or shrink on its own.
  (function scaleFonts() {
    const walk = rules => [...rules].forEach(r => {
      if (r.cssRules) walk(r.cssRules);
      if (r.style && /^\d+(\.\d+)?px$/.test(r.style.fontSize)) {
        r.style.fontSize = 'calc(' + r.style.fontSize + ' * var(--text-scale, 1))';
      }
    });
    [...document.styleSheets].forEach(s => { try { walk(s.cssRules); } catch (e) { /* cross-origin sheet */ } });
  })();

  function apply() {
    const root = document.documentElement.style;
    root.setProperty('--ui-zoom', String(state.layout / 100));
    root.setProperty('--text-scale', String(state.text / 100));
  }

  function set(kind, value) {
    const [lo, hi] = LIMITS[kind];
    state[kind] = Math.min(hi, Math.max(lo, Math.round(value / STEP) * STEP));
    try { Store.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    apply();
  }

  apply();
  return { KEY, LIMITS, STEP, get: kind => state[kind], set };
})();

/* ---------------- Settings: API keys, install, backup / restore ---------------- */
const Settings = (() => {
  const LAST_BACKUP_KEY = 'dashboard_last_backup';
  // Not included in backups: secrets (so a backup file never leaks an API key), backup bookkeeping,
  // and display sizes (those are per device).
  const SKIP_KEYS = [SECRETS_KEY, LAST_BACKUP_KEY, Display.KEY, 'pulse_sync_meta_v1', 'pulse_photo_queue_v1'];
  let installPrompt = null;
  let status = {};

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; status.install = 'Installed — open it from your desktop, Start menu or home screen.'; });

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || isIOS();

  function section(title, note) {
    const s = el('div', 'set-section');
    s.appendChild(el('div', 'set-title', title));
    if (note) {
      const n = el('div', 'set-note');
      n.innerHTML = note; // static text written in this file, never user input
      s.appendChild(n);
    }
    return s;
  }

  function button(label, cls, fn) {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function keyField(wrap, label, name, placeholder) {
    wrap.appendChild(el('div', 'set-field-label', label));
    const row = el('div', 'settings-row');
    const input = el('input', 'goal-input sm secret-input');
    input.type = 'text';
    input.name = 'pasive-' + name + '-key';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-1p-ignore', 'true');
    input.spellcheck = false;
    input.placeholder = placeholder;
    row.appendChild(input);
    row.appendChild(button('Save', 'btn-primary', () => {
      const v = cleanApiKey(input.value);
      if (!v) { input.focus(); return; }
      if (name === 'anthropic' && !/^sk-ant-api\d{2}-/.test(v) &&
          !confirm('That doesn’t look like an Anthropic API key (they start with “sk-ant-api03-”). Save it anyway?')) return;
      Secrets.set(name, v);
      status[name] = 'Saved on this device.';
      render();
      Toast.show('Key saved');
    }));
    const current = Secrets.get(name);
    if (current && name === 'anthropic') {
      row.appendChild(button('Test', 'btn-secondary', async () => {
        status[name] = 'Testing…';
        render();
        const problem = await testAnthropicKey(anthropicKey());
        status[name] = problem ? '✕ ' + problem : '✓ Key works.';
        render();
      }));
    }
    if (current) {
      row.appendChild(button('Remove', 'btn-secondary', () => {
        Secrets.set(name, '');
        status[name] = 'Removed from this device.';
        render();
      }));
    }
    wrap.appendChild(row);
    wrap.appendChild(el('div', 'set-status' + (/^✕/.test(status[name] || '') ? ' err' : current ? ' ok' : ''),
      status[name] || (current ? 'Saved on this device · ends in …' + current.slice(-4) : 'Not set')));
  }

  function render() {
    const body = document.getElementById('settingsBody');
    body.innerHTML = '';

    // Install
    const install = section('Install the app',
      'Opens in its own window with an icon on your desktop / home screen, works offline, and updates itself whenever you upload a new version to Netlify.');
    const ist = el('div', 'set-status');
    if (isStandalone()) {
      ist.className = 'set-status ok';
      ist.textContent = 'You’re using the installed app.';
    } else if (!/^https?:$/.test(location.protocol)) {
      ist.textContent = 'Open your Netlify site (https://…netlify.app) to install — it can’t be installed from a file on your computer.';
    } else if (installPrompt) {
      install.appendChild(button('Install Pulse', 'btn-primary', async () => {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installPrompt = null;
        status.install = choice.outcome === 'accepted' ? 'Installing…' : 'Install cancelled.';
        render();
      }));
    } else if (isIOS()) {
      ist.innerHTML = 'On iPhone: open this site in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.';
    } else if (/Android/i.test(navigator.userAgent)) {
      ist.innerHTML = 'In Chrome: tap <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>).';
    } else {
      ist.innerHTML = 'In Chrome or Edge: click the <b>install icon</b> at the right end of the address bar, or <b>⋯ → Apps → Install</b>.';
    }
    if (status.install) ist.textContent = status.install;
    if (ist.textContent || ist.innerHTML) install.appendChild(ist);
    body.appendChild(install);

    // Sync between devices
    const sync = section('Sync between devices',
      'Keeps Pulse on your phone and PC in step through your own Google Apps Script (the same one as Live alerts). ' +
      'Changes show up on your other device within about 15 seconds. Connect your <b>PC first</b>, then your phone. ' +
      'Journal photos sync too (saved in a “Pulse photos” folder in your Google Drive).');
    const st = el('div', 'set-status');
    if (Sync.configured()) {
      const s = Sync.state;
      if (s.lastError) { st.className = 'set-status err'; st.textContent = s.lastError; }
      else {
        st.className = 'set-status ok';
        st.textContent = 'Connected' + (s.lastSync ? ' · synced ' + timeAgo(s.lastSync).toLowerCase() : '') +
          (Sync.pending() ? ' · ' + Sync.pending() + ' change' + (Sync.pending() === 1 ? '' : 's') + ' waiting to upload' : '') +
          (PhotoSync.pending() ? ' · ' + PhotoSync.pending() + ' photo' + (PhotoSync.pending() === 1 ? '' : 's') + ' syncing' : '');
      }
      const row = el('div', 'settings-row');
      row.appendChild(button('Sync now', 'btn-primary', async () => {
        await Sync.push();
        await syncNow();
        render();
        Toast.show(Sync.state.lastError ? 'Sync failed' : 'Synced');
      }));
      row.appendChild(button('Disconnect', 'btn-secondary', () => {
        if (!confirm('Stop syncing this device? Its data stays here.')) return;
        Sync.disconnect();
        render();
      }));
      sync.appendChild(row);
      sync.appendChild(st);
    } else {
      // Pre-fill from Live alerts if that's already set up on this device.
      const live = (() => { try { return Finance.load().live || {}; } catch (e) { return {}; } })();
      sync.appendChild(el('div', 'set-field-label', 'Web app URL'));
      const urlInput = el('input', 'goal-input sm');
      urlInput.type = 'url';
      urlInput.placeholder = 'https://script.google.com/macros/s/…/exec';
      urlInput.value = live.url || '';
      const urlRow = el('div', 'settings-row');
      urlRow.appendChild(urlInput);
      sync.appendChild(urlRow);
      sync.appendChild(el('div', 'set-field-label', 'Dashboard key'));
      const keyInput = el('input', 'goal-input sm secret-input');
      keyInput.type = 'text';
      keyInput.setAttribute('autocomplete', 'off');
      keyInput.placeholder = 'From the script’s setup() log';
      keyInput.value = live.key || '';
      const keyRow = el('div', 'settings-row');
      keyRow.appendChild(keyInput);
      keyRow.appendChild(button('Connect', 'btn-primary', async () => {
        const u = urlInput.value.trim();
        const k = keyInput.value.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) { urlInput.focus(); Toast.show('That URL should start with https://script.google.com/macros/s/'); return; }
        if (!k) { keyInput.focus(); return; }
        Secrets.set('syncUrl', u);
        Secrets.set('syncKey', k);
        st.textContent = 'Connecting…';
        sync.appendChild(st);
        await Sync.connect();
        if (Sync.state.lastError) {
          Toast.show('Couldn’t connect — see Settings');
        } else {
          await syncNow();
          PhotoSync.enqueueLocal();
          PhotoSync.prefetch();
          Toast.show('Sync connected');
        }
        render();
      }));
      sync.appendChild(keyRow);
      st.textContent = 'Not connected on this device.';
      sync.appendChild(st);
    }
    body.appendChild(sync);

    // Name used in the dashboard greeting
    const profile = section('Your name', 'Shown in the greeting on your dashboard.');
    const nameRow = el('div', 'settings-row');
    const nameInput = el('input', 'goal-input sm');
    nameInput.type = 'text';
    nameInput.value = Profile.name();
    nameInput.placeholder = 'Your name';
    nameInput.setAttribute('autocomplete', 'nickname');
    const saveName = () => { Profile.setName(nameInput.value); Toast.show('Name saved'); };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
    nameRow.append(nameInput, button('Save', 'btn-primary', saveName));
    profile.appendChild(nameRow);
    body.appendChild(profile);

    // Privacy: blur amounts + Finance PIN
    const priv = section('Privacy',
      '<b>Hide amounts</b> blurs every dollar figure — balances, spending, P&amp;L, payouts — on this device until you turn it off (the eye button does the same). ' +
      'The <b>Finance PIN</b> is asked for whenever you open Finance after being away for a minute; it syncs, so it’s the same PIN on your phone and PC.');
    const privRow = el('div', 'settings-row');
    privRow.appendChild(button(Privacy.isOn() ? 'Show amounts' : 'Hide amounts', Privacy.isOn() ? 'btn-secondary' : 'btn-primary', () => { Privacy.toggle(); render(); }));
    priv.appendChild(privRow);
    priv.appendChild(el('div', 'set-status' + (Privacy.isOn() ? ' ok' : ''), Privacy.isOn() ? 'Amounts are hidden on this device.' : 'Amounts are visible.'));
    const pinRow = el('div', 'settings-row');
    const closeSheet = () => { const x = document.querySelector('#settingsSheet [data-close]'); if (x) x.click(); };
    if (FinLock.isSet()) {
      pinRow.appendChild(button('Change PIN', 'btn-primary', () => { closeSheet(); FinLock.change(); }));
      pinRow.appendChild(button('Remove PIN', 'btn-secondary', () => { closeSheet(); FinLock.remove(); }));
    } else {
      pinRow.appendChild(button('Set a Finance PIN', 'btn-primary', () => { closeSheet(); FinLock.startSetup(); }));
    }
    priv.appendChild(pinRow);
    priv.appendChild(el('div', 'set-status' + (FinLock.isSet() ? ' ok' : ''), FinLock.isSet() ? 'Finance is protected with a PIN.' : 'No PIN — Finance opens freely.'));
    body.appendChild(priv);

    // Display
    const display = section('Display',
      'Saved on this device only. <b>Layout size</b> shrinks or grows the cards; <b>Text size</b> changes just the text.');
    [['layout', 'Layout size', 'Smaller fits more on screen'], ['text', 'Text size', 'Makes text easier to read']].forEach(([kind, label, hint]) => {
      const row = el('div', 'display-row');
      const info = el('div', 'display-info');
      info.append(el('div', 'display-label', label), el('div', 'display-hint', hint));
      const [lo, hi] = Display.LIMITS[kind];
      const stepper = el('div', 'stepper settings-stepper');
      const minus = el('button', null, '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', label + ' smaller');
      const value = el('span', null, Display.get(kind) + '%');
      const plus = el('button', null, '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', label + ' bigger');
      const sync = () => {
        value.textContent = Display.get(kind) + '%';
        minus.disabled = Display.get(kind) <= lo;
        plus.disabled = Display.get(kind) >= hi;
      };
      minus.addEventListener('click', () => { Display.set(kind, Display.get(kind) - Display.STEP); sync(); });
      plus.addEventListener('click', () => { Display.set(kind, Display.get(kind) + Display.STEP); sync(); });
      sync();
      stepper.append(minus, value, plus);
      row.append(info, stepper);
      display.appendChild(row);
    });
    const reset = button('Reset to 100%', 'btn-ghost btn-xs display-reset', () => {
      Display.set('layout', 100);
      Display.set('text', 100);
      render();
    });
    display.appendChild(reset);
    body.appendChild(display);

    // API keys
    const keys = section('API keys',
      'Kept only in this browser — never in the files you upload, and never in backups. Add them on each device you use.');
    keyField(keys, 'Anthropic (meal photo scan + ✦ Polish)', 'anthropic', 'sk-ant-api03-…');
    keyField(keys, 'USDA FoodData Central (optional, for more food searches)', 'usda', 'Free key from fdc.nal.usda.gov');
    body.appendChild(keys);

    // Backup
    const last = (() => { try { return Store.getItem(LAST_BACKUP_KEY); } catch (e) { return null; } })();
    const backup = section('Backup & restore',
      'One file with everything — goals, journals and their images, food, workouts, lifts, weight, peptides and finance. ' +
      'Keep it in OneDrive. Restoring replaces this device’s data with the file’s.' +
      (isIOS() ? ' <b>iPhone note:</b> the home-screen app and Safari keep separate data — use this to move data between them.' : ''));
    const row = el('div', 'settings-row');
    row.appendChild(button('Download backup', 'btn-primary', exportBackup));
    const file = el('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    file.addEventListener('change', () => { if (file.files[0]) restoreBackup(file.files[0]); file.value = ''; });
    row.appendChild(button('Restore from file', 'btn-secondary', () => file.click()));
    row.appendChild(file);
    backup.appendChild(row);
    backup.appendChild(el('div', 'set-status' + (status.backupErr ? ' err' : status.backup ? ' ok' : ''),
      status.backupErr || status.backup || (last ? 'Last backup: ' + new Date(last).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'No backup made on this device yet.')));
    // How much this device is storing, and where.
    const usage = el('div', 'set-status', Store.mode === 'idb' ? 'Storage: IndexedDB' : 'Storage: browser localStorage (limited to ~5 MB)');
    backup.appendChild(usage);
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
        if (est && est.usage != null) usage.textContent += ' · ' + mb(est.usage) + ' used' + (est.quota ? ' of ' + mb(est.quota) + ' available' : '');
      }).catch(() => { /* ignore */ });
    }
    body.appendChild(backup);
  }

  function appKeys() {
    const keys = [];
    for (let i = 0; i < Store.length; i++) {
      const k = Store.key(i);
      if (k && !SKIP_KEYS.includes(k)) keys.push(k);
    }
    return keys;
  }

  async function exportBackup() {
    status.backup = 'Preparing backup…';
    status.backupErr = '';
    render();
    try {
      const data = {};
      appKeys().forEach(k => { data[k] = Store.getItem(k); });
      const images = await Media.dump();
      const payload = { app: 'personal-dashboard', version: 1, exported: new Date().toISOString(), data, images };
      const name = 'pulse-backup-' + toDateString(new Date()) + '.json';
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const asFile = new File([blob], name, { type: 'application/json' });
      // Phones: the share sheet lets you save to Files / OneDrive. Computers: a normal download.
      if (isMobile() && navigator.canShare && navigator.canShare({ files: [asFile] })) {
        await navigator.share({ files: [asFile], title: 'Pulse backup' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }
      Store.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      const imgCount = Object.keys(images).length;
      status.backup = 'Backup saved (' + Object.keys(data).length + ' sections, ' + imgCount + ' image' + (imgCount === 1 ? '' : 's') + ').';
      Toast.show('Backup downloaded');
    } catch (e) {
      status.backup = '';
      status.backupErr = e && e.name === 'AbortError' ? 'Backup cancelled.' : 'Backup failed: ' + (e.message || e);
    }
    render();
  }

  function restoreBackup(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      let backup;
      try {
        backup = JSON.parse(String(reader.result));
      } catch (e) {
        status.backupErr = 'That file isn’t a dashboard backup.';
        render();
        return;
      }
      if (!backup || backup.app !== 'personal-dashboard' || typeof backup.data !== 'object') {
        status.backupErr = 'That file isn’t a dashboard backup.';
        render();
        return;
      }
      const when = backup.exported ? new Date(backup.exported).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'an unknown date';
      if (!confirm('Restore the backup from ' + when + '?\n\nThis replaces all dashboard data on this device. Your API keys stay.')) return;
      appKeys().forEach(k => Store.removeItem(k));
      Object.entries(backup.data).forEach(([k, v]) => {
        if (typeof v === 'string' && !SKIP_KEYS.includes(k)) Store.setItem(k, v);
      });
      let imageNote = '';
      try {
        await Media.restore(backup.images || {});
      } catch (e) {
        imageNote = '\n\nJournal images couldn’t be restored in this browser.';
      }
      await Store.flush();
      alert('Backup restored.' + imageNote);
      location.reload();
    };
    reader.readAsText(file);
  }

  return { render, exportBackup };
})();

/* Islands: day progress (both devices), settings, and the mobile "More" page picker */
const Islands = (() => {
  const day = document.getElementById('dayModal');
  const nav = document.getElementById('navSheet');
  const settings = document.getElementById('settingsSheet');
  const grid = document.getElementById('navGrid');
  const sheets = [day, nav, settings];

  function show(sheet) {
    sheets.forEach(s => { if (s !== sheet) { cancelClose(s); s.hidden = true; } });
    cancelClose(sheet);
    sheet.hidden = false;
    document.body.classList.add('island-open');
  }
  function hide(sheet) {
    if (sheet.hidden) return;
    animateOut(sheet, () => {
      sheet.hidden = true;
      if (sheets.every(s => s.hidden)) document.body.classList.remove('island-open');
    });
  }

  function buildNav() {
    grid.innerHTML = '';
    document.querySelectorAll('#pageIcons [data-page]').forEach(item => {
      const tile = el('button', 'nav-tile' + (item.dataset.page === uiState.page ? ' active' : ''));
      tile.type = 'button';
      tile.innerHTML = item.querySelector('svg').outerHTML;
      tile.appendChild(el('span', null, item.querySelector('.side-label').textContent));
      tile.addEventListener('click', () => {
        hide(nav);
        setPage(item.dataset.page);
      });
      grid.appendChild(tile);
    });
    // Phones have no sidebar gear, so Settings lives here too.
    const gear = document.getElementById('sideSettings');
    const tile = el('button', 'nav-tile');
    tile.type = 'button';
    tile.innerHTML = gear.querySelector('svg').outerHTML;
    tile.appendChild(el('span', null, 'Settings'));
    tile.addEventListener('click', () => { hide(nav); Islands.openSettings(); });
    grid.appendChild(tile);
    // Privacy mode toggle (phones have no top bar eye button).
    const eye = el('button', 'nav-tile' + (Privacy.isOn() ? ' active' : ''));
    eye.type = 'button';
    eye.innerHTML = Privacy.isOn() ? EYE_OFF_SVG : EYE_SVG;
    eye.appendChild(el('span', null, Privacy.isOn() ? 'Show $' : 'Hide $'));
    eye.addEventListener('click', () => { hide(nav); Privacy.toggle(); });
    grid.appendChild(eye);
  }

  sheets.forEach(sheet => {
    sheet.addEventListener('click', e => {
      if (e.target === sheet || e.target.closest('[data-close]')) hide(sheet);
    });
  });
  // Tapping anywhere on the day island closes it too (it has nothing to interact with).
  day.querySelector('.day-island').addEventListener('click', () => hide(day));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    sheets.forEach(s => { if (!s.hidden) hide(s); });
  });

  return {
    openDay() { updateDayBar(); show(day); },
    openNav() { buildNav(); show(nav); },
    openSettings() { Settings.render(); show(settings); }
  };
})();

document.getElementById('dayPill').addEventListener('click', () => Islands.openDay());
document.getElementById('sideMore').addEventListener('click', () => Islands.openNav());
document.getElementById('sideSettings').addEventListener('click', () => Islands.openSettings());

// Installable app: the service worker only runs on the Netlify site (https), not from a local file.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const registerSw = () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker not registered:', err));
  // Scripts start after saved data loads, which can be after the page's load event.
  if (document.readyState === 'complete') registerSw(); else window.addEventListener('load', registerSw);
}

window.addEventListener('store-error', () => Toast.show('Couldn’t save — your browser’s storage refused the write'));

const todayComposer = document.getElementById('todayComposer');
const todayInput = document.getElementById('goalInput');

// Overview cards link through to their full pages.
document.querySelectorAll('[data-goto]').forEach(b => {
  b.addEventListener('click', () => setPage(b.dataset.goto));
});

document.getElementById('newGoalBtn').addEventListener('click', () => {
  openComposer(todayComposer, todayInput);
  todayComposer.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('newTradeBtn').addEventListener('click', () => Trades.newEntry(getActiveDateString()));
document.getElementById('newMentalBtn').addEventListener('click', () => Mental.newEntry(getActiveDateString()));
// One review per day: "Review today" reopens today's if it already exists.
['newReviewBtn', 'newReviewBtnMobile'].forEach(id => document.getElementById(id).addEventListener('click', () => {
  const today = getActiveDateString();
  const existing = Review.getEntries().find(e => e.date === today);
  if (existing) Peek.open(Review, existing.id);
  else Review.newEntry(today);
}));

document.getElementById('scanMealBtn').addEventListener('click', () => {
  document.getElementById('mealPhoto').click();
});
document.getElementById('addFoodBtn').addEventListener('click', () => {
  const input = document.getElementById('foodSearch');
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();
});
document.getElementById('logWeightBtn').addEventListener('click', () => {
  const input = document.getElementById('weightInput');
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();
});

// Goal search: top bar on PC, a search box on the page on phones — kept in sync.
const mobileSearch = document.getElementById('searchInputMobile');
[els.search, mobileSearch].forEach(input => {
  input.addEventListener('input', () => {
    searchQuery = input.value.trim();
    (input === els.search ? mobileSearch : els.search).value = input.value;
    loadToday();
  });
});

/* ---------------- Greeting ("Good morning, Pasive") ---------------- */
const PROFILE_KEY = 'pulse_profile_v1';
const Profile = {
  name() {
    try { return (JSON.parse(Store.getItem(PROFILE_KEY) || '{}').name || 'Pasive').trim(); } catch (e) { return 'Pasive'; }
  },
  setName(name) {
    try { Store.setItem(PROFILE_KEY, JSON.stringify({ name: name.trim() })); } catch (e) { /* ignore */ }
    updateGreeting();
  }
};
function updateGreeting() {
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Good night';
  const name = Profile.name();
  document.getElementById('dashGreeting').textContent = name ? part + ', ' + name : part;
}

/* ---------------- New day while the app stays open ----------------
   Installed apps can sit suspended for days without reloading. Whenever the app is opened or
   comes back to the front (and once a minute), check whether the 6 AM day boundary has passed:
   carry over unfinished goals, update the streak and refresh every date on screen. */
let currentDay = getActiveDateString();
function checkNewDay() {
  const now = getActiveDateString();
  if (now === currentDay) return false;
  currentDay = now;
  runStreakCheck();
  runRollover();
  renderStreak();
  els.todayLabel.textContent = 'Today — ' + formatDate(now);
  loadToday();
  GoalTicker.start();
  const weightDate = document.getElementById('weightDate');
  if (weightDate) weightDate.value = now;
  setPage(uiState.page);
  Toast.show('New day — ' + formatDate(now) + '. Unfinished goals carried over.');
  return true;
}
function onResume() {
  checkNewDay();
  updateDayBar();
  updateGreeting();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) onResume(); });
window.addEventListener('focus', onResume);
window.addEventListener('pageshow', onResume);

if (WALLPAPER_URL) {
  document.getElementById('wallpaperPhoto').style.backgroundImage = 'url("' + WALLPAPER_URL + '")';
  document.querySelector('.wallpaper').classList.add('has-photo');
}

/* ---------------- Boot ---------------- */
// Streak runs before rollover so it can still see past days' records.
runStreakCheck();
runRollover();

applyUi();

els.todayLabel.textContent = 'Today — ' + formatDate(getActiveDateString());

wireComposer(todayComposer, todayInput);

makeAddHandlers(
  todayInput,
  document.getElementById('goalAddBtn'),
  document.getElementById('goalPolishBtn'),
  todayKey,
  document.getElementById('polishStatus'),
  loadToday
);

loadToday();
renderStreak();

GoalTicker.start();

Nutrition.init();
Gym.init();
Finance.init();
const hashPage = location.hash.slice(1);
setPage(PAGES.includes(hashPage) ? hashPage : uiState.page);

updateDayBar();
updateGreeting();
if (Sync.configured()) {
  setTimeout(() => {
    Sync.push();
    syncNow();
    PhotoSync.enqueueLocal();
    PhotoSync.prefetch();
  }, 600);
}
setInterval(() => {
  checkNewDay();
  updateDayBar();
  updateGreeting();
  refreshTimeLabels();
  if (uiState.page === 'dashboard') Overview.render();
}, 60 * 1000);
