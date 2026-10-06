// Secrets, sync, storage + date helpers, goals, ticker, day line, shared helpers, toasts.
// API keys are typed into Settings and stay in this browser only.
// Never put a key in this file: it's published on Netlify, so anyone could read it.
const SECRETS_KEY = 'dashboard_secrets_v1';
const Secrets = {
  all() {
    try { return JSON.parse(Store.getItem(SECRETS_KEY) || '{}') || {}; } catch (e) { return {}; }
  },
  get(name) { return String(this.all()[name] || '').trim(); },
  set(name, value) {
    const s = this.all();
    if (value) s[name] = value.trim(); else delete s[name];
    try { Store.setItem(SECRETS_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }
};
// Keys only contain letters, digits, - and _; drop anything else (hidden characters picked up when copying).
const cleanApiKey = k => String(k || '').replace(/[^A-Za-z0-9_-]/g, '');
const anthropicKey = () => cleanApiKey(Secrets.get('anthropic'));

// Checks a key against Anthropic without using any credit (lists models). Resolves to '' if it works,
// otherwise to what went wrong.
async function testAnthropicKey(key) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });
    if (res.ok) return '';
    let detail = '';
    try { const b = await res.json(); detail = b.error && b.error.message ? b.error.message : ''; } catch (e) { /* ignore */ }
    return 'Anthropic said ' + res.status + (detail ? ': ' + detail : '');
  } catch (e) {
    return 'Couldn’t reach Anthropic — check your connection.';
  }
}

/* ---------------- Sync between devices (via your Google Apps Script) ----------------
   Every saved piece of data is one Store entry (today's goals, trade journal, finance, …).
   Any write is noticed here, stamped with a time and sent up shortly after; other devices pull
   every 15 seconds while open (and whenever the app comes back to the front). For each entry
   the newest version wins. API keys, display sizes and which page is open stay per device. */
