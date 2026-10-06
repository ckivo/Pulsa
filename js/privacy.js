// Privacy mode (blur amounts) and the Finance PIN.
/* ---------------- Privacy mode: blur every dollar amount on screen ----------------
   Per device. Anything whose text shows a $ amount (balances, spending, P&L, payouts…) gets
   marked and blurred, including things drawn later, so it's safe to leave on while sharing a screen. */
const EYE_SVG = '<svg class="icon" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>';
const EYE_OFF_SVG = '<svg class="icon" viewBox="0 0 24 24"><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.4 3.2M6.6 6.7C3.9 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" /><path d="M9.9 9.9a3 3 0 004.2 4.2M3.5 3.5l17 17" /></svg>';

const Privacy = (() => {
  const KEY = 'pulse_local_privacy';
  const MONEY = /\$\s?\d|\d\s?\$/;
  let on = false;
  let observer = null;
  const queue = new Set();
  let queued = false;

  function markText(node) {
    const p = node.parentElement;
    if (!p || !MONEY.test(node.nodeValue)) {
      // Text that no longer shows money shouldn't stay blurred.
      if (p && p.hasAttribute('data-money') && !MONEY.test(p.textContent)) p.removeAttribute('data-money');
      return;
    }
    if (p.closest('[data-money], script, style, textarea, .pin-gate')) return;
    // Small elements are blurred whole; a $ amount inside a long sentence gets its own wrapper.
    if (p.childNodes.length === 1 || p.textContent.length <= 48 || p instanceof SVGElement) {
      p.setAttribute('data-money', '');
    } else {
      const wrap = document.createElement('span');
      wrap.setAttribute('data-money', '');
      p.insertBefore(wrap, node);
      wrap.appendChild(node);
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { markText(root); return; }
    if (root.nodeType !== 1) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    const found = [];
    while ((n = walker.nextNode())) if (MONEY.test(n.nodeValue)) found.push(n);
    found.forEach(markText);
  }

  function flushQueue() {
    queued = false;
    queue.forEach(n => { if (n.isConnected) scan(n); });
    queue.clear();
  }

  function watch() {
    if (observer) return;
    observer = new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === 'characterData') queue.add(m.target);
        else m.addedNodes.forEach(n => queue.add(n));
      });
      if (!queued) { queued = true; requestAnimationFrame(flushQueue); }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function paintButtons() {
    document.querySelectorAll('.privacy-btn').forEach(b => {
      b.innerHTML = on ? EYE_OFF_SVG : EYE_SVG;
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? 'Show amounts' : 'Hide amounts (privacy mode)';
    });
  }

  function set(value) {
    on = !!value;
    try { Store.setItem(KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (on) { scan(document.body); watch(); }
    else if (observer) { observer.disconnect(); observer = null; }
    document.body.classList.toggle('privacy-on', on);
    paintButtons();
  }

  function toggle() {
    set(!on);
    Toast.show(on ? 'Amounts hidden' : 'Amounts shown');
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.privacy-btn')) toggle();
  });

  set((() => { try { return Store.getItem(KEY) === '1'; } catch (e) { return false; } })());
  return { isOn: () => on, set, toggle, paintButtons };
})();

/* ---------------- Finance PIN ----------------
   A 4-digit PIN in front of the Finance tab. Only a salted hash is stored, and it syncs, so the
   same PIN works on every device. It re-locks after you've been away from Finance (or the app) for a minute.
   It's a privacy screen, not encryption — the data itself still lives in this browser. */
