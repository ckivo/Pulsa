// Journals: images, photo sync, entry popup, calendar, Trades / Mental / Daily review.
/* ================= Journals (Trades + Mental) ================= */
// Notion-style tag colors for the dark theme: [background, text].
const TAG_COLORS = {
  default: ['rgba(255,255,255,0.10)', '#E6E4DF'],
  gray: ['#474644', '#D6D5D1'],
  brown: ['#5A4131', '#EFD7C3'],
  orange: ['#6A3F22', '#FFD0AA'],
  yellow: ['#655222', '#FBE39A'],
  green: ['#1E4A37', '#B7EFCF'],
  blue: ['#1D3D63', '#C2DBFF'],
  purple: ['#42305C', '#E0CAFF'],
  pink: ['#5B2D47', '#FFC9E3'],
  red: ['#692525', '#FFC4C4']
};
const COLOR_CYCLE = ['blue', 'purple', 'pink', 'orange', 'yellow', 'green', 'brown', 'gray', 'red', 'default'];

const SVG = {
  plus: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  cal: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  tags: '<svg class="icon" viewBox="0 0 24 24"><path d="M8 7h11M8 12h11M8 17h11"/><circle cx="4.5" cy="7" r="0.6"/><circle cx="4.5" cy="12" r="0.6"/><circle cx="4.5" cy="17" r="0.6"/></svg>',
  hash: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 4L7 20M17 4l-2 16M4.5 9h15M4 15h15"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z"/></svg>',
  image: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M20 16l-5-5-8 8"/></svg>'
};

function tagChip(opt, large) {
  const c = TAG_COLORS[opt.color] || TAG_COLORS.default;
  const chip = el('span', 'chip' + (large ? ' lg' : ''), opt.name);
  chip.style.background = c[0];
  chip.style.color = c[1];
  return chip;
}

function fmtMoney(n) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return (n > 0 ? '+$' : n < 0 ? '−$' : '$') + s;
}
function fmtMoneyShort(n) {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(abs));
  return (n > 0 ? '+$' : n < 0 ? '−$' : '$') + s;
}
const signClass = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

// Images live in IndexedDB (localStorage is too small for screenshots); falls back to inline data URLs.
const Media = (() => {
  let dbPromise = null;
  const urls = new Map();
  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
        // Some browsers never answer on file:// pages — give up and use inline images instead.
        const timer = setTimeout(() => reject(new Error('IndexedDB timed out')), 4000);
        const req = indexedDB.open('dashboard_media', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('images');
        req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
        req.onerror = () => { clearTimeout(timer); reject(req.error); };
      });
    }
    return dbPromise;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', mode);
      const req = fn(tx.objectStore('images'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    // fromSync: the photo just came down from Drive, so don't queue it to go back up.
    async put(id, blob, fromSync) {
      await run('readwrite', s => s.put(blob, id));
      if (!fromSync) PhotoSync.queueUpload(id);
    },
    del(id) {
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
      PhotoSync.queueDelete(id);
      return run('readwrite', s => s.delete(id)).catch(() => {});
    },
    blob: id => run('readonly', s => s.get(id)).catch(() => null),
    keys: () => run('readonly', s => s.getAllKeys()).catch(() => []),
    // Backup: every stored image as a data URL, keyed by id.
    async dump() {
      const out = {};
      try {
        const keys = await run('readonly', s => s.getAllKeys());
        for (const k of keys) {
          const blob = await run('readonly', s => s.get(k));
          if (blob) out[k] = await blobToDataUrl(blob);
        }
      } catch (e) { /* no image store on this device */ }
      return out;
    },
    // Restore: replace the image store with a backup's images.
    async restore(images) {
      await run('readwrite', s => s.clear());
      urls.forEach(u => URL.revokeObjectURL(u));
      urls.clear();
      for (const [id, dataUrl] of Object.entries(images || {})) {
        const blob = await (await fetch(dataUrl)).blob();
        await run('readwrite', s => s.put(blob, id));
      }
    },
    async url(rec) {
      if (rec.data) return rec.data;
      if (urls.has(rec.id)) return urls.get(rec.id);
      try {
        // Not on this device yet (added on your other device)? Fetch it from Drive.
        const blob = (await run('readonly', s => s.get(rec.id))) || (await PhotoSync.download(rec.id));
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        urls.set(rec.id, u);
        return u;
      } catch (e) {
        return null;
      }
    }
  };
})();

/* Journal photos ↔ your Drive ("Pulse photos" folder), through the same script as sync.
   Uploads and deletions wait in a queue on this device and go out whenever sync is connected and online. */