const Sync = (() => {
  const META_KEY = 'pulse_sync_meta_v1';
  const LOCAL_ONLY = new Set([SECRETS_KEY, META_KEY, 'pulse_photo_queue_v1', 'dashboard_last_backup', 'pasive_display_v1', 'dashboard_ui_v1', 'dashboard_card_tab']);
  // Keys starting with pulse_local_ are per-device preferences (journal view, privacy mode).
  const tracks = k => typeof k === 'string' && !LOCAL_ONLY.has(k) && !k.startsWith('pulse_local_');

  let pushTimer = null;
  let pushing = false;
  let pulling = false;
  const state = { lastSync: 0, lastError: '', listeners: [] };

  function readMeta() {
    try { return Object.assign({ t: {}, version: -1, dirty: [] }, JSON.parse(Store.getItem(META_KEY) || '{}')); }
    catch (e) { return { t: {}, version: -1, dirty: [] }; }
  }
  let meta = readMeta();
  function saveMeta() {
    Store.setItem(META_KEY, JSON.stringify(meta));
  }

  const url = () => Secrets.get('syncUrl');
  const key = () => Secrets.get('syncKey');
  const configured = () => !!(url() && key());

  function touch(k) {
    meta.t[k] = Date.now();
    if (!meta.dirty.includes(k)) meta.dirty.push(k);
    saveMeta();
    schedulePush();
  }

  // Notice every write, whichever part of the app makes it (remote data is applied with setQuiet).
  Store.onWrite(k => { if (tracks(k)) touch(k); });

  function notify() { state.listeners.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } }); }
  function ok() { state.lastSync = Date.now(); state.lastError = ''; notify(); }
  function fail(err) {
    state.lastError = /Failed to fetch|NetworkError|JSON|Unexpected token/i.test(String(err && err.message))
      ? 'Couldn’t reach your script — check the URL, that it’s deployed with access “Anyone”, and that you’re online.'
      : String(err && err.message || err);
    notify();
  }

  function schedulePush() {
    if (!configured()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  }

  async function push(keepalive) {
    if (!configured() || pushing || !meta.dirty.length) return;
    pushing = true;
    const names = meta.dirty.slice();
    const changes = {};
    names.forEach(k => { changes[k] = { v: Store.getItem(k), t: meta.t[k] || Date.now() }; });
    try {
      const res = await fetch(url(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // keeps it a "simple" request (no CORS preflight)
        body: JSON.stringify({ key: key(), action: 'push', changes }),
        keepalive: !!keepalive
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'Sync failed.');
      // Anything edited again while this was uploading stays queued.
      meta.dirty = meta.dirty.filter(k => !names.includes(k) || (meta.t[k] || 0) > changes[k].t);
      saveMeta();
      ok();
    } catch (e) {
      fail(e);
    } finally {
      pushing = false;
      if (meta.dirty.length) schedulePush();
    }
  }

  // Pull the latest from the script; returns how many entries changed on this device.
  async function pull(force) {
    if (!configured() || pulling) return 0;
    pulling = true;
    let changed = 0;
    try {
      const sep = url().includes('?') ? '&' : '?';
      const since = force ? '' : String(meta.version);
      const res = await fetch(url() + sep + 'action=pull&key=' + encodeURIComponent(key()) + '&since=' + encodeURIComponent(since));
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'Sync failed.');
      if (!body.unchanged) {
        Object.entries(body.keys || {}).forEach(([k, rec]) => {
          if (!tracks(k) || !rec) return;
          if (rec.t > (meta.t[k] || 0)) {
            const current = Store.getItem(k);
            if (rec.v === null) { if (current !== null) { Store.setQuiet(k, null); changed++; } }
            else if (current !== rec.v) { Store.setQuiet(k, rec.v); changed++; }
            meta.t[k] = rec.t;
            meta.dirty = meta.dirty.filter(x => x !== k);
          }
        });
        meta.version = body.version;
        saveMeta();
      }
      ok();
      return { changed, keys: body.keys || null };
    } catch (e) {
      fail(e);
      return 0;
    } finally {
      pulling = false;
    }
  }

  // First connect on a device: take anything newer from the other device, then upload whatever
  // only this device has (or has newer).
  async function connect() {
    const result = await pull(true);
    if (state.lastError) return result;
    const remote = (result && result.keys) || {};
    for (let i = 0; i < Store.length; i++) {
      const k = Store.key(i);
      if (!tracks(k)) continue;
      const r = remote[k];
      if (!r || (meta.t[k] || 0) > r.t) {
        meta.t[k] = meta.t[k] || Date.now();
        if (!meta.dirty.includes(k)) meta.dirty.push(k);
      }
    }
    saveMeta();
    await push();
    return result;
  }

  function disconnect() {
    Secrets.set('syncUrl', '');
    Secrets.set('syncKey', '');
    meta = { t: meta.t, version: -1, dirty: [] };
    saveMeta();
    state.lastError = '';
    notify();
  }

  return {
    configured, pull, push, connect, disconnect,
    state,
    onChange(fn) { state.listeners.push(fn); },
    pending: () => meta.dirty.length
  };
})();
// Online food search uses USDA FoodData Central. 'DEMO_KEY' allows ~30 searches/hour;
// a free personal key (fdc.nal.usda.gov/api-key-signup), saved in Settings, raises that to 1,000/hour.
const usdaKey = () => Secrets.get('usda') || 'DEMO_KEY';

// One Messages API request straight from the browser. `what` names the feature in error messages.
async function callClaude(body, what) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(Object.assign({
      model: MEAL_SCAN_MODEL,
      max_tokens: 16000,
      fallbacks: 'default',
      output_config: { effort: 'medium' }
    }, body))
  });
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.error && err.error.message ? err.error.message : '';
    } catch (e) { /* ignore */ }
    if (res.status === 401) {
      throw new Error('Anthropic rejected your API key' + (detail ? ' (“' + detail + '”)' : '') +
        '. Check it with Settings → API keys → Test, or create a new key at console.anthropic.com (it starts with “sk-ant-api03-”) and paste it there.');
    }
    if (/credit balance/i.test(detail)) {
      throw new Error('Your Anthropic account is out of credit — add some under Plans & Billing at console.anthropic.com.');
    }
    throw new Error(what + ' failed (' + res.status + ')' + (detail ? ': ' + detail : '.'));
  }
  return res.json();
}