const FinLock = (() => {
  const KEY = 'pulse_finance_pin_v1';
  const LEN = 4;
  const RELOCK_MS = 60 * 1000;
  const page = document.querySelector('.page[data-page="finance"]');
  let unlocked = false;
  let awayAt = 0;
  let mode = null; // 'unlock' | 'set' | 'confirm' | 'verify'
  let digits = '';
  let firstPin = '';
  let afterVerify = null;
  let fails = 0;
  let coolUntil = 0;
  let coolTimer = null;
  let busy = false;

  const record = () => { try { return JSON.parse(Store.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const isSet = () => { const r = record(); return !!(r && r.hash && r.salt); };
  const locked = () => isSet() && !unlocked;
  const onFinance = () => uiState.page === 'finance';

  async function hash(pin, salt) {
    const text = 'pulse-fin|' + salt + '|' + pin;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }
    // file:// has no crypto.subtle; a plain string hash is enough for a privacy screen.
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + text.charCodeAt(i), 2246822519) >>> 0;
    }
    return 'f' + h1.toString(16) + h2.toString(16);
  }

  async function check(pin) {
    const r = record();
    return !!r && (await hash(pin, r.salt)) === r.hash;
  }

  async function savePin(pin) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
    Store.setItem(KEY, JSON.stringify({ salt, hash: await hash(pin, salt), set: Date.now() }));
  }

  /* Gate UI (lives inside the Finance page and covers it) */
  const gate = el('div', 'pin-gate');
  gate.hidden = true;
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-label', 'Finance PIN');
  const gIcon = el('div', 'pin-icon');
  gIcon.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /><circle cx="12" cy="15.5" r="1.3" /></svg>';
  const gTitle = el('div', 'pin-title');
  const gSub = el('div', 'pin-sub');
  const gDots = el('div', 'pin-dots');
  const gPad = el('div', 'pin-pad');
  const gFoot = el('div', 'pin-foot');
  gate.append(gIcon, gTitle, gSub, gDots, gPad, gFoot);
  page.appendChild(gate);

  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'back'].forEach(k => {
    const b = el('button', 'pin-key' + (k === 'cancel' || k === 'back' ? ' pin-key-fn' : ''));
    b.type = 'button';
    b.dataset.key = k;
    if (k === 'back') { b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 6h10a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 18H9l-5.5-6z" /><path d="M11.5 9.5l5 5M16.5 9.5l-5 5" /></svg>'; b.setAttribute('aria-label', 'Delete'); }
    else if (k === 'cancel') b.textContent = 'Cancel';
    else b.textContent = k;
    b.addEventListener('click', () => press(k));
    gPad.appendChild(b);
  });

  const TEXT = {
    unlock: ['Finance is locked', 'Enter your PIN'],
    set: ['Create a Finance PIN', LEN + ' digits. It’ll be needed to open Finance on every synced device.'],
    confirm: ['Confirm your PIN', 'Enter the same ' + LEN + ' digits again'],
    verify: ['Enter your current PIN', 'To change or remove it']
  };

  function paint(msg, isErr) {
    gTitle.textContent = TEXT[mode][0];
    const cooling = Date.now() < coolUntil;
    gSub.textContent = cooling ? 'Too many tries — wait ' + Math.ceil((coolUntil - Date.now()) / 1000) + 's' : (msg || TEXT[mode][1]);
    gSub.classList.toggle('err', !!isErr || cooling);
    gDots.innerHTML = '';
    for (let i = 0; i < LEN; i++) gDots.appendChild(el('i', i < digits.length ? 'on' : ''));
    gPad.querySelector('[data-key="cancel"]').style.visibility = mode === 'unlock' ? 'hidden' : '';
    gate.classList.toggle('cooling', cooling);
    gFoot.innerHTML = '';
    if (mode === 'unlock' || mode === 'verify') {
      const forgot = el('button', 'pin-link', 'Forgot PIN?');
      forgot.type = 'button';
      forgot.addEventListener('click', forgotPin);
      gFoot.appendChild(forgot);
    }
  }

  function apply() {
    const show = onFinance() && (mode !== null);
    gate.hidden = !show;
    page.classList.toggle('fin-locked', show);
    app.classList.toggle('fin-locked', show);
    const lockBtn = document.getElementById('finLockBtn');
    if (lockBtn) {
      lockBtn.textContent = isSet() ? 'Lock' : 'Set PIN';
      lockBtn.title = isSet() ? 'Lock Finance now' : 'Protect Finance with a PIN';
    }
  }

  function open(m, msg, isErr) {
    mode = m;
    digits = '';
    paint(msg, isErr);
    apply();
  }

  function closeGate() {
    mode = null;
    digits = '';
    firstPin = '';
    afterVerify = null;
    apply();
  }

  function shake() {
    gDots.classList.remove('shake');
    void gDots.offsetWidth;
    gDots.classList.add('shake');
    if (navigator.vibrate) navigator.vibrate(60);
  }

  async function complete() {
    busy = true;
    const pin = digits;
    try {
      if (mode === 'unlock' || mode === 'verify') {
        if (await check(pin)) {
          fails = 0;
          unlocked = true;
          const next = mode === 'verify' ? afterVerify : null;
          closeGate();
          if (next) next();
          else if (onFinance()) Finance.render();
        } else {
          fails++;
          shake();
          if (fails >= 5) {
            fails = 0;
            coolUntil = Date.now() + 30000;
            clearInterval(coolTimer);
            coolTimer = setInterval(() => {
              if (Date.now() >= coolUntil) { clearInterval(coolTimer); coolTimer = null; }
              if (mode) paint();
            }, 1000);
          }
          digits = '';
          paint('Wrong PIN — try again', true);
        }
      } else if (mode === 'set') {
        firstPin = pin;
        open('confirm');
      } else if (mode === 'confirm') {
        if (pin === firstPin) {
          await savePin(pin);
          unlocked = true;
          closeGate();
          Toast.show('Finance PIN set');
          if (!document.getElementById('settingsSheet').hidden) Settings.render();
        } else {
          firstPin = '';
          shake();
          open('set', 'Those didn’t match — start again', true);
        }
      }
    } finally {
      busy = false;
    }
  }

  function press(k) {
    if (!mode || busy) return;
    if (k === 'cancel') { if (mode !== 'unlock') closeGate(); return; }
    if (Date.now() < coolUntil) return;
    if (k === 'back') digits = digits.slice(0, -1);
    else if (/^\d$/.test(k) && digits.length < LEN) digits += k;
    paint();
    if (digits.length === LEN) setTimeout(complete, 120); // let the last dot fill first
  }

  document.addEventListener('keydown', e => {
    if (gate.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Escape' && mode !== 'unlock') press('cancel');
  });

  function forgotPin() {
    const syncKey = Secrets.get('syncKey');
    if (syncKey) {
      const typed = prompt('To reset your Finance PIN, enter your sync dashboard key (from the Apps Script setup log):');
      if (typed == null) return;
      if (typed.trim() !== syncKey) { paint('That key doesn’t match', true); return; }
    } else if (!confirm('Reset the Finance PIN on this device? You’ll set a new one right away.')) return;
    Store.removeItem(KEY);
    unlocked = true;
    open('set', 'PIN cleared — create a new one');
  }

  // Leaving Finance (or putting the app away) starts the re-lock clock.
  function onPage(pg) {
    if (pg === 'finance') {
      if (unlocked && awayAt && Date.now() - awayAt > RELOCK_MS) unlocked = false;
      awayAt = 0;
      if (locked()) open('unlock');
      else if (mode === 'unlock') closeGate();
      else apply();
    } else {
      if (!awayAt) awayAt = Date.now();
      if (mode && mode !== 'unlock') { mode = null; digits = ''; firstPin = ''; afterVerify = null; } // drop a half-done setup
      apply();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!awayAt) awayAt = Date.now(); }
    else if (onFinance()) onPage('finance');
  });

  // A PIN set or removed on the other device takes effect here too.
  window.addEventListener('pulse:synced', () => { if (onFinance()) onPage('finance'); else apply(); });

  return {
    isSet,
    locked,
    onPage,
    lockNow() {
      if (!isSet()) { this.startSetup(); return; }
      unlocked = false;
      awayAt = 0;
      if (onFinance()) open('unlock');
    },
    startSetup() {
      if (!onFinance()) setPage('finance');
      open('set');
    },
    change() {
      afterVerify = () => open('set');
      if (!onFinance()) setPage('finance');
      open('verify');
    },
    remove() {
      afterVerify = () => {
        Store.removeItem(KEY);
        apply();
        Toast.show('Finance PIN removed');
        if (!document.getElementById('settingsSheet').hidden) Settings.render();
      };
      if (!onFinance()) setPage('finance');
      open('verify');
    }
  };
})();

document.getElementById('finLockBtn').addEventListener('click', () => FinLock.lockNow());