const PhotoSync = (() => {
  const QKEY = 'pulse_photo_queue_v1';
  const inflight = new Map();
  let busy = false;
  let timer = null;
  const ready = () => Sync.configured();

  function readQ() {
    try { return Object.assign({ up: [], del: [], done: {} }, JSON.parse(Store.getItem(QKEY) || '{}')); }
    catch (e) { return { up: [], del: [], done: {} }; }
  }
  function saveQ(q) {
    try { Store.setItem(QKEY, JSON.stringify(q)); } catch (e) { /* storage full */ }
  }
  function kick(delay) {
    if (!ready()) return;
    clearTimeout(timer);
    timer = setTimeout(process, delay == null ? 1500 : delay);
  }

  function queueUpload(id) {
    const q = readQ();
    q.del = q.del.filter(i => i !== id);
    if (!q.up.includes(id)) q.up.push(id);
    delete q.done[id];
    saveQ(q);
    kick();
  }
  function queueDelete(id) {
    const q = readQ();
    q.up = q.up.filter(i => i !== id);
    if (!q.del.includes(id)) q.del.push(id);
    delete q.done[id];
    saveQ(q);
    kick();
  }

  function post(body) {
    return fetch(Secrets.get('syncUrl'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ key: Secrets.get('syncKey') }, body))
    }).then(r => r.json());
  }

  // One photo at a time so a slow connection doesn't pile up requests.
  async function process() {
    if (!ready() || busy) return;
    busy = true;
    try {
      let q = readQ();
      while (q.del.length) {
        const id = q.del[0];
        const r = await post({ action: 'deleteImage', id });
        if (!r.ok) throw new Error(r.error || 'delete failed');
        q = readQ();
        q.del = q.del.filter(i => i !== id);
        saveQ(q);
      }
      while (q.up.length) {
        const id = q.up[0];
        const blob = await Media.blob(id);
        if (blob) {
          const r = await post({ action: 'putImage', id, data: await blobToDataUrl(blob) });
          if (!r.ok) throw new Error(r.error || 'upload failed');
        }
        q = readQ();
        q.up = q.up.filter(i => i !== id);
        if (blob) q.done[id] = 1;
        saveQ(q);
      }
    } catch (e) {
      console.warn('Photo sync paused, will retry:', e);
      kick(30000);
    } finally {
      busy = false;
    }
  }

  function download(id) {
    if (!ready()) return Promise.resolve(null);
    if (inflight.has(id)) return inflight.get(id);
    const p = (async () => {
      const base = Secrets.get('syncUrl');
      const res = await fetch(base + (base.includes('?') ? '&' : '?') + 'action=image&key=' +
        encodeURIComponent(Secrets.get('syncKey')) + '&id=' + encodeURIComponent(id));
      const r = await res.json();
      if (!r.ok || !r.data) return null;
      const blob = await (await fetch(r.data)).blob();
      await Media.put(id, blob, true);
      const q = readQ();
      q.done[id] = 1;
      saveQ(q);
      return blob;
    })().catch(() => null).finally(() => inflight.delete(id));
    inflight.set(id, p);
    return p;
  }

  // Upload any photo on this device that hasn't gone up yet (first connect, restores, older photos).
  async function enqueueLocal() {
    if (!ready()) return;
    const ids = await Media.keys();
    const q = readQ();
    ids.forEach(id => { if (!q.done[id] && !q.up.includes(id)) q.up.push(id); });
    saveQ(q);
    kick(500);
  }

  // Download photos used by synced journal entries that this device doesn't have yet.
  async function prefetch() {
    if (!ready()) return 0;
    const have = new Set(await Media.keys());
    const want = [];
    for (let i = 0; i < Store.length; i++) {
      const k = Store.key(i);
      if (!/^journal:.+:entries$/.test(k)) continue;
      try {
        (JSON.parse(Store.getItem(k)) || []).forEach(e => (e.images || []).forEach(img => {
          if (!img.data && !have.has(img.id) && !want.includes(img.id)) want.push(img.id);
        }));
      } catch (e) { /* skip */ }
    }
    let got = 0;
    for (const id of want) { if (await download(id)) got++; }
    return got;
  }

  return {
    queueUpload,
    queueDelete,
    download,
    enqueueLocal,
    prefetch,
    flush: () => kick(0),
    pending: () => { const q = readQ(); return q.up.length + q.del.length; }
  };
})();

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('decode failed'));
    };
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* ----- Entry popup (Notion-style page) ----- */
const Peek = (() => {
  const back = document.getElementById('peek');
  const panel = document.getElementById('peekPanel');
  const lightbox = document.getElementById('lightbox');
  let journal = null;
  let entryId = null;
  let picker = null;
  let pending = {};
  let saveTimer = null;
  let savedEl = null;
  let savedTimer = null;
  let crumbEl = null;
  let tagsEl = null;
  let imagesEl = null;

  const isOpen = () => !back.hidden;
  const entry = () => (journal && entryId ? journal.getEntry(entryId) : null);

  function flashSaved() {
    if (!savedEl) return;
    savedEl.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedEl && savedEl.classList.remove('show'), 1200);
  }

  function flush() {
    clearTimeout(saveTimer);
    if (journal && entryId && Object.keys(pending).length) {
      journal.updateEntry(entryId, pending);
      flashSaved();
    }
    pending = {};
  }

  function queue(patch, delay) {
    Object.assign(pending, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, delay || 350);
  }

  // Leaving an untouched new entry shouldn't leave an "Untitled" card behind.
  function discardIfEmpty() {
    const e = entry();
    if (e && journal.isEmpty(e)) journal.deleteEntry(e.id);
  }

  // Opening an entry adds a history step, so the phone's back button/gesture closes it
  // instead of leaving the app.
  function show() {
    cancelClose(back);
    if (back.hidden) {
      try { history.pushState({ pasivePeek: true }, ''); } catch (e) { /* file:// */ }
    }
    back.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeNow() {
    flush();
    closePicker();
    discardIfEmpty();
    if (journal) journal.render();
    journal = null;
    entryId = null;
    animateOut(back, () => {
      back.hidden = true;
      document.body.style.overflow = '';
      panel.innerHTML = '';
    });
  }

  function close() {
    if (back.hidden || back._closeTimer != null) return;
    closeNow();
    if (history.state && history.state.pasivePeek) {
      try { history.back(); } catch (e) { /* ignore */ }
    }
  }

  window.addEventListener('popstate', () => { if (!back.hidden && back._closeTimer == null) closeNow(); });

  function topBar(crumb, withDelete) {
    const top = el('div', 'peek-top');
    crumbEl = el('span', 'peek-crumb', crumb);
    savedEl = el('span', 'peek-saved', 'Saved');
    top.append(crumbEl, savedEl);
    if (withDelete) {
      const del = el('button', 'icon-btn danger');
      del.type = 'button';
      del.title = 'Delete entry';
      del.innerHTML = SVG.trash;
      del.addEventListener('click', () => {
        flush();
        const j = journal;
        const id = entryId;
        const removed = j.getEntry(id);
        pending = {};
        entryId = null;
        // Keep the images until the undo window passes, so Undo restores the entry completely.
        j.deleteEntry(id, true);
        close();
        if (!removed) return;
        Toast.show('Deleted “' + (removed.title.trim() || 'Untitled') + '”', {
          undo: () => {
            const list = j.getEntries();
            list.push(removed);
            j.saveEntries(list);
            j.render();
          },
          onExpire: () => removed.images.forEach(img => { if (!img.data) Media.del(img.id); })
        });
      });
      top.appendChild(del);
    }
    const x = el('button', 'icon-btn peek-close-x', '×');
    x.type = 'button';
    x.title = 'Close (Esc)';
    x.addEventListener('click', close);
    top.appendChild(x);
    // Phones get a clear "Done" button instead of a small ×.
    const done = el('button', 'btn-primary peek-done', 'Done');
    done.type = 'button';
    done.addEventListener('click', close);
    top.appendChild(done);
    return top;
  }

  function propRow(icon, label, valueNode) {
    const row = el('div', 'prop');
    const lab = el('div', 'prop-label');
    lab.innerHTML = icon;
    lab.appendChild(document.createTextNode(label));
    let value = valueNode;
    if (!valueNode.classList.contains('prop-value')) {
      value = el('div', 'prop-value');
      value.appendChild(valueNode);
    }
    row.append(lab, value);
    return row;
  }

  function open(j, id) {
    if (isOpen()) {
      flush();
      closePicker();
      if (entryId !== id) discardIfEmpty();
    }
    journal = j;
    entryId = id;
    const e = j.getEntry(id);
    if (!e) return;

    panel.innerHTML = '';
    panel.appendChild(topBar(j.cfg.title + ' / ' + formatDate(e.date), true));
    const body = el('div', 'peek-body');

    // Ticket-style header: date stamp on the left, live P&L (or the entry kind) on the right.
    const hero = el('div', 'peek-hero');
    const stamp = el('div', 'ph-stamp');
    const heroNum = el('div', 'ph-day');
    const heroSub = el('div', 'ph-sub');
    stamp.append(heroNum, heroSub);
    const heroRight = el('div', 'ph-right');
    const heroLabel = el('div', 'ph-label', j.cfg.pnl ? 'Day P&L' : j.cfg.rating ? 'Day rating' : 'Mistake log');
    const heroVal = el('div', 'ph-value');
    heroRight.append(heroLabel, heroVal);
    hero.append(stamp, el('div', 'ph-perf'), heroRight);
    const paintHero = (ds, pnlVal) => {
      const d = new Date(ds + 'T12:00:00');
      heroNum.textContent = String(d.getDate());
      heroSub.textContent = d.toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' +
        d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      hero.classList.remove('win', 'loss');
      if (j.cfg.pnl) {
        const has = typeof pnlVal === 'number' && isFinite(pnlVal);
        heroVal.textContent = has ? fmtMoney(pnlVal) : '—';
        heroVal.className = 'ph-value' + (has ? ' ' + signClass(pnlVal) : '');
        if (has && pnlVal > 0) hero.classList.add('win');
        if (has && pnlVal < 0) hero.classList.add('loss');
      } else if (j.cfg.rating) {
        const cur = j.getEntry(entryId);
        const r = cur ? Number(cur.rating) || 0 : 0;
        heroVal.textContent = r ? r + ' / 5' : '—';
        heroVal.className = 'ph-value' + (r >= 4 ? ' pos' : r && r <= 2 ? ' neg' : '');
        if (r >= 4) hero.classList.add('win');
        if (r && r <= 2) hero.classList.add('loss');
      } else {
        const n = j.getEntries().filter(x => x.date === ds).length;
        heroVal.textContent = n + (n === 1 ? ' entry' : ' entries');
      }
      if (summaryEl) paintSummary(ds);
    };
    // Daily review: what Pulse already knows about that day, filled in automatically.
    let summaryEl = null;
    const paintSummary = ds => {
      summaryEl.innerHTML = '';
      (j.cfg.summary(ds) || []).forEach(([label, value, cls]) => {
        const item = el('div', 'ds-item' + (cls ? ' ' + cls : ''));
        item.append(el('span', 'ds-label', label), el('span', 'ds-value', value));
        summaryEl.appendChild(item);
      });
    };
    if (j.cfg.summary) summaryEl = el('div', 'day-summary');
    paintHero(e.date, e.pnl);
    body.appendChild(hero);
    if (summaryEl) body.appendChild(summaryEl);

    const title = el('input', 'peek-title');
    title.placeholder = j.cfg.titlePlaceholder || 'Untitled';
    title.value = e.title;
    title.setAttribute('aria-label', 'Title');
    body.appendChild(title);

    const props = el('div', 'props');

    const dateInput = el('input');
    dateInput.type = 'date';
    dateInput.value = e.date;
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      flush();
      journal.updateEntry(entryId, { date: dateInput.value });
      crumbEl.textContent = journal.cfg.title + ' / ' + formatDate(dateInput.value);
      const cur = journal.getEntry(entryId);
      paintHero(dateInput.value, cur && cur.pnl);
      flashSaved();
    });
    props.appendChild(propRow(SVG.cal, 'Date', dateInput));

    tagsEl = el('div', 'prop-value');
    tagsEl.tabIndex = 0;
    tagsEl.setAttribute('role', 'button');
    tagsEl.addEventListener('click', ev => {
      if (ev.target.closest('.chip-x')) return;
      openPicker(tagsEl);
    });
    tagsEl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openPicker(tagsEl);
      }
    });
    props.appendChild(propRow(SVG.tags, j.cfg.tagsLabel, tagsEl));
    renderTags();

    if (j.cfg.pnl) {
      const pnl = el('input');
      pnl.type = 'number';
      pnl.step = 'any';
      pnl.placeholder = 'Empty';
      pnl.setAttribute('aria-label', 'P&L');
      pnl.classList.add('money-input');
      pnl.value = typeof e.pnl === 'number' ? e.pnl : '';
      const paint = () => {
        const v = parseFloat(pnl.value);
        pnl.classList.toggle('pos', v > 0);
        pnl.classList.toggle('neg', v < 0);
      };
      paint();
      pnl.addEventListener('input', () => {
        paint();
        const v = parseFloat(pnl.value);
        queue({ pnl: isFinite(v) ? v : null });
        paintHero(dateInput.value || e.date, isFinite(v) ? v : null);
      });
      props.appendChild(propRow(SVG.hash, 'P&L ($)', pnl));
    }

    if (j.cfg.rating) {
      const stars = el('div', 'prop-value rate-row');
      const paintStars = r => stars.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i < r));
      for (let s = 1; s <= 5; s++) {
        const b = el('button', 'rate-step', String(s));
        b.type = 'button';
        b.title = ['Rough day', 'Below average', 'Okay', 'Good day', 'Great day'][s - 1];
        b.addEventListener('click', () => {
          flush();
          const cur = journal.getEntry(entryId);
          const next = cur && Number(cur.rating) === s ? 0 : s;
          journal.updateEntry(entryId, { rating: next });
          paintStars(next);
          paintHero(dateInput.value || e.date, null);
          flashSaved();
        });
        stars.appendChild(b);
      }
      stars.appendChild(el('span', 'rate-hint', 'How was the day?'));
      paintStars(Number(e.rating) || 0);
      props.appendChild(propRow(SVG.star, 'Day rating', stars));
    }

    body.appendChild(props);
    body.appendChild(el('div', 'peek-divider'));

    imagesEl = el('div', 'peek-images');
    body.appendChild(imagesEl);
    renderImages();

    // One or more writing sections (Trades: a single journal; Mental: the mistake + the fix).
    const minHeight = j.cfg.sections.length > 1 ? 120 : 220;
    const growers = [];
    const areas = j.cfg.sections.map(section => {
      if (section.heading) body.appendChild(el('div', 'peek-section-title', section.heading));
      const area = el('textarea', 'peek-notes');
      area.placeholder = section.placeholder;
      area.value = e[section.key] || '';
      area.style.minHeight = minHeight + 'px';
      area.setAttribute('aria-label', section.heading || 'Journal');
      const grow = () => {
        area.style.height = 'auto';
        area.style.height = Math.max(minHeight, area.scrollHeight) + 'px';
      };
      growers.push(grow);
      area.addEventListener('input', () => {
        grow();
        queue({ [section.key]: area.value }, 500);
      });
      body.appendChild(area);
      return area;
    });
    const grow = () => growers.forEach(g => g());

    title.addEventListener('input', () => queue({ title: title.value }));
    title.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        areas[0].focus();
      }
    });

    panel.appendChild(body);
    show();
    requestAnimationFrame(grow);
    if (j.isEmpty(e)) title.focus();
  }

  // Mobile: a day with several entries opens as a list first.
  function openDay(j, ds) {
    // Switching inside the sheet: tidy up without popping the history step it already owns.
    if (isOpen()) { flush(); closePicker(); discardIfEmpty(); }
    journal = j;
    entryId = null;
    panel.innerHTML = '';
    panel.appendChild(topBar(j.cfg.title, false));
    const body = el('div', 'peek-body day-list');
    body.appendChild(el('div', 'day-list-title', formatDate(ds)));
    const optMap = new Map(j.getOptions().map(o => [o.id, o]));
    j.getEntries().filter(e => e.date === ds).forEach(e => body.appendChild(j.buildCard(e, optMap)));
    const add = el('button', 'col-add');
    add.type = 'button';
    add.innerHTML = SVG.plus;
    add.appendChild(document.createTextNode('New entry'));
    add.addEventListener('click', () => j.newEntry(ds));
    body.appendChild(add);
    panel.appendChild(body);
    show();
  }

  /* Tags */
  function renderTags() {
    const e = entry();
    if (!e || !tagsEl) return;
    tagsEl.innerHTML = '';
    const optMap = new Map(journal.getOptions().map(o => [o.id, o]));
    const tags = e.tags.map(id => optMap.get(id)).filter(Boolean);
    if (!tags.length) tagsEl.appendChild(el('span', 'prop-empty', 'Empty'));
    tags.forEach(o => {
      const chip = tagChip(o, true);
      const x = el('button', 'chip-x', '×');
      x.type = 'button';
      x.title = 'Remove';
      x.addEventListener('click', () => toggleTag(o.id));
      chip.appendChild(x);
      tagsEl.appendChild(chip);
    });
  }

  function toggleTag(optId) {
    flush();
    const e = entry();
    if (!e) return;
    const tags = e.tags.includes(optId) ? e.tags.filter(x => x !== optId) : e.tags.concat(optId);
    journal.updateEntry(entryId, { tags });
    flashSaved();
    renderTags();
    if (picker) picker.paint();
  }

  function nextColor(options) { return COLOR_CYCLE[options.length % COLOR_CYCLE.length]; }

  function cycleColor(optId) {
    const options = journal.getOptions();
    const o = options.find(x => x.id === optId);
    if (!o) return;
    o.color = COLOR_CYCLE[(COLOR_CYCLE.indexOf(o.color) + 1) % COLOR_CYCLE.length];
    journal.saveOptions(options);
    renderTags();
    journal.render();
    if (picker) picker.paint();
  }

  function deleteOption(opt) {
    if (!confirm('Delete “' + opt.name + '”? It will be removed from every entry.')) return;
    flush();
    journal.saveOptions(journal.getOptions().filter(o => o.id !== opt.id));
    const list = journal.getEntries();
    list.forEach(e => { e.tags = e.tags.filter(t => t !== opt.id); });
    journal.saveEntries(list);
    renderTags();
    journal.render();
    if (picker) picker.paint();
  }

  function openPicker(anchor) {
    closePicker();
    const pop = el('div', 'ms-pop');
    const selBox = el('div', 'ms-selected');
    const input = el('input');
    input.placeholder = 'Search or create…';
    input.setAttribute('aria-label', 'Search or create an option');
    selBox.appendChild(input);
    const hint = el('div', 'ms-hint');
    const list = el('div', 'ms-list');
    pop.append(selBox, hint, list);
    panel.appendChild(pop);

    const pr = panel.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    pop.style.top = (ar.top - pr.top) + 'px';
    pop.style.left = Math.max(8, Math.min(ar.left - pr.left, pr.width - 330)) + 'px';

    let active = 0;
    let rows = [];

    function highlight() {
      [...list.children].forEach((c, i) => c.classList.toggle('active', i === active));
    }

    function choose(i) {
      const r = rows[i];
      if (!r) return;
      if (r.create) {
        const options = journal.getOptions();
        const opt = { id: uid(), name: r.create, color: nextColor(options) };
        options.push(opt);
        journal.saveOptions(options);
        input.value = '';
        toggleTag(opt.id);
      } else {
        toggleTag(r.opt.id);
      }
      input.focus();
    }

    function paint() {
      const e = entry();
      if (!e) return;
      const options = journal.getOptions();
      const optMap = new Map(options.map(o => [o.id, o]));
      selBox.querySelectorAll('.chip').forEach(c => c.remove());
      e.tags.map(id => optMap.get(id)).filter(Boolean).forEach(o => {
        const chip = tagChip(o, true);
        const x = el('button', 'chip-x', '×');
        x.type = 'button';
        x.addEventListener('mousedown', ev => ev.preventDefault());
        x.addEventListener('click', () => toggleTag(o.id));
        chip.appendChild(x);
        selBox.insertBefore(chip, input);
      });

      const q = input.value.trim();
      const ql = q.toLowerCase();
      rows = [];
      if (q && !options.some(o => o.name.toLowerCase() === ql)) rows.push({ create: q });
      options.filter(o => o.name.toLowerCase().includes(ql)).forEach(o => rows.push({ opt: o }));
      if (active >= rows.length) active = Math.max(0, rows.length - 1);

      list.innerHTML = '';
      rows.forEach((r, i) => {
        const row = el('div', 'ms-opt' + (i === active ? ' active' : ''));
        row.addEventListener('mousemove', () => {
          if (active !== i) { active = i; highlight(); }
        });
        row.addEventListener('mousedown', ev => ev.preventDefault());
        row.addEventListener('click', () => choose(i));
        if (r.create) {
          row.append(document.createTextNode('Create '), tagChip({ name: r.create, color: nextColor(options) }));
        } else {
          row.appendChild(tagChip(r.opt));
          row.appendChild(el('span', 'ms-check', e.tags.includes(r.opt.id) ? '✓' : ''));
          const colorBtn = el('button', 'icon-btn');
          colorBtn.type = 'button';
          colorBtn.title = 'Change color';
          const sw = el('i', 'ms-swatch');
          sw.style.background = (TAG_COLORS[r.opt.color] || TAG_COLORS.default)[1];
          colorBtn.appendChild(sw);
          colorBtn.addEventListener('click', ev => { ev.stopPropagation(); cycleColor(r.opt.id); });
          const delBtn = el('button', 'icon-btn danger', '×');
          delBtn.type = 'button';
          delBtn.title = 'Delete option';
          delBtn.addEventListener('click', ev => { ev.stopPropagation(); deleteOption(r.opt); });
          row.append(colorBtn, delBtn);
        }
        list.appendChild(row);
      });
      hint.textContent = rows.length ? 'Select an option or create one' : 'Type to create an option';
    }

    input.addEventListener('input', () => { active = 0; paint(); });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        active = Math.min(rows.length - 1, active + 1);
        highlight();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        active = Math.max(0, active - 1);
        highlight();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        choose(active);
      } else if (ev.key === 'Backspace' && !input.value) {
        const e = entry();
        if (e && e.tags.length) toggleTag(e.tags[e.tags.length - 1]);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closePicker();
        anchor.focus();
      }
    });

    const outside = ev => { if (!pop.contains(ev.target)) closePicker(); };
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    picker = { pop, paint, outside };
    paint();
    input.focus();
  }

  function closePicker() {
    if (!picker) return;
    document.removeEventListener('mousedown', picker.outside);
    picker.pop.remove();
    picker = null;
  }

  /* Images */
  function renderImages() {
    const e = entry();
    if (!e || !imagesEl) return;
    imagesEl.innerHTML = '';
    e.images.forEach(rec => {
      const tile = el('div', 'peek-img');
      const img = el('img');
      img.alt = 'Attached image';
      tile.appendChild(img);
      Media.url(rec).then(u => { if (u) img.src = u; });
      tile.addEventListener('click', () => { if (img.src) openLightbox(img.src); });
      const del = el('button', 'icon-btn', '×');
      del.type = 'button';
      del.title = 'Remove image';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        removeImage(rec.id);
      });
      tile.appendChild(del);
      imagesEl.appendChild(tile);
    });
    const add = el('button', 'img-add');
    add.type = 'button';
    add.innerHTML = SVG.image;
    add.append(el('span', null, 'Add image'), el('small', null, 'or paste / drop'));
    const input = el('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.hidden = true;
    input.addEventListener('change', () => addImages(input.files));
    add.addEventListener('click', () => input.click());
    imagesEl.append(add, input);
  }

  async function addImages(files) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length || !journal || !entryId) return;
    const j = journal;
    const id = entryId;
    for (const file of list) {
      const rec = { id: uid() };
      try {
        const blob = await compressImage(file, 2000, 0.88);
        try {
          await Media.put(rec.id, blob);
        } catch (err) {
          rec.data = await blobToDataUrl(blob);
        }
      } catch (err) {
        alert('Couldn’t read that image — try a JPG or PNG.');
        continue;
      }
      if (journal === j && entryId === id) flush();
      const e = j.getEntry(id);
      if (!e) return;
      j.updateEntry(id, { images: e.images.concat(rec) });
    }
    if (journal === j && entryId === id) {
      renderImages();
      flashSaved();
    }
  }

  function removeImage(imgId) {
    flush();
    const e = entry();
    if (!e) return;
    const rec = e.images.find(r => r.id === imgId);
    if (rec && !rec.data) Media.del(imgId);
    journal.updateEntry(entryId, { images: e.images.filter(r => r.id !== imgId) });
    renderImages();
  }

  function openLightbox(src) {
    lightbox.querySelector('img').src = src;
    lightbox.hidden = false;
  }

  lightbox.addEventListener('click', () => { lightbox.hidden = true; });
  back.addEventListener('mousedown', ev => { if (ev.target === back) close(); });
  panel.addEventListener('dragover', ev => {
    if (!entryId) return;
    ev.preventDefault();
    panel.classList.add('dragover');
  });
  panel.addEventListener('dragleave', ev => {
    if (!panel.contains(ev.relatedTarget)) panel.classList.remove('dragover');
  });
  panel.addEventListener('drop', ev => {
    panel.classList.remove('dragover');
    if (!entryId) return;
    ev.preventDefault();
    addImages(ev.dataTransfer.files);
  });
  document.addEventListener('paste', ev => {
    if (!isOpen() || !entryId || !ev.clipboardData) return;
    const files = [...ev.clipboardData.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    ev.preventDefault();
    addImages(files);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (!lightbox.hidden) { lightbox.hidden = true; return; }
    if (picker) { closePicker(); return; }
    if (isOpen()) close();
  });

  return { open, openDay, close };
})();