// Model used to read meal photos (Nutrition → Scan a meal).
const MEAL_SCAN_MODEL = 'claude-opus-5-5';
// Model for recipe search, "Make my version" and meal plans: half the price, and plenty for recipe writing.
const RECIPE_MODEL = 'claude-sonnet-5-5';

// Optional: path or URL to your own background photo, e.g. 'wallpaper.jpg'.
const WALLPAPER_URL = 'wallpaper.jpg';

const WAKE_HOUR = 6;       // 6:00 AM
const SLEEP_HOUR = 23.75;  // 11:45 PM

const STREAK_KEY = 'goal_streak_v1';
const UI_KEY = 'dashboard_ui_v1';
const COLLAPSE_LIMIT = 5;

/* ---------------- Storage helpers ---------------- */
function storeGet(key) {
  try {
    const raw = Store.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function storeSet(key, value) {
  try {
    Store.setItem(key, JSON.stringify(value));
  } catch (e) { /* storage unavailable */ }
  if (key.startsWith('goals:')) {
    window.dispatchEvent(new CustomEvent('goals-changed'));
  }
}

function storeDelete(key) {
  try { Store.removeItem(key); } catch (e) { /* ignore */ }
}

function storeListKeys(prefix) {
  const keys = [];
  try {
    for (let i = 0; i < Store.length; i++) {
      const k = Store.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch (e) { /* ignore */ }
  return keys;
}

/* ---------------- Date helpers ---------------- */
function pad2(n) { return String(n).padStart(2, '0'); }

function toDateString(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function getActiveDateString() {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return toDateString(d);
}


function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

function formatClock(d) {
  const h = d.getHours() % 12 || 12;
  return h + ':' + pad2(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
}

function timeAgo(ts) {
  const secs = Math.max(0, (Date.now() - ts) / 1000);
  const plural = (n, unit) => n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return plural(mins, 'min');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, 'day');
  return plural(Math.floor(days / 7), 'week');
}

function todayKey()    { return 'goals:' + getActiveDateString(); }

function carryOver(g) {
  const copy = { text: g.text, done: false };
  if (g.createdAt) copy.createdAt = g.createdAt;
  return copy;
}

/* ---------------- Rollover + streak ---------------- */
function runStreakCheck() {
  const active = getActiveDateString();
  const state = storeGet(STREAK_KEY) || { count: 0, lastProcessedDate: null };
  const dates = storeListKeys('goals:')
    .map(k => k.slice(6))
    .filter(d => d < active && (!state.lastProcessedDate || d > state.lastProcessedDate))
    .sort();

  if (!dates.length) return;

  dates.forEach(d => {
    const goals = storeGet('goals:' + d) || [];
    if (goals.length === 0) return;
    if (goals.every(g => g.done)) state.count += 1;
    else state.count = 0;
  });
  state.lastProcessedDate = dates[dates.length - 1];
  storeSet(STREAK_KEY, state);
}

function runRollover() {
  const active = getActiveDateString();
  const key = todayKey();
  const oldKeys = storeListKeys('goals:').filter(k => k.slice(6) < active).sort();
  if (!oldKeys.length) return;

  const today = storeGet(key) || [];
  oldKeys.forEach(k => {
    const goals = storeGet(k) || [];
    goals.forEach(g => {
      if (!g.done && !today.some(t => t.text === g.text)) today.push(carryOver(g));
    });
    storeDelete(k);
  });
  storeSet(key, today);
}

/* ---------------- Render ---------------- */
const els = {
  todayCard: document.getElementById('gmTodayCard'),
  todayLabel: document.getElementById('todayLabel'),
  todayCount: document.getElementById('todayCount'),
  progressNum: document.getElementById('gmProgressNum'),
  progressTotal: document.getElementById('gmProgressTotal'),
  progressLabel: document.getElementById('gmProgressLabel'),
  streak: document.getElementById('gmStreak'),
  streakNum: document.getElementById('gmStreakNum'),
  bar: document.getElementById('gmBar'),
  goalList: document.getElementById('goalList'),
  emptyState: document.getElementById('emptyState'),
  search: document.getElementById('searchInput')
};

const expanded = { today: false };
let searchQuery = '';

function renderTodayHeader() {
  const goals = storeGet(todayKey()) || [];
  const total = goals.length;
  const done = goals.filter(g => g.done).length;
  const allDone = total > 0 && done === total;

  els.todayCount.textContent = total;
  els.progressNum.textContent = done;
  els.progressTotal.textContent = '/ ' + total;
  els.progressLabel.textContent =
    total === 0 ? 'no goals yet' : allDone ? 'all done — solid day' : 'complete';

  els.bar.innerHTML = '';
  goals.forEach(g => {
    const seg = document.createElement('div');
    seg.className = 'gm-bar-seg' + (g.done ? ' gm-bar-seg-done' : '');
    els.bar.appendChild(seg);
  });

  els.todayCard.classList.toggle('gm-all-done', allDone);
}

function renderStreak() {
  const state = storeGet(STREAK_KEY) || { count: 0 };
  const count = state.count || 0;
  els.streakNum.textContent = count;
  els.streak.classList.toggle('gm-streak-active', count > 0);
}

function reloadFor() {
  loadToday();
}

function renderListInto(goals, listEl, emptyEl, key, readOnly) {
  listEl.innerHTML = '';

  const which = 'today';
  const isExpanded = expanded[which];
  const collapse = goals.length > COLLAPSE_LIMIT && !searchQuery;
  const visible = collapse && !isExpanded ? COLLAPSE_LIMIT : goals.length;

  let shown = 0;
  for (let i = 0; i < visible; i++) {
    const row = buildGoalRow(goals, i, key, readOnly);
    if (!row.hidden) shown++;
    listEl.appendChild(row);
  }

  if (collapse) {
    const more = document.createElement('li');
    more.className = 'gm-more';
    more.textContent = isExpanded
      ? 'Show less ▴'
      : 'Show ' + (goals.length - COLLAPSE_LIMIT) + ' more ▾';
    more.addEventListener('click', () => {
      expanded[which] = !isExpanded;
      reloadFor(key);
    });
    listEl.appendChild(more);
  }

  if (!goals.length) {
    emptyEl.textContent = emptyEl.dataset.default;
    emptyEl.style.display = '';
  } else if (searchQuery && !shown) {
    emptyEl.textContent = 'No goals match “' + searchQuery + '”';
    emptyEl.style.display = '';
  } else {
    emptyEl.style.display = 'none';
  }

  renderTodayHeader();
}

function loadToday() {
  const goals = storeGet(todayKey()) || [];
  renderListInto(goals, els.goalList, els.emptyState, todayKey(), false);
}

/* ---------------- Goal cards ---------------- */
const BOLT_SVG = '<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6l1-8z"/></svg>';
let dragState = null;

function buildGoalRow(goals, idx, key, readOnly) {
  const g = goals[idx];
  const li = document.createElement('li');
  li.className = 'goal-item';
  if (g.createdAt && Date.now() - g.createdAt < 1500) li.classList.add('just-added');
  if (g.done) li.classList.add('done');
  if (g.queued && !readOnly) li.classList.add('queued');
  if (searchQuery && !g.text.toLowerCase().includes(searchQuery.toLowerCase())) li.hidden = true;

  if (!g.done && g.createdAt && Date.now() - g.createdAt < 2 * 60 * 1000) {
    const dot = document.createElement('span');
    dot.className = 'goal-new-dot';
    dot.title = 'New';
    li.appendChild(dot);
  }

  // Checkbox
  const checkWrap = document.createElement('label');
  checkWrap.className = 'goal-check';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!g.done;
  cb.setAttribute('aria-label', 'Mark goal done');
  const box = document.createElement('span');
  box.className = 'goal-check-box';
  checkWrap.appendChild(cb);
  checkWrap.appendChild(box);
  if (readOnly) {
    cb.disabled = true;
    checkWrap.title = 'Activates at 6 AM tomorrow';
  } else {
    cb.addEventListener('change', () => {
      const list = storeGet(key) || [];
      if (!list[idx]) return;
      list[idx].done = cb.checked;
      if (cb.checked) list[idx].doneAt = Date.now();
      else delete list[idx].doneAt;
      storeSet(key, list);
      reloadFor(key);
    });
  }
  li.appendChild(checkWrap);

  // Text + meta line
  const body = document.createElement('div');
  body.className = 'goal-body';

  const text = document.createElement('span');
  text.className = 'goal-text';
  text.textContent = g.text;
  makeInlineEdit(text, li, newText => {
    const list = storeGet(key) || [];
    if (!list[idx]) return;
    list[idx].text = newText;
    storeSet(key, list);
    reloadFor(key);
  });
  body.appendChild(text);

  const metaParts = [];
  if (g.done && g.doneAt) {
    metaParts.push({ text: 'Done ' + formatClock(new Date(g.doneAt)) });
  } else if (g.createdAt) {
    metaParts.push({ text: timeAgo(g.createdAt), created: g.createdAt });
  }
  if (g.queued && !readOnly) metaParts.push({ text: 'Queued', cls: 'meta-queued' });
  if (metaParts.length) {
    const meta = document.createElement('div');
    meta.className = 'goal-meta';
    metaParts.forEach(p => {
      const s = document.createElement('span');
      s.textContent = p.text;
      if (p.cls) s.className = p.cls;
      if (p.created) s.dataset.created = p.created;
      meta.appendChild(s);
    });
    body.appendChild(meta);
  }
  li.appendChild(body);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'goal-actions';

  const queueBtn = document.createElement('button');
  queueBtn.type = 'button';
  queueBtn.className = 'gm-queue-btn' + (g.queued && !readOnly ? ' active' : '');
  queueBtn.innerHTML = BOLT_SVG;
  if (readOnly) {
    queueBtn.disabled = true;
    queueBtn.title = 'Activates at 6 AM tomorrow';
  } else {
    queueBtn.title = g.queued ? 'Remove from productivity window' : 'Queue for productivity window';
    queueBtn.addEventListener('click', () => {
      const list = storeGet(key) || [];
      if (!list[idx]) return;
      list[idx].queued = !list[idx].queued;
      if (!list[idx].queued) delete list[idx].queued;
      storeSet(key, list);
      li.classList.toggle('queued');
      queueBtn.classList.toggle('active');
      li.classList.add('is-queue-flashing');
      setTimeout(() => reloadFor(key), 480);
    });
  }
  actions.appendChild(queueBtn);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'goal-delete';
  del.textContent = '×';
  del.title = 'Delete';
  del.addEventListener('click', () => {
    const before = storeGet(key) || [];
    const list = before.slice();
    const [removed] = list.splice(idx, 1);
    storeSet(key, list);
    reloadFor(key);
    Toast.show('Deleted “' + (removed ? removed.text : 'goal') + '”', {
      undo: () => { storeSet(key, before); reloadFor(key); }
    });
  });
  actions.appendChild(del);
  li.appendChild(actions);

  wireDragReorder(li, idx, key);
  return li;
}

function makeInlineEdit(textEl, li, onCommit) {
  textEl.addEventListener('click', () => {
    if (textEl.isContentEditable) return;
    const original = textEl.textContent;
    let finished = false;

    li.draggable = false;
    textEl.contentEditable = 'true';
    textEl.classList.add('editing');
    textEl.focus();

    const range = document.createRange();
    range.selectNodeContents(textEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function finish(commit) {
      if (finished) return;
      finished = true;
      textEl.removeEventListener('keydown', onKey);
      textEl.removeEventListener('blur', onBlur);
      textEl.contentEditable = 'false';
      textEl.classList.remove('editing');
      li.draggable = true;
      const next = textEl.textContent.trim();
      if (commit && next && next !== original) {
        onCommit(next);
      } else {
        textEl.textContent = original;
      }
    }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    }
    function onBlur() { finish(true); }

    textEl.addEventListener('keydown', onKey);
    textEl.addEventListener('blur', onBlur);
  });
}

function wireDragReorder(li, idx, key) {
  li.draggable = true;

  li.addEventListener('dragstart', e => {
    dragState = { key, from: idx };
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch (err) { /* ignore */ }
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.goal-item.drag-over').forEach(n => n.classList.remove('drag-over'));
    dragState = null;
  });

  li.addEventListener('dragover', e => {
    if (!dragState || dragState.key !== key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragState.from !== idx) li.classList.add('drag-over');
  });

  li.addEventListener('dragleave', e => {
    if (!li.contains(e.relatedTarget)) li.classList.remove('drag-over');
  });

  li.addEventListener('drop', e => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!dragState || dragState.key !== key) return;
    const from = dragState.from;
    const to = idx;
    dragState = null;
    if (from === to) return;
    const list = storeGet(key) || [];
    const [moved] = list.splice(from, 1);
    if (!moved) return;
    list.splice(to, 0, moved);
    storeSet(key, list);
    reloadFor(key);
  });
}

// Keep "10 mins ago" labels fresh without rebuilding rows (which would interrupt editing).
function refreshTimeLabels() {
  document.querySelectorAll('.goal-meta [data-created]').forEach(s => {
    s.textContent = timeAgo(Number(s.dataset.created));
  });
  document.querySelectorAll('.goal-new-dot').forEach(dot => {
    const created = dot.parentElement.querySelector('[data-created]');
    if (created && Date.now() - Number(created.dataset.created) >= 2 * 60 * 1000) dot.remove();
  });
}

/* ---------------- Bulk actions ---------------- */
document.getElementById('clearDoneBtn').addEventListener('click', () => {
  const today = storeGet(todayKey()) || [];
  const doneCount = today.filter(g => g.done).length;
  if (!doneCount) return;
  const key = todayKey();
  storeSet(key, today.filter(g => !g.done));
  loadToday();
  Toast.show('Cleared ' + doneCount + ' completed goal' + (doneCount === 1 ? '' : 's'), {
    undo: () => { storeSet(key, today); loadToday(); }
  });
});

/* ---------------- Composers (Add + Polish) ---------------- */
function wireComposer(composer, input) {
  composer.querySelector('.col-add').addEventListener('click', () => openComposer(composer, input));
  composer.addEventListener('focusout', e => {
    if (composer.contains(e.relatedTarget)) return;
    if (!input.value.trim()) composer.classList.remove('open');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });
}

function openComposer(composer, input) {
  composer.classList.add('open');
  input.focus();
}

function makeAddHandlers(input, addBtn, polishBtn, getKey, statusEl, reload) {
  let statusTimer = null;

  function showStatus(msg, isError) {
    clearTimeout(statusTimer);
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
    if (msg) {
      statusTimer = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.classList.remove('error');
      }, 3500);
    }
  }

  function pushGoal(text) {
    const key = getKey();
    const list = storeGet(key) || [];
    list.push({ text, done: false, createdAt: Date.now() });
    storeSet(key, list);
    input.value = '';
    reload();
  }

  function add() {
    const text = input.value.trim();
    if (!text) return;
    pushGoal(text);
    input.focus();
  }

  async function polish() {
    const raw = input.value.trim();
    if (!raw) return;

    if (!anthropicKey()) {
      pushGoal(raw);
      showStatus('Polish needs an Anthropic API key (add it in Settings) — added as-typed.', false);
      input.focus();
      return;
    }

    addBtn.disabled = true;
    polishBtn.disabled = true;
    clearTimeout(statusTimer);
    statusEl.classList.remove('error');
    statusEl.textContent = 'Polishing…';

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content:
              'Clean up exactly ONE goal for a personal to-do list. Fix spelling and grammar, ' +
              'make it concise and action-oriented, keep the original meaning, and do not add ' +
              'new tasks or split it into multiple goals.\n\n' +
              'Return ONLY a one-element JSON array of strings, like ["Finish the report"]. ' +
              'No preamble, no explanation, no code fences.\n\n' +
              'Goal: ' + raw
          }]
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const reply = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/, '')
        .trim();
      const arr = JSON.parse(reply);
      const cleaned = Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0].trim() : '';
      if (!cleaned) throw new Error('Bad response shape');
      pushGoal(cleaned);
      showStatus('', false);
    } catch (err) {
      console.warn('Polish failed:', err);
      pushGoal(raw);
      showStatus('Polish failed — added as-typed.', true);
    } finally {
      addBtn.disabled = false;
      polishBtn.disabled = false;
      input.focus();
    }
  }

  addBtn.addEventListener('click', add);
  polishBtn.addEventListener('click', polish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      add();
    }
  });
}

/* ---------------- Goal Ticker ---------------- */
const GoalTicker = (() => {
  const stage = document.getElementById('goalTickerStage');
  const meta = document.getElementById('goalTickerMeta');
  let cycleIdx = 0;
  let timer = null;
  let firstRender = true;

  function buildItems() {
    const goals = storeGet(todayKey()) || [];
    const total = goals.length;
    const done = goals.filter(g => g.done).length;
    let items;
    if (total === 0) {
      items = [{ status: 'empty', text: 'No goals set for today — add one to get rolling.' }];
    } else if (done === total) {
      items = [{ status: 'done', text: '✓ All goals done — solid day.' }];
    } else {
      items = goals.filter(g => !g.done).map(g => ({ status: 'pending', text: g.text }));
    }
    return { items, done, total };
  }

  function glyphFor(status) {
    if (status === 'done') return '✓';
    if (status === 'pending') return '○';
    return '·';
  }

  function makeRow(item) {
    const row = document.createElement('div');
    row.className = 'goal-ticker-row';
    const status = document.createElement('span');
    status.className = 'goal-ticker-status';
    status.dataset.status = item.status;
    status.textContent = glyphFor(item.status);
    const text = document.createElement('span');
    text.className = 'goal-ticker-text';
    text.textContent = item.text;
    text.title = item.text;
    row.appendChild(status);
    row.appendChild(text);
    return row;
  }

  function tick() {
    const { items, done, total } = buildItems();
    if (cycleIdx >= items.length) cycleIdx = 0;
    const item = items[cycleIdx];
    cycleIdx = (cycleIdx + 1) % items.length;
    meta.textContent = done + '/' + total;

    const next = makeRow(item);

    if (firstRender) {
      stage.innerHTML = '';
      stage.appendChild(next);
      firstRender = false;
      return;
    }

    stage.querySelectorAll('.goal-ticker-row:not(.is-leaving)').forEach(old => {
      old.classList.remove('is-entering');
      old.classList.add('is-leaving');
      setTimeout(() => old.remove(), 460);
    });
    next.classList.add('is-entering');
    stage.appendChild(next);
  }

  function start() {
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 5000);
  }

  window.addEventListener('goals-changed', () => {
    cycleIdx = 0;
    start();
  });

  return { start, tick };
})();