/* ----- Calendar ----- */
function createJournal(cfg) {
  const root = document.getElementById(cfg.rootId);
  const ENTRIES_KEY = 'journal:' + cfg.id + ':entries';
  const OPTIONS_KEY = 'journal:' + cfg.id + ':options';
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [startY, startM] = getActiveDateString().split('-').map(Number);
  let viewYear = startY;
  let viewMonth = startM - 1;

  function writeKey(key, value) {
    try {
      Store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      alert('Browser storage is full — remove some images or old entries.');
      return false;
    }
  }

  const getEntries = () => storeGet(ENTRIES_KEY) || [];
  const saveEntries = list => writeKey(ENTRIES_KEY, list);
  const getEntry = id => getEntries().find(e => e.id === id) || null;
  const SEEDED_KEY = 'journal:' + cfg.id + ':seeded';
  const seedOptions = () => cfg.defaultOptions.map(([name, color]) => ({ id: uid(), name, color }));
  const sameNames = (options, names) =>
    options.length === names.length && options.every(o => names.includes(o.name));

  function getOptions() {
    let options = storeGet(OPTIONS_KEY);
    if (!options) {
      options = seedOptions();
      writeKey(OPTIONS_KEY, options);
      writeKey(SEEDED_KEY, cfg.defaultOptions.map(([name]) => name));
      return options;
    }
    let changed = false;
    // An untouched, unused set of old defaults is swapped for the current ones.
    if (cfg.replacesDefaults && sameNames(options, cfg.replacesDefaults) &&
        !getEntries().some(e => e.tags.length)) {
      options = seedOptions();
      changed = true;
    }
    // Options added in later versions appear once; deleting them afterwards sticks.
    const seeded = storeGet(SEEDED_KEY) || options.map(o => o.name);
    cfg.defaultOptions.forEach(([name, color]) => {
      if (seeded.includes(name)) return;
      seeded.push(name);
      if (!options.some(o => o.name.toLowerCase() === name.toLowerCase())) {
        options.push({ id: uid(), name, color });
      }
      changed = true;
    });
    if (changed) {
      writeKey(OPTIONS_KEY, options);
      writeKey(SEEDED_KEY, seeded.concat(options.map(o => o.name).filter(n => !seeded.includes(n))));
    }
    return options;
  }
  const saveOptions = options => writeKey(OPTIONS_KEY, options);

  function updateEntry(id, patch) {
    const list = getEntries();
    const e = list.find(x => x.id === id);
    if (!e) return null;
    Object.assign(e, patch, { updated: Date.now() });
    saveEntries(list);
    render();
    return e;
  }

  function deleteEntry(id, keepImages) {
    const list = getEntries();
    const e = list.find(x => x.id === id);
    if (!e) return;
    if (!keepImages) e.images.forEach(img => { if (!img.data) Media.del(img.id); });
    saveEntries(list.filter(x => x.id !== id));
    render();
  }

  function newEntry(date) {
    const e = {
      id: uid(),
      date: date || getActiveDateString(),
      title: '',
      tags: [],
      pnl: null,
      notes: '',
      images: [],
      created: Date.now(),
      updated: Date.now()
    };
    cfg.sections.forEach(s => { e[s.key] = e[s.key] || ''; });
    const list = getEntries();
    list.push(e);
    saveEntries(list);
    render();
    Peek.open(api, e.id);
    return e;
  }

  const isEmpty = e => !e.title.trim() && !e.tags.length && e.pnl == null && !e.images.length && !e.rating &&
    cfg.sections.every(s => !(e[s.key] || '').trim());

  function sumPnl(list) {
    const vals = list.filter(e => typeof e.pnl === 'number');
    return vals.length ? vals.reduce((a, e) => a + e.pnl, 0) : null;
  }

  function tagNames(e, optMap) {
    return e.tags.map(id => optMap.get(id)).filter(Boolean).map(o => o.name.trim().toLowerCase());
  }

  // TP → green day, SL → red day. Both on one day: net P&L decides, otherwise split.
  function dayResult(list, optMap) {
    let tp = false;
    let sl = false;
    list.forEach(e => {
      const names = tagNames(e, optMap);
      if (names.includes('tp')) tp = true;
      if (names.includes('sl')) sl = true;
    });
    if (tp && !sl) return 'win';
    if (sl && !tp) return 'loss';
    if (tp && sl) {
      const net = sumPnl(list);
      return net > 0 ? 'win' : net < 0 ? 'loss' : 'mixed';
    }
    return '';
  }

  // Card used in the phone's day list.
  function buildCard(e, optMap) {
    const card = el('button', 'cal-card');
    card.type = 'button';
    if (e.images.length) {
      const img = el('img', 'cc-cover');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      card.appendChild(img);
      Media.url(e.images[0]).then(u => { if (u) img.src = u; else img.remove(); });
    }
    card.appendChild(el('div', 'cc-title' + (e.title.trim() ? '' : ' untitled'), e.title.trim() || 'Untitled'));
    const tags = e.tags.map(id => optMap.get(id)).filter(Boolean);
    if (tags.length) {
      const meta = el('div', 'cc-meta');
      tags.slice(0, 3).forEach(o => meta.appendChild(tagChip(o)));
      if (tags.length > 3) meta.appendChild(tagChip({ name: '+' + (tags.length - 3), color: 'default' }));
      card.appendChild(meta);
    }
    if (cfg.pnl && typeof e.pnl === 'number') {
      card.appendChild(el('div', 'cc-pnl ' + signClass(e.pnl), fmtMoney(e.pnl)));
    }
    card.addEventListener('click', () => Peek.open(api, e.id));
    return card;
  }

  // Entry card inside a calendar tile: big photo on top, bold title, tag chips, and an accent bar
  // in the first tag's color so journaled days stand out. `compact` drops the photo when a day is busy.
  function buildEntryRow(e, optMap, compact) {
    const row = el('button', 'cal-entry' + (compact ? ' compact' : ''));
    row.type = 'button';
    const tags = e.tags.map(id => optMap.get(id)).filter(Boolean);
    if (tags.length) row.style.setProperty('--tag', (TAG_COLORS[tags[0].color] || TAG_COLORS.default)[1]);
    if (e.images.length && !compact) {
      const cover = el('div', 'ce-cover');
      const img = el('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      cover.appendChild(img);
      if (e.images.length > 1) cover.appendChild(el('span', 'ce-count', '+' + (e.images.length - 1)));
      row.appendChild(cover);
      row.classList.add('has-cover');
      Media.url(e.images[0]).then(u => { if (u) img.src = u; else { cover.remove(); row.classList.remove('has-cover'); } });
    }
    // No photo: the entry becomes a paper note taped to the day (paper color per journal),
    // with a slight tilt that's always the same for that entry.
    if (!row.classList.contains('has-cover')) {
      row.classList.add('note', 'paper-' + (cfg.paper || 'tan'));
      let h = 0;
      for (let i = 0; i < e.id.length; i++) h = (h * 31 + e.id.charCodeAt(i)) | 0;
      row.style.setProperty('--tilt', ((Math.abs(h) % 7) - 3) * 0.6 + 'deg');
      if (!compact) row.appendChild(el('span', 'ce-tape'));
    }
    const body = el('span', 'ce-body');
    body.appendChild(el('span', 'ce-title' + (e.title.trim() ? '' : ' untitled'), e.title.trim() || 'Untitled'));
    if (row.classList.contains('note') && !compact) {
      const text = cfg.sections.map(s => (e[s.key] || '').trim()).filter(Boolean).join(' ');
      if (text) body.appendChild(el('span', 'ce-excerpt', text));
    }
    if (tags.length) {
      const chips = el('span', 'ce-tags');
      tags.slice(0, compact ? 2 : 3).forEach(o => chips.appendChild(tagChip(o)));
      if (tags.length > (compact ? 2 : 3)) chips.appendChild(el('span', 'ce-more', '+' + (tags.length - (compact ? 2 : 3))));
      body.appendChild(chips);
    }
    row.appendChild(body);
    row.title = (e.title.trim() || 'Untitled') + (tags.length ? ' · ' + tags.map(t => t.name).join(', ') : '');
    row.addEventListener('click', ev => { ev.stopPropagation(); Peek.open(api, e.id); });
    return row;
  }

  function onCellClick(ds, list) {
    if (!list.length) {
      newEntry(ds);
      return;
    }
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    if (list.length === 1) Peek.open(api, list[0].id);
    else Peek.openDay(api, ds);
  }

  /* Skeleton */
  const VIEW_KEY = 'pulse_local_jview_' + cfg.id; // per device (not synced)
  let view = (() => { try { return Store.getItem(VIEW_KEY) || 'calendar'; } catch (e) { return 'calendar'; } })();

  root.innerHTML = '';
  const head = el('div', 'jr-head');
  const monthEl = el('div', 'jr-month');
  const viewSeg = el('div', 'seg seg-sm jr-view');
  [['calendar', 'Calendar'], ['feed', 'Feed']].forEach(([k, label]) => {
    const b = el('button', null, label);
    b.type = 'button';
    b.dataset.view = k;
    b.addEventListener('click', () => {
      view = k;
      try { Store.setItem(VIEW_KEY, k); } catch (e) { /* ignore */ }
      render();
    });
    viewSeg.appendChild(b);
  });
  const nav = el('div', 'jr-nav');
  const prevBtn = el('button');
  prevBtn.type = 'button';
  prevBtn.title = 'Previous month';
  prevBtn.innerHTML = SVG.left;
  const todayBtn = el('button', null, 'Today');
  todayBtn.type = 'button';
  const nextBtn = el('button');
  nextBtn.type = 'button';
  nextBtn.title = 'Next month';
  nextBtn.innerHTML = SVG.right;
  nav.append(prevBtn, todayBtn, nextBtn);
  head.append(monthEl, viewSeg, nav);

  const stats = el('div', 'jr-stats' + (cfg.pnl ? ' jr-stats-5' : ''));
  const strip = el('div', 'jr-strip');
  const cal = el('div', 'cal' + (cfg.pnl ? ' has-week' : ''));
  const dows = el('div', 'cal-dows');
  DOW.forEach(d => dows.appendChild(el('div', null, d)));
  if (cfg.pnl) dows.appendChild(el('div', 'cal-week-head', 'Week'));
  const grid = el('div', 'cal-grid');
  cal.append(dows, grid);
  const feed = el('div', 'jr-feed');
  root.append(head, stats, strip, cal, feed);

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  }
  prevBtn.addEventListener('click', () => shiftMonth(-1));
  nextBtn.addEventListener('click', () => shiftMonth(1));
  todayBtn.addEventListener('click', () => {
    const [y, m] = getActiveDateString().split('-').map(Number);
    viewYear = y;
    viewMonth = m - 1;
    render();
  });

  function stat(label, value, cls, sub) {
    const box = el('div', 'jr-stat');
    box.appendChild(el('div', 'jr-stat-label', label));
    const v = el('div', 'jr-stat-value' + (cls ? ' ' + cls : ''));
    if (value instanceof Node) v.appendChild(value);
    else v.appendChild(document.createTextNode(value));
    if (sub) v.appendChild(el('span', 'jr-stat-sub', sub));
    box.appendChild(v);
    stats.appendChild(box);
  }

  // A day only counts as traded when its net P&L isn't $0 (a flat or P&L-less day doesn't count).
  const tradedDays = byDay => [...byDay.values()].filter(v => Math.abs(v) >= 0.005).length;

  function renderStats(all, monthEntries, optMap) {
    stats.innerHTML = '';
    const days = new Set(monthEntries.map(e => e.date));
    if (cfg.pnl) {
      const withPnl = monthEntries.filter(e => typeof e.pnl === 'number');
      const net = withPnl.reduce((a, e) => a + e.pnl, 0);
      let wins = 0;
      let losses = 0;
      monthEntries.forEach(e => {
        const names = tagNames(e, optMap);
        if (names.includes('tp')) wins++;
        else if (names.includes('sl')) losses++;
      });
      const byDay = new Map();
      withPnl.forEach(e => byDay.set(e.date, (byDay.get(e.date) || 0) + e.pnl));
      const best = byDay.size ? Math.max(...byDay.values()) : null;
      const traded = tradedDays(byDay);
      stat('Net P&L', withPnl.length ? fmtMoney(net) : '—', withPnl.length ? signClass(net) : '');
      stat('Win rate', wins + losses ? Math.round(wins / (wins + losses) * 100) + '%' : '—', '', wins + 'W · ' + losses + 'L');
      stat('Days traded', String(traded));
      stat('Journals', String(monthEntries.length));
      stat('Best day', best != null ? fmtMoney(best) : '—', best != null ? signClass(best) : '');
    } else {
      const allDays = new Set(all.map(e => e.date));
      let streak = 0;
      let d = getActiveDateString();
      if (!allDays.has(d)) d = shiftDate(d, -1);
      while (allDays.has(d)) {
        streak++;
        d = shiftDate(d, -1);
      }
      const counts = new Map();
      monthEntries.forEach(e => e.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
      let top = null;
      counts.forEach((n, id) => { if (optMap.has(id) && (!top || n > top.n)) top = { id, n }; });
      stat(cfg.rating ? 'Days reviewed' : 'Entries', String(cfg.rating ? days.size : monthEntries.length));
      if (cfg.rating) {
        const rated = monthEntries.filter(e => e.rating > 0);
        const avg = rated.length ? rated.reduce((a, e) => a + Number(e.rating), 0) / rated.length : 0;
        stat('Avg day', avg ? avg.toFixed(1) : '—', '', avg ? '/ 5' : '');
      } else stat('Days journaled', String(days.size));
      stat('Streak', String(streak), '', streak === 1 ? 'day' : 'days');
      stat(cfg.topTagLabel || 'Top tag', top ? tagChip(optMap.get(top.id)) : '—', '', top ? '×' + top.n : '');
    }
  }

  // Trades: the month's equity curve. Mental: how often each mistake showed up this month.
  function renderStrip(monthEntries, optMap, daysInMonth) {
    strip.innerHTML = '';
    if (cfg.pnl) {
      const byDay = new Map();
      monthEntries.forEach(e => { if (typeof e.pnl === 'number') byDay.set(e.date, (byDay.get(e.date) || 0) + e.pnl); });
      if (!byDay.size) { strip.hidden = true; return; }
      strip.hidden = false;
      const head = el('div', 'strip-head');
      head.append(el('span', 'gm-eyebrow', 'Equity curve'));
      let run = 0;
      const pts = [{ d: 0, v: 0 }];
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = viewYear + '-' + pad2(viewMonth + 1) + '-' + pad2(d);
        if (byDay.has(ds)) { run += byDay.get(ds); pts.push({ d, v: run, ds, day: byDay.get(ds) }); }
      }
      head.append(el('span', 'strip-end ' + signClass(run), fmtMoney(run)));
      strip.appendChild(head);
      const wrap = el('div', 'strip-chart');
      strip.appendChild(wrap);
      requestAnimationFrame(() => {
        const W = wrap.clientWidth;
        if (!W) return;
        const H = 72;
        const vals = pts.map(p => p.v);
        const lo = Math.min(0, ...vals);
        const hi = Math.max(0, ...vals);
        const span = hi - lo || 1;
        const X = d => 6 + (d / daysInMonth) * (W - 12);
        const Y = v => 6 + (hi - v) / span * (H - 12);
        const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
        const zero = Y(0).toFixed(1);
        const last = pts[pts.length - 1];
        const area = line + ' L' + X(last.d).toFixed(1) + ' ' + zero + ' L' + X(0).toFixed(1) + ' ' + zero + ' Z';
        const color = run >= 0 ? 'var(--accent)' : 'var(--loss)';
        const dots = pts.slice(1).map(p => '<circle cx="' + X(p.d).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="3" fill="' +
          (p.day >= 0 ? 'var(--accent)' : 'var(--loss)') + '" stroke="#1c1d20" stroke-width="1.5"><title>' + shortDate(p.ds) +
          ': ' + fmtMoney(p.day) + ' (total ' + fmtMoney(p.v) + ')</title></circle>').join('');
        wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Equity curve this month">' +
          '<defs><linearGradient id="eq-' + cfg.id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity="0.28"/>' +
          '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
          '<line x1="0" x2="' + W + '" y1="' + zero + '" y2="' + zero + '" stroke="rgba(255,255,255,0.14)" stroke-dasharray="3 4"/>' +
          '<path d="' + area + '" fill="url(#eq-' + cfg.id + ')"/>' +
          '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
          dots + '</svg>';
      });
    } else {
      const counts = new Map();
      monthEntries.forEach(e => e.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
      const ranked = [...counts.entries()].filter(([id]) => optMap.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (!ranked.length) { strip.hidden = true; return; }
      strip.hidden = false;
      strip.appendChild(el('div', 'strip-head')).appendChild(el('span', 'gm-eyebrow', 'Most common this month'));
      const bars = el('div', 'strip-bars');
      const max = ranked[0][1];
      ranked.forEach(([id, n]) => {
        const o = optMap.get(id);
        const row = el('div', 'strip-bar');
        row.appendChild(tagChip(o));
        const track = el('div', 'meter');
        const fill = el('div', 'meter-fill');
        fill.style.width = (n / max * 100) + '%';
        fill.style.background = (TAG_COLORS[o.color] || TAG_COLORS.default)[1];
        track.appendChild(fill);
        row.append(track, el('span', 'strip-count', '×' + n));
        bars.appendChild(row);
      });
      strip.appendChild(bars);
    }
  }

  // Feed: newest first, grouped by day, with screenshots and a preview of the writing.
  function renderFeed(monthEntries, optMap) {
    feed.innerHTML = '';
    const list = monthEntries.slice().sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    if (!list.length) {
      const empty = el('div', 'feed-empty');
      empty.appendChild(el('div', null, 'Nothing in ' + new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long' }) + ' yet.'));
      const add = el('button', 'btn-primary', '+ New entry');
      add.type = 'button';
      add.addEventListener('click', () => newEntry(getActiveDateString()));
      empty.appendChild(add);
      feed.appendChild(empty);
      return;
    }
    let lastDate = null;
    list.forEach(e => {
      if (e.date !== lastDate) {
        lastDate = e.date;
        const dayList = list.filter(x => x.date === e.date);
        const dayHead = el('div', 'feed-day');
        dayHead.appendChild(el('span', null, formatDate(e.date)));
        if (cfg.pnl) {
          const net = sumPnl(dayList);
          if (net != null) dayHead.appendChild(el('span', 'feed-day-pnl ' + signClass(net), fmtMoney(net)));
        }
        feed.appendChild(dayHead);
      }
      const card = el('button', 'feed-card');
      card.type = 'button';
      const main = el('div', 'feed-main');
      main.appendChild(el('div', 'feed-title' + (e.title.trim() ? '' : ' untitled'), e.title.trim() || 'Untitled'));
      const tags = e.tags.map(id => optMap.get(id)).filter(Boolean);
      if (tags.length) {
        const meta = el('div', 'cc-meta');
        tags.forEach(o => meta.appendChild(tagChip(o)));
        main.appendChild(meta);
      }
      const text = cfg.sections.map(s => (e[s.key] || '').trim()).filter(Boolean).join(' — ');
      if (text) main.appendChild(el('div', 'feed-excerpt', text.length > 220 ? text.slice(0, 220) + '…' : text));
      if (e.images.length) {
        const strip2 = el('div', 'feed-thumbs');
        e.images.slice(0, 4).forEach(rec => {
          const img = el('img');
          img.loading = 'lazy';
          img.decoding = 'async';
          img.alt = '';
          strip2.appendChild(img);
          Media.url(rec).then(u => { if (u) img.src = u; else img.remove(); });
        });
        main.appendChild(strip2);
      }
      card.appendChild(main);
      if (cfg.pnl && typeof e.pnl === 'number') card.appendChild(el('div', 'feed-pnl ' + signClass(e.pnl), fmtMoney(e.pnl)));
      card.addEventListener('click', () => Peek.open(api, e.id));
      feed.appendChild(card);
    });
  }

  function render() {
    const options = getOptions();
    const optMap = new Map(options.map(o => [o.id, o]));
    const entries = getEntries();
    const byDate = new Map();
    entries.forEach(e => {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    });
    byDate.forEach(list => list.sort((a, b) => a.created - b.created));

    monthEl.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    viewSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const lead = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    const today = getActiveDateString();
    const prefix = viewYear + '-' + pad2(viewMonth + 1);
    const monthEntries = entries.filter(e => e.date.startsWith(prefix));

    renderStats(entries, monthEntries, optMap);
    renderStrip(monthEntries, optMap, daysInMonth);
    cal.hidden = view !== 'calendar';
    feed.hidden = view !== 'feed';
    if (view === 'feed') { renderFeed(monthEntries, optMap); return; }

    // Tile shading scales with the size of the day's P&L (relative to the biggest day this month).
    let maxAbs = 0;
    if (cfg.pnl) {
      byDate.forEach((list, ds) => {
        if (!ds.startsWith(prefix)) return;
        const net = sumPnl(list);
        if (net != null) maxAbs = Math.max(maxAbs, Math.abs(net));
      });
    }

    grid.innerHTML = '';
    let week = { net: 0, has: false, trades: 0, green: 0, red: 0 };
    for (let i = 0; i < total; i++) {
      const d = new Date(viewYear, viewMonth, 1 - lead + i);
      const ds = toDateString(d);
      const list = byDate.get(ds) || [];
      const inMonth = d.getMonth() === viewMonth;
      const cell = el('div', 'cal-cell');
      if (!inMonth) cell.classList.add('out');
      if (ds === today) cell.classList.add('today');
      if (ds > today) cell.classList.add('future');
      const net = cfg.pnl ? sumPnl(list) : null;
      if (cfg.colorDays) {
        const result = dayResult(list, optMap) || (net > 0 ? 'win' : net < 0 ? 'loss' : '');
        if (result) cell.classList.add(result);
        const heat = net != null && maxAbs ? Math.abs(net) / maxAbs : 0.45;
        cell.style.setProperty('--heat', heat.toFixed(2));
      }
      if (list.length) cell.classList.add('has-entries');
      // Daily review: the tile glows brighter the better you rated the day.
      const rating = cfg.rating ? Math.max(0, ...list.map(e => Number(e.rating) || 0)) : 0;
      if (rating) {
        cell.classList.add('rated', 'r' + rating);
        cell.style.setProperty('--heat', (rating / 5).toFixed(2));
      }
      // Phones: the day's first photo fills the tile.
      const withPhoto = list.find(e => e.images.length);
      // Phones: a day with only written entries takes the journal's paper color.
      if (list.length && !withPhoto && !cell.classList.contains('win') && !cell.classList.contains('loss') && !cell.classList.contains('mixed')) cell.classList.add('has-note', 'paper-' + (cfg.paper || 'tan'));
      if (withPhoto) {
        const bg = el('div', 'cal-bg');
        cell.appendChild(bg);
        cell.classList.add('has-photo');
        Media.url(withPhoto.images[0]).then(u => { if (u) bg.style.backgroundImage = 'url("' + u + '")'; else { bg.remove(); cell.classList.remove('has-photo'); } });
      }

      const top = el('div', 'cal-top');
      top.appendChild(el('span', 'cal-num', d.getDate() === 1
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : String(d.getDate())));
      const add = el('button', 'cal-add');
      add.type = 'button';
      add.title = 'New entry';
      add.innerHTML = SVG.plus;
      add.addEventListener('click', ev => {
        ev.stopPropagation();
        newEntry(ds);
      });
      top.appendChild(add);
      cell.appendChild(top);

      if (net != null) cell.appendChild(el('div', 'cal-pnl ' + signClass(net), fmtMoneyShort(net)));
      if (rating) {
        const r = el('div', 'cal-rating');
        for (let s = 1; s <= 5; s++) r.appendChild(el('i', s <= rating ? 'on' : ''));
        r.title = 'Day rated ' + rating + '/5';
        cell.appendChild(r);
      }
      const rows = el('div', 'cal-entries');
      // The first entry (with a photo if there is one) gets the big card; the rest stay compact.
      const ordered = withPhoto ? [withPhoto, ...list.filter(e => e !== withPhoto)] : list;
      ordered.slice(0, 3).forEach((e, idx) => rows.appendChild(buildEntryRow(e, optMap, idx > 0)));
      if (list.length > 3) rows.appendChild(el('div', 'cal-more', '+' + (list.length - 3) + ' more'));
      if (list.length) cell.appendChild(rows);
      if (list.length) {
        const dots = el('div', 'cal-dots');
        list.slice(0, 3).forEach(() => dots.appendChild(el('i')));
        cell.appendChild(dots);
      }
      cell.addEventListener('click', ev => {
        if (ev.target.closest('.cal-entry, .cal-add')) return;
        onCellClick(ds, list);
      });
      grid.appendChild(cell);

      if (cfg.pnl && inMonth) {
        week.trades += list.length;
        if (net != null) {
          week.net += net;
          week.has = true;
          if (net > 0) week.green++;
          else if (net < 0) week.red++;
        }
      }
      // Weekly totals at the end of each row (PC).
      if (cfg.pnl && i % 7 === 6) {
        const wk = el('div', 'cal-week' + (week.has ? ' ' + signClass(week.net) : ''));
        wk.appendChild(el('div', 'wk-label', 'Week'));
        wk.appendChild(el('div', 'wk-net', week.has ? fmtMoneyShort(week.net) : '—'));
        if (week.trades) wk.appendChild(el('div', 'wk-sub', week.trades + (week.trades === 1 ? ' entry' : ' entries')));
        if (week.green + week.red) wk.appendChild(el('div', 'wk-sub', week.green + ' green · ' + week.red + ' red'));
        grid.appendChild(wk);
        week = { net: 0, has: false, trades: 0, green: 0, red: 0 };
      }
    }
  }

  function monthStats(year, month) {
    const optMap = new Map(getOptions().map(o => [o.id, o]));
    const prefix = year + '-' + pad2(month + 1);
    const list = getEntries().filter(e => e.date.startsWith(prefix));
    const withPnl = list.filter(e => typeof e.pnl === 'number');
    let wins = 0;
    let losses = 0;
    list.forEach(e => {
      const names = tagNames(e, optMap);
      if (names.includes('tp')) wins++;
      else if (names.includes('sl')) losses++;
    });
    const byDay = new Map();
    withPnl.forEach(e => byDay.set(e.date, (byDay.get(e.date) || 0) + e.pnl));
    return {
      entries: list.length,
      days: tradedDays(byDay),
      hasPnl: withPnl.length > 0,
      net: withPnl.reduce((a, e) => a + e.pnl, 0),
      wins,
      losses,
      byDay,
      best: byDay.size ? Math.max(...byDay.values()) : null
    };
  }

  const api = {
    cfg, getEntries, getEntry, saveEntries, getOptions, saveOptions,
    updateEntry, deleteEntry, newEntry, isEmpty, buildCard, render, monthStats
  };
  return api;
}

const Trades = createJournal({
  id: 'trades',
  rootId: 'tradesJournal',
  title: 'Trades',
  paper: 'tan',
  tagsLabel: 'Tags',
  pnl: true,
  colorDays: true,
  sections: [
    { key: 'notes', placeholder: 'How did the day go? Setup, entry, exit, emotions, what you’d do differently…' }
  ],
  defaultOptions: [
    ['TP', 'green'], ['SL', 'red'], ['BE', 'gray'], ['Long', 'blue'], ['Short', 'purple'],
    ['A+ setup', 'yellow'], ['FOMO', 'orange'], ['Broke Rules', 'pink']
  ]
});

// Psychology journal: log a trading-psychology mistake and the plan to fix it.
const Mental = createJournal({
  id: 'mental',
  rootId: 'mentalJournal',
  title: 'Mental',
  paper: 'lavender',
  tagsLabel: 'Mistakes',
  topTagLabel: 'Top mistake',
  titlePlaceholder: 'Name the mistake…',
  pnl: false,
  colorDays: false,
  sections: [
    { key: 'notes', heading: 'The mistake', placeholder: 'What happened? What triggered it, what were you thinking and feeling in the moment?' },
    { key: 'fix', heading: 'The fix', placeholder: 'How will you fix it? A rule, a checklist item, or what you’ll do next time you feel this way…' }
  ],
  defaultOptions: [
    ['FOMO', 'orange'], ['Revenge trading', 'red'], ['Overtrading', 'pink'], ['Hesitation', 'blue'],
    ['Moved stop loss', 'purple'], ['Cut winner early', 'yellow'], ['Oversized', 'brown'],
    ['Boredom trade', 'gray'], ['Broke Rules', 'red']
  ],
  replacesDefaults: ['Calm', 'Focused', 'Motivated', 'Grateful', 'Anxious', 'Stressed', 'Tired']
});

// Daily review: one look back at the whole day, rated 1–5. The top of each entry fills itself in
// from the rest of Pulse (trades, food, training, peptides) for that date.
const Review = createJournal({
  id: 'review',
  rootId: 'reviewJournal',
  title: 'Daily review',
  paper: 'burgundy',
  tagsLabel: 'Tags',
  topTagLabel: 'Top tag',
  titlePlaceholder: 'The day in one line…',
  pnl: false,
  colorDays: false,
  rating: true,
  sections: [
    { key: 'notes', heading: 'What went well', placeholder: 'Wins today — trading, school, gym, anything you’re proud of…' },
    { key: 'improve', heading: 'What to improve', placeholder: 'What didn’t go to plan, and why?' },
    { key: 'focus', heading: 'Tomorrow’s one focus', placeholder: 'One thing to nail tomorrow. It shows on your dashboard in the morning.' }
  ],
  defaultOptions: [
    ['Productive', 'blue'], ['Great trading', 'green'], ['School', 'purple'], ['Gym', 'pink'],
    ['Tired', 'gray'], ['Stressed', 'orange'], ['Distracted', 'yellow']
  ],
  summary(ds) {
    const out = [];
    const trades = Trades.getEntries().filter(e => e.date === ds);
    const pnl = trades.filter(e => typeof e.pnl === 'number').reduce((a, e) => a + e.pnl, 0);
    const hasPnl = trades.some(e => typeof e.pnl === 'number');
    out.push(['Trading', hasPnl ? fmtMoney(pnl) : trades.length ? trades.length + ' logged' : 'No trades', hasPnl ? signClass(pnl) : 'muted']);
    const n = Nutrition.dayTotals(ds);
    out.push(['Food', n.count ? fmtInt(n.totals.kcal) + ' kcal · ' + Math.round(n.totals.p) + 'g P' : 'Not logged',
      !n.count ? 'muted' : n.totals.p >= n.targets.p * 0.9 ? 'pos' : '']);
    const g = Gym.dayStatus(ds);
    out.push(['Training', g.day && g.day.rest ? 'Rest day' : g.complete ? (g.day ? g.day.name : 'Workout') + ' ✓' :
      (g.day ? g.day.name : 'Workout') + ' · ' + (g.done || []).length + '/' + (g.day ? g.day.exercises.length : 0), g.complete ? 'pos' : g.day && g.day.rest ? 'muted' : 'neg']);
    const p = Peptides.dayCounts(ds);
    if (p.any) out.push(['Peptides', p.sched ? p.done + '/' + p.sched : p.done ? p.done + ' logged' : 'None due', p.sched && p.done >= p.sched ? 'pos' : p.sched ? 'neg' : 'muted']);
    if (p.checkin && p.checkin.energy) out.push(['Energy', p.checkin.energy + ' / 5', '']);
    return out;
  }
});