/* ---------------- Day line counter ---------------- */
// The same progress bar appears on the dashboard and in the pop-up island; one update paints both.
const dayPillText = document.getElementById('dayPillText');
const DAY_VIEWS = ['dayColumn', 'dayModalCard'].map(id => document.getElementById(id));

function formatHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const d = new Date(2000, 0, 1, hh % 24, mm);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: mm ? '2-digit' : undefined });
}

// Tick labels every 3 hours across the awake window, plus the bedtime end.
DAY_VIEWS.forEach(view => {
  const wrap = view.querySelector('.dl-ticks');
  const span = SLEEP_HOUR - WAKE_HOUR;
  const hours = [];
  for (let h = WAKE_HOUR; h < SLEEP_HOUR - 1; h += 3) hours.push(h);
  hours.push(SLEEP_HOUR);
  hours.forEach((h, i) => {
    const t = el('span', 'dl-tick', formatHour(h));
    t.style.left = ((h - WAKE_HOUR) / span * 100) + '%';
    if (i === 0) t.classList.add('first');
    if (i === hours.length - 1) t.classList.add('last');
    wrap.appendChild(t);
  });
  const win = view.querySelector('.dl-window');
  if (win) win.textContent = 'Awake ' + formatHour(WAKE_HOUR) + ' – ' + formatHour(SLEEP_HOUR);
});

function formatDuration(hours) {
  const mins = Math.max(0, Math.floor(hours * 60));
  return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
}

function dayState() {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const span = SLEEP_HOUR - WAKE_HOUR;
  const clock = formatClock(now);
  if (hours < WAKE_HOUR) {
    const left = formatDuration(WAKE_HOUR - hours);
    return { fill: 0, pct: '—', phase: 'SLEEPING', status: 'Still sleeping', remaining: left + ' until wake-up', clock, pill: left + ' to wake' };
  }
  if (hours >= SLEEP_HOUR) {
    return { fill: 100, pct: '100%', phase: 'PAST BEDTIME', status: 'Past bedtime — get some sleep', remaining: 'Day complete', clock, pill: 'Past bedtime' };
  }
  const percent = (hours - WAKE_HOUR) / span * 100;
  let phase, status;
  if (percent < 25)      { phase = 'MORNING';   status = 'Morning — fresh start'; }
  else if (percent < 50) { phase = 'MIDDAY';    status = 'Midday — keep moving'; }
  else if (percent < 75) { phase = 'AFTERNOON'; status = 'Afternoon — push it'; }
  else if (percent < 90) { phase = 'EVENING';   status = 'Evening — wrap up'; }
  else                   { phase = 'BEDTIME';   status = 'Bedtime soon'; }
  const left = formatDuration(SLEEP_HOUR - hours);
  return { fill: percent, pct: Math.floor(percent) + '%', phase, status, remaining: left + ' left', clock, pill: Math.floor(percent) + '% · ' + left + ' left' };
}

function paintDay(view, s) {
  const set = (sel, text) => { const n = view.querySelector(sel); if (n) n.textContent = text; };
  set('.dl-phase', s.phase);
  set('.dl-status', s.status);
  set('.dl-pct', s.pct);
  set('.dl-remaining', s.remaining);
  set('.dl-clock', s.clock);
  const p = Math.max(0, Math.min(100, s.fill));
  view.querySelector('.dl-fill').style.width = p + '%';
  const now = view.querySelector('.dl-now');
  now.style.left = p + '%';
  now.hidden = s.fill <= 0;
}

function updateDayBar() {
  const s = dayState();
  DAY_VIEWS.forEach(view => paintDay(view, s));
  dayPillText.textContent = s.pill;
}

/* ---------------- Small shared helpers ---------------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
function toNum(v) { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }
function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
function fmtQty(q) { return String(round2(q)); }
function shiftDate(ds, days) {
  const [y, m, d] = ds.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}
function shortDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function makeCheckbox(checked, onChange) {
  const wrap = el('label', 'goal-check');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  wrap.append(cb, el('span', 'goal-check-box'));
  return wrap;
}

// Small message bar at the bottom: confirmations ("Saved") and Undo after deletes.
// opts.undo — shows an Undo button; opts.onExpire — runs if the toast times out without Undo.
const Toast = (() => {
  let node = null;
  let timer = null;
  let current = null;
  function finish(expired) {
    clearTimeout(timer);
    timer = null;
    const opts = current;
    current = null;
    if (node) node.classList.remove('show');
    if (expired && opts && opts.onExpire) opts.onExpire();
  }
  function show(message, opts) {
    opts = opts || {};
    finish(true);
    if (!node) {
      node = el('div', 'toast');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.innerHTML = '';
    node.appendChild(el('span', 'toast-msg', message));
    current = opts;
    if (opts.undo) {
      const b = el('button', 'toast-undo', 'Undo');
      b.type = 'button';
      b.addEventListener('click', () => {
        const undo = current && current.undo;
        finish(false);
        if (undo) undo();
      });
      node.appendChild(b);
    }
    void node.offsetWidth;
    node.classList.add('show');
    timer = setTimeout(() => finish(true), opts.undo ? 5000 : 2600);
  }
  return { show };
})();

// Plays a pop-up's closing animation, then runs done(). Re-opening it mid-close cancels the close.
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function cancelClose(node) {
  if (node._closeTimer != null) {
    clearTimeout(node._closeTimer);
    node._closeTimer = null;
    node.classList.remove('closing');
  }
}
function animateOut(node, done) {
  cancelClose(node);
  if (reducedMotion()) { done(); return; }
  node.classList.add('closing');
  node._closeTimer = setTimeout(() => {
    node._closeTimer = null;
    node.classList.remove('closing');
    done();
  }, 170);
}

