// Peptides: doses, vials, calculator, sites, check-ins.
/* ---------------- Peptides ----------------
   Your stack as vials (liquid level = what's left), today's doses as capsules you tap to log,
   injection-site rotation on a body map, a 12-week consistency grid and a daily check-in.
   Everything here is only what you type in — Pulse never suggests compounds or doses.
   Stored in localStorage "peptides_v1" (so it syncs and is included in backups). */
const Peptides = (() => {
  const KEY = 'peptides_v1';
  const COLORS = { blue: '#7AA2F7', violet: '#B392F0', teal: '#5CCFE6', mint: '#7FD8B0', amber: '#F2C97D', coral: '#F59E8B', pink: '#F28FC7', silver: '#C8CCD4' };
  const SLOTS = [['AM', 'Morning'], ['PM', 'Evening']];
  const SLOT_NAME = { AM: 'Morning', PM: 'Evening' };
  const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Positions are on a 120×250 figure. Front view is mirrored (your left is on the right).
  const SITES = [
    { id: 'delt-l', label: 'Left delt', view: 'front', x: 93, y: 57 },
    { id: 'delt-r', label: 'Right delt', view: 'front', x: 27, y: 57 },
    { id: 'abd-l', label: 'Left abdomen', view: 'front', x: 70, y: 102 },
    { id: 'abd-r', label: 'Right abdomen', view: 'front', x: 50, y: 102 },
    { id: 'thigh-l', label: 'Left thigh', view: 'front', x: 71, y: 166 },
    { id: 'thigh-r', label: 'Right thigh', view: 'front', x: 49, y: 166 },
    { id: 'glute-l', label: 'Left glute', view: 'back', x: 49, y: 133 },
    { id: 'glute-r', label: 'Right glute', view: 'back', x: 71, y: 133 }
  ];
  const siteById = id => SITES.find(s => s.id === id);
  const HOUR = 3600 * 1000;

  const $ = id => document.getElementById(id);
  const todayEl = $('pepToday');
  const stackEl = $('pepStack');
  const sitesEl = $('pepSites');
  const checkEl = $('pepCheckin');
  const adhEl = $('pepAdherence');
  const logEl = $('pepLog');

  /* ---------- Data ---------- */
  function load() {
    let d = null;
    try { d = JSON.parse(Store.getItem(KEY) || 'null'); } catch (e) { d = null; }
    d = d && typeof d === 'object' ? d : {};
    return {
      compounds: Array.isArray(d.compounds) ? d.compounds : [],
      logs: Array.isArray(d.logs) ? d.logs : [],
      checkins: d.checkins && typeof d.checkins === 'object' ? d.checkins : {}
    };
  }
  function save(d) {
    if (d.logs.length > 3000) d.logs = d.logs.slice(-3000);
    try { Store.setItem(KEY, JSON.stringify(d)); } catch (e) { Toast.show('Couldn’t save — storage is full'); }
  }
  function commit(fn) {
    const d = load();
    fn(d);
    save(d);
    render();
  }

  /* ---------- Math ---------- */
  const today = () => getActiveDateString();
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  const colorOf = c => COLORS[c.color] || COLORS.blue;
  const doseMcg = c => (Number(c.dose) || 0) * (c.doseUnit === 'mg' ? 1000 : 1);
  const concOf = (vialMg, waterMl) => (vialMg > 0 && waterMl > 0 ? vialMg * 1000 / waterMl : 0); // mcg per mL
  const unitsFor = (mcg, vialMg, waterMl) => { const k = concOf(vialMg, waterMl); return k ? mcg / k * 100 : 0; }; // U-100: 100 units = 1 mL
  const units = c => unitsFor(doseMcg(c), c.vialMg, c.waterMl);
  const dosesLeft = c => (doseMcg(c) ? Math.floor((Math.max(0, Number(c.remainingMg) || 0) * 1000 + 1e-6) / doseMcg(c)) : 0);
  const dosesPerVial = c => (doseMcg(c) ? Math.floor((c.vialMg * 1000 + 1e-6) / doseMcg(c)) : 0);
  const fmtMcg = mcg => (mcg >= 1000 ? fmtNum(mcg / 1000) + ' mg' : fmtNum(mcg) + ' mcg');
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtU = u => (u >= 100 ? Math.round(u) : Math.round(u * 10) / 10) + ' u';
  const slotsOf = c => (Array.isArray(c.times) && c.times.length ? c.times : ['AM']);
  const isPaused = c => Array.isArray(c.pauses) && c.pauses.some(p => !p[1]);

  function isScheduled(c, ds) {
    if (!c.start || ds < c.start) return false;
    const n = dayDiff(c.start, ds);
    if (c.weeks > 0 && n >= c.weeks * 7) return false;
    if (Array.isArray(c.pauses) && c.pauses.some(([from, to]) => ds >= from && (!to || ds < to))) return false;
    const s = c.schedule || { type: 'daily' };
    if (s.type === 'days') return (s.days || []).includes(new Date(ds + 'T12:00:00').getDay());
    if (s.type === 'interval') return n % Math.max(1, Number(s.every) || 1) === 0;
    return true;
  }

  function scheduleText(c) {
    const s = c.schedule || { type: 'daily' };
    const times = slotsOf(c).length === 2 ? '2× a day' : SLOT_NAME[slotsOf(c)[0]].toLowerCase();
    if (s.type === 'days') {
      const days = (s.days || []).slice().sort();
      const label = days.length === 5 && !days.includes(0) && !days.includes(6) ? 'Weekdays' : days.map(i => DOW_SHORT[i]).join(' ');
      return label + ' · ' + times;
    }
    if (s.type === 'interval' && Number(s.every) > 1) return 'Every ' + s.every + ' days · ' + times;
    return 'Daily · ' + times;
  }

  const loggedFor = (d, cid, ds, slot) => d.logs.find(l => l.cid === cid && l.date === ds && l.slot === slot);

  function dayCounts(d, ds) {
    let sched = 0;
    let done = 0;
    d.compounds.forEach(c => {
      if (!isScheduled(c, ds)) return;
      slotsOf(c).forEach(t => {
        sched++;
        if (loggedFor(d, c.id, ds, t)) done++;
      });
    });
    return { sched, done };
  }

  // The day the current vial runs dry if every scheduled dose is taken (or null if it outlasts the cycle).
  function runOut(d, c) {
    let left = dosesLeft(c);
    if (!left || isPaused(c)) return null;
    let ds = today();
    for (let i = 0; i < 500; i++) {
      if (isScheduled(c, ds)) {
        for (const t of slotsOf(c)) {
          if (i === 0 && loggedFor(d, c.id, ds, t)) continue;
          left--;
          if (left <= 0) return ds;
        }
      }
      if (c.weeks > 0 && dayDiff(c.start, ds) >= c.weeks * 7) return null;
      ds = shiftDate(ds, 1);
    }
    return null;
  }

  function nextDose(d) {
    let ds = shiftDate(today(), 1);
    for (let i = 0; i < 60; i++) {
      for (const c of d.compounds) if (isScheduled(c, ds)) return { c, ds, t: slotsOf(c)[0] };
      ds = shiftDate(ds, 1);
    }
    return null;
  }

  function siteLastUsed(d) {
    const last = {};
    d.logs.forEach(l => { if (l.site && (!last[l.site] || l.ts > last[l.site])) last[l.site] = l.ts; });
    return last;
  }
  function suggestSite(d) {
    const last = siteLastUsed(d);
    let best = null;
    SITES.forEach(s => {
      const t = last[s.id] || 0;
      if (!best || t < best.t) best = { id: s.id, t };
    });
    return best && best.id;
  }
  function ago(ts) {
    if (!ts) return 'never used';
    const h = (Date.now() - ts) / HOUR;
    if (h < 1) return 'just now';
    if (h < 24) return Math.round(h) + 'h ago';
    const days = Math.round(h / 24);
    return days === 1 ? 'yesterday' : days + ' days ago';
  }
  function heatClass(ts) {
    if (!ts) return 's-fresh';
    const h = (Date.now() - ts) / HOUR;
    return h < 24 ? 's-hot' : h < 72 ? 's-warm' : 's-rest';
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function whenText(l) {
    const t = today();
    const day = l.date === t ? 'Today' : l.date === shiftDate(t, -1) ? 'Yesterday' : shortDate(l.date);
    return day + ', ' + fmtTime(l.ts);
  }

  /* ---------- Shared pieces ---------- */
  function head(title, extra) {
    const h = el('header', 'col-head');
    h.appendChild(el('span', 'col-title', title));
    if (extra) h.appendChild(extra);
    return h;
  }

  function iconBtn(svg, title, fn, cls) {
    const b = el('button', 'icon-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg;
    b.addEventListener('click', e => { e.stopPropagation(); fn(); });
    return b;
  }

  // An insulin syringe drawn to the dose: barrel with unit ticks, filled to the line you draw to.
  function syringe(u, cap) {
    cap = Number(cap) || 100;
    const g = el('div', 'syr' + (u > cap ? ' over' : ''));
    const pct = Math.max(0, Math.min(100, u / cap * 100));
    g.style.setProperty('--fill', pct.toFixed(2) + '%');
    g.style.setProperty('--ticks', String(cap >= 100 ? 10 : cap >= 50 ? 10 : 6));
    const body = el('div', 'syr-body');
    body.appendChild(el('div', 'syr-needle'));
    const barrel = el('div', 'syr-barrel');
    barrel.appendChild(el('div', 'syr-fill'));
    barrel.appendChild(el('div', 'syr-ticks'));
    const mark = el('div', 'syr-mark', u ? fmtU(u) : '—');
    barrel.appendChild(mark);
    body.appendChild(barrel);
    body.appendChild(el('div', 'syr-plunger'));
    g.appendChild(body);
    const scale = el('div', 'syr-scale');
    [0, cap / 2, cap].forEach(n => scale.appendChild(el('span', null, String(n))));
    g.appendChild(scale);
    return g;
  }

  function vialSvg(c, level) {
    const col = colorOf(c);
    const lvl = Math.max(0, Math.min(1, level));
    const id = 'vc' + c.id.replace(/[^a-z0-9]/gi, '');
    const glass = 'M8 20 Q8 15 13 15 H27 Q32 15 32 20 V76 Q32 82 26 82 H14 Q8 82 8 76 Z';
    return '<svg class="vial" viewBox="0 0 40 86" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><path d="' + glass + '"/></clipPath>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity="0.95"/><stop offset="1" stop-color="' + col + '" stop-opacity="0.55"/></linearGradient></defs>' +
      '<rect x="12" y="2" width="16" height="8" rx="2.5" fill="' + col + '"/>' +
      '<rect x="14.5" y="10" width="11" height="5" fill="rgba(255,255,255,0.25)"/>' +
      '<g clip-path="url(#' + id + ')"><rect class="vial-liquid" x="0" y="' + (82 - 62 * lvl).toFixed(1) + '" width="40" height="' + (62 * lvl + 2).toFixed(1) + '" fill="url(#' + id + 'g)"/>' +
      (lvl > 0.02 ? '<rect class="vial-liquid" x="0" y="' + (82 - 62 * lvl).toFixed(1) + '" width="40" height="1.5" fill="rgba(255,255,255,0.55)"/>' : '') + '</g>' +
      '<path d="' + glass + '" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>' +
      '<path d="M12.5 24 V70" stroke="rgba(255,255,255,0.35)" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>';
  }

  // Front + back figures with the injection sites on them.
  function bodyMap(d, opts) {
    opts = opts || {};
    const last = siteLastUsed(d);
    const wrap = el('div', 'bodymap' + (opts.onPick ? ' pickable' : ''));
    ['front', 'back'].forEach(view => {
      const fig = el('div', 'bm-fig');
      let svg = '<svg viewBox="0 0 120 250" role="img" aria-label="' + (view === 'front' ? 'Front' : 'Back') + ' injection sites">' +
        '<g class="bm-body">' +
        '<circle cx="60" cy="21" r="13"/>' +
        '<rect x="54" y="32" width="12" height="10" rx="3"/>' +
        '<path d="M37 44 Q60 37 83 44 L86 72 Q84 98 81 124 L39 124 Q36 98 34 72 Z"/>' +
        '<rect x="19" y="46" width="14" height="78" rx="7"/>' +
        '<rect x="87" y="46" width="14" height="78" rx="7"/>' +
        '<rect x="39.5" y="121" width="19.5" height="122" rx="9.5"/>' +
        '<rect x="61" y="121" width="19.5" height="122" rx="9.5"/>' +
        '</g>' +
        (view === 'front' ? '<circle cx="60" cy="102" r="1.6" class="bm-mark"/>' : '<path d="M60 46 V118" class="bm-line"/>');
      SITES.filter(s => s.view === view).forEach(s => {
        const cls = ['bm-site', heatClass(last[s.id])];
        if (opts.selected === s.id) cls.push('sel');
        if (opts.suggested === s.id) cls.push('next');
        svg += '<g class="' + cls.join(' ') + '" data-site="' + s.id + '"' + (opts.onPick ? ' tabindex="0" role="button"' : '') + '>' +
          '<title>' + s.label + ' · ' + ago(last[s.id]) + '</title>' +
          (opts.suggested === s.id ? '<circle class="bm-ring" cx="' + s.x + '" cy="' + s.y + '" r="11"/>' : '') +
          '<circle class="bm-hit" cx="' + s.x + '" cy="' + s.y + '" r="12"/>' +
          '<circle class="bm-dot" cx="' + s.x + '" cy="' + s.y + '" r="5.5"/></g>';
      });
      svg += '</svg>';
      fig.innerHTML = svg;
      fig.appendChild(el('div', 'bm-cap', view === 'front' ? 'Front' : 'Back'));
      wrap.appendChild(fig);
    });
    if (opts.onPick) {
      const pick = e => {
        const g = e.target.closest('[data-site]');
        if (g) opts.onPick(g.dataset.site);
      };
      wrap.addEventListener('click', pick);
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    }
    return wrap;
  }

  /* ---------- Modal (log a dose / edit a peptide / calculator) ---------- */
  const modal = $('pepModal');
  const panel = $('pepPanel');

  function openModal(crumb, build) {
    panel.innerHTML = '';
    const top = el('div', 'peek-top');
    top.appendChild(el('span', 'peek-crumb', crumb));
    const x = el('button', 'icon-btn peek-close-x', '×');
    x.type = 'button';
    x.title = 'Close (Esc)';
    x.addEventListener('click', closeModal);
    const done = el('button', 'btn-primary peek-done', 'Close');
    done.type = 'button';
    done.addEventListener('click', closeModal);
    top.append(x, done);
    const body = el('div', 'peek-body pep-body');
    panel.append(top, body);
    build(body);
    cancelClose(modal);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    if (modal.hidden || modal._closeTimer != null) return;
    animateOut(modal, () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      panel.innerHTML = '';
    });
  }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  function field(label, input, cls) {
    const f = el('label', 'field' + (cls ? ' ' + cls : ''));
    f.appendChild(el('span', 'field-label', label));
    f.appendChild(input);
    return f;
  }
  function numInput(value, placeholder) {
    const i = el('input', 'goal-input sm');
    i.type = 'number';
    i.step = 'any';
    i.min = '0';
    i.inputMode = 'decimal';
    if (value != null && value !== '') i.value = value;
    if (placeholder) i.placeholder = placeholder;
    return i;
  }
  function segOf(options, value, onChange) {
    const seg = el('div', 'seg pep-seg');
    options.forEach(([k, label]) => {
      const b = el('button', k === value ? 'active' : '', label);
      b.type = 'button';
      b.dataset.k = k;
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        onChange(k);
      });
      seg.appendChild(b);
    });
    return seg;
  }

  /* Log a dose (or look at / remove one already logged) */
  function openLog(cid, slot, logId) {
    const d = load();
    const c = d.compounds.find(x => x.id === cid);
    if (!c) return;
    const existing = logId ? d.logs.find(l => l.id === logId) : null;
    let site = existing ? existing.site : suggestSite(d);
    const suggested = existing ? null : suggestSite(d);
    openModal(existing ? 'Logged dose' : 'Log dose', body => {
      const hero = el('div', 'pep-log-hero');
      hero.style.setProperty('--c', colorOf(c));
      const nm = el('div', 'plh-name', c.name || 'Peptide');
      const sub = el('div', 'plh-sub', fmtMcg(existing ? existing.doseMcg : doseMcg(c)) + ' · ' + SLOT_NAME[slot] +
        (existing ? ' · ' + whenText(existing) : ''));
      hero.append(nm, sub);
      body.appendChild(hero);

      const u = existing ? existing.units : units(c);
      const draw = el('div', 'pep-draw');
      draw.appendChild(el('div', 'gm-eyebrow', 'Draw to'));
      draw.appendChild(el('div', 'pep-draw-num', fmtU(u) + ' '));
      draw.lastChild.appendChild(el('small', null, '= ' + fmtNum(u / 100) + ' mL on a U-100 syringe'));
      draw.appendChild(syringe(u, c.syringe));
      body.appendChild(draw);

      body.appendChild(el('div', 'gm-eyebrow pep-sec', 'Injection site'));
      const siteLine = el('div', 'pep-site-line');
      const last = siteLastUsed(d);
      const paintSite = () => {
        const s = siteById(site);
        siteLine.textContent = s ? s.label + ' · ' + ago(last[s.id]) + (site === suggested ? ' · most rested' : '') : 'Tap a spot on the body';
      };
      let map = null;
      const drawMap = () => {
        const fresh = bodyMap(d, { selected: site, suggested, onPick: id => { site = id; drawMap(); paintSite(); } });
        if (map) map.replaceWith(fresh);
        map = fresh;
      };
      drawMap();
      body.appendChild(map);
      body.appendChild(siteLine);
      paintSite();

      const row = el('div', 'pep-form-row');
      const time = el('input', 'goal-input sm');
      time.type = 'time';
      const ref = new Date(existing ? existing.ts : Date.now());
      time.value = pad2(ref.getHours()) + ':' + pad2(ref.getMinutes());
      const note = el('input', 'goal-input sm');
      note.type = 'text';
      note.placeholder = 'Optional note';
      note.value = existing ? existing.note || '' : '';
      row.append(field('Time', time), field('Note', note, 'grow'));
      body.appendChild(row);

      const stamp = () => {
        const [hh, mm] = (time.value || '').split(':').map(Number);
        const dt = new Date(existing ? existing.ts : Date.now());
        if (isFinite(hh) && isFinite(mm)) dt.setHours(hh, mm, 0, 0);
        return dt.getTime();
      };

      const actions = el('div', 'form-actions');
      if (existing) {
        const saveBtn = el('button', 'btn-primary', 'Save changes');
        saveBtn.type = 'button';
        saveBtn.addEventListener('click', () => {
          commit(dd => {
            const l = dd.logs.find(x => x.id === existing.id);
            if (l) { l.site = site; l.ts = stamp(); l.note = note.value.trim(); }
          });
          closeModal();
        });
        const del = el('button', 'btn-secondary danger-text', 'Remove log');
        del.type = 'button';
        del.addEventListener('click', () => { closeModal(); removeLog(existing.id); });
        actions.append(saveBtn, del);
      } else {
        const go = el('button', 'btn-primary pep-go', 'Log dose');
        go.type = 'button';
        go.addEventListener('click', () => {
          if (!site) { Toast.show('Pick an injection site'); return; }
          const log = { id: uid(), cid: c.id, date: today(), slot, ts: stamp(), doseMcg: doseMcg(c), units: Math.round(units(c) * 10) / 10, site, note: note.value.trim() };
          commit(dd => {
            dd.logs.push(log);
            const cc = dd.compounds.find(x => x.id === c.id);
            if (cc) cc.remainingMg = Math.max(0, round2((Number(cc.remainingMg) || 0) - log.doseMcg / 1000));
          });
          closeModal();
          Toast.show('Logged ' + (c.name || 'dose') + ' · ' + siteById(site).label, { undo: () => removeLog(log.id, true) });
        });
        const cancel = el('button', 'btn-secondary', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', closeModal);
        actions.append(go, cancel);
      }
      body.appendChild(actions);
    });
  }

  function removeLog(id, quiet) {
    const d = load();
    const log = d.logs.find(l => l.id === id);
    if (!log) return;
    commit(dd => {
      dd.logs = dd.logs.filter(l => l.id !== id);
      const c = dd.compounds.find(x => x.id === log.cid);
      if (c) c.remainingMg = Math.min(Number(c.vialMg) || Infinity, round2((Number(c.remainingMg) || 0) + log.doseMcg / 1000));
    });
    if (quiet) return;
    Toast.show('Dose removed', {
      undo: () => commit(dd => {
        dd.logs.push(log);
        const c = dd.compounds.find(x => x.id === log.cid);
        if (c) c.remainingMg = Math.max(0, round2((Number(c.remainingMg) || 0) - log.doseMcg / 1000));
      })
    });
  }

  /* Add / edit a peptide */
  function openEditor(cid) {
    const d = load();
    const orig = cid ? d.compounds.find(x => x.id === cid) : null;
    const used = new Set(d.compounds.map(x => x.color));
    const c = orig ? JSON.parse(JSON.stringify(orig)) : {
      id: uid(), name: '', color: Object.keys(COLORS).find(k => !used.has(k)) || 'blue',
      vialMg: '', waterMl: '', dose: '', doseUnit: 'mcg', syringe: 100,
      schedule: { type: 'daily', days: [1, 2, 3, 4, 5], every: 2 }, times: ['AM'],
      start: today(), weeks: '', notes: '', pauses: []
    };
    c.schedule = Object.assign({ type: 'daily', days: [1, 2, 3, 4, 5], every: 2 }, c.schedule || {});

    openModal(orig ? 'Edit peptide' : 'Add peptide', body => {
      const form = el('div', 'pep-form');

      const name = el('input', 'goal-input');
      name.type = 'text';
      name.placeholder = 'Name — e.g. what’s on the vial label';
      name.value = c.name;
      name.setAttribute('autocomplete', 'off');
      form.appendChild(field('Name', name, 'span-2'));

      const swatches = el('div', 'pep-swatches');
      Object.entries(COLORS).forEach(([k, hex]) => {
        const s = el('button', 'pep-swatch' + (k === c.color ? ' active' : ''));
        s.type = 'button';
        s.style.setProperty('--c', hex);
        s.title = k;
        s.setAttribute('aria-label', k);
        s.addEventListener('click', () => {
          c.color = k;
          swatches.querySelectorAll('.pep-swatch').forEach(x => x.classList.toggle('active', x === s));
          preview();
        });
        swatches.appendChild(s);
      });
      const swWrap = el('div', 'field span-2');
      swWrap.append(el('span', 'field-label', 'Color'), swatches);
      form.appendChild(swWrap);

      form.appendChild(el('div', 'pep-form-title span-2', 'Vial'));
      const vial = numInput(c.vialMg, 'mg on the label');
      const water = numInput(c.waterMl, 'mL you added');
      form.append(field('Vial size (mg)', vial), field('Bacteriostatic water (mL)', water));

      const dose = numInput(c.dose, 'Your dose');
      const doseWrap = el('div', 'pep-inline');
      doseWrap.appendChild(dose);
      doseWrap.appendChild(segOf([['mcg', 'mcg'], ['mg', 'mg']], c.doseUnit, k => { c.doseUnit = k; preview(); }));
      const doseField = el('div', 'field');
      doseField.append(el('span', 'field-label', 'Dose'), doseWrap);
      form.appendChild(doseField);
      const syr = el('select', 'goal-input sm');
      [[100, 'U-100 · 1 mL (100 units)'], [50, 'U-100 · 0.5 mL (50 units)'], [30, 'U-100 · 0.3 mL (30 units)']].forEach(([v, label]) => {
        const o = el('option', null, label);
        o.value = String(v);
        if (Number(c.syringe) === v) o.selected = true;
        syr.appendChild(o);
      });
      form.appendChild(field('Syringe', syr));

      let remain = null;
      if (orig) {
        remain = numInput(round2(Number(c.remainingMg) || 0), 'mg');
        form.appendChild(field('Left in current vial (mg)', remain, 'span-2'));
      }

      const pv = el('div', 'pep-preview span-2');
      form.appendChild(pv);

      form.appendChild(el('div', 'pep-form-title span-2', 'Schedule'));
      const schedBox = el('div', 'field span-2');
      const dayRow = el('div', 'pep-days');
      DOW_SHORT.forEach((label, i) => {
        const b = el('button', 'pep-day' + (c.schedule.days.includes(i) ? ' active' : ''), label.slice(0, 2));
        b.type = 'button';
        b.addEventListener('click', () => {
          const set = new Set(c.schedule.days);
          if (set.has(i)) set.delete(i); else set.add(i);
          c.schedule.days = [...set].sort();
          b.classList.toggle('active', set.has(i));
        });
        dayRow.appendChild(b);
      });
      const every = numInput(c.schedule.every, '2');
      every.min = '2';
      every.step = '1';
      const everyRow = el('label', 'pep-inline pep-every');
      everyRow.append(el('span', null, 'Every'), every, el('span', null, 'days'));
      const paintSched = () => {
        dayRow.hidden = c.schedule.type !== 'days';
        everyRow.hidden = c.schedule.type !== 'interval';
      };
      schedBox.append(el('span', 'field-label', 'How often'),
        segOf([['daily', 'Every day'], ['days', 'Pick days'], ['interval', 'Every N days']], c.schedule.type, k => { c.schedule.type = k; paintSched(); preview(); }),
        dayRow, everyRow);
      paintSched();
      form.appendChild(schedBox);

      const timeRow = el('div', 'pep-days');
      SLOTS.forEach(([k, label]) => {
        const b = el('button', 'pep-day wide' + (c.times.includes(k) ? ' active' : ''), label);
        b.type = 'button';
        b.addEventListener('click', () => {
          const set = new Set(c.times);
          if (set.has(k)) set.delete(k); else set.add(k);
          c.times = SLOTS.map(s => s[0]).filter(x => set.has(x));
          b.classList.toggle('active', set.has(k));
          preview();
        });
        timeRow.appendChild(b);
      });
      const timeField = el('div', 'field span-2');
      timeField.append(el('span', 'field-label', 'Time of day'), timeRow);
      form.appendChild(timeField);

      const start = el('input', 'goal-input sm');
      start.type = 'date';
      start.value = c.start || today();
      const weeks = numInput(c.weeks, 'Ongoing');
      weeks.step = '1';
      form.append(field('Start date', start), field('Cycle length (weeks)', weeks));

      const notes = el('textarea', 'goal-input sm pep-notes');
      notes.rows = 2;
      notes.placeholder = 'Notes — source, storage, anything to remember';
      notes.value = c.notes || '';
      form.appendChild(field('Notes', notes, 'span-2'));

      body.appendChild(form);

      function read() {
        c.name = name.value.trim();
        c.vialMg = parseFloat(vial.value) || 0;
        c.waterMl = parseFloat(water.value) || 0;
        c.dose = parseFloat(dose.value) || 0;
        c.syringe = Number(syr.value) || 100;
        c.schedule.every = Math.max(2, Math.round(parseFloat(every.value) || 2));
        c.start = start.value || today();
        c.weeks = Math.round(parseFloat(weeks.value)) > 0 ? Math.round(parseFloat(weeks.value)) : '';
        c.notes = notes.value.trim();
      }

      function preview() {
        read();
        pv.innerHTML = '';
        const k = concOf(c.vialMg, c.waterMl);
        const u = units(c);
        if (!k || !c.dose) {
          pv.appendChild(el('div', 'pep-preview-empty', 'Fill in the vial, water and dose to see how far to draw.'));
          return;
        }
        const stats = el('div', 'pep-preview-stats');
        [['Concentration', fmtNum(k) + ' mcg/mL'], ['Draw to', fmtU(u)], ['Volume', fmtNum(u / 100) + ' mL'], ['Doses per vial', String(dosesPerVial(c))]]
          .forEach(([l, v]) => {
            const b = el('div');
            b.append(el('span', null, l), el('b', null, v));
            stats.appendChild(b);
          });
        pv.appendChild(stats);
        pv.appendChild(syringe(u, c.syringe));
        if (u > c.syringe) pv.appendChild(el('div', 'pep-warn', 'That’s more than this syringe holds — check the numbers.'));
        else if (u > 0 && u < 2) pv.appendChild(el('div', 'pep-warn', 'Under 2 units is hard to measure accurately — check the numbers.'));
      }
      [vial, water, dose, every, weeks, start].forEach(i => i.addEventListener('input', preview));
      syr.addEventListener('change', preview);
      preview();

      const actions = el('div', 'form-actions');
      const saveBtn = el('button', 'btn-primary', orig ? 'Save' : 'Add to stack');
      saveBtn.type = 'button';
      saveBtn.addEventListener('click', () => {
        read();
        if (!c.name) { name.focus(); Toast.show('Give it a name'); return; }
        if (!(c.vialMg > 0)) { vial.focus(); Toast.show('Enter the vial size'); return; }
        if (!(c.waterMl > 0)) { water.focus(); Toast.show('Enter how much water you added'); return; }
        if (!(c.dose > 0)) { dose.focus(); Toast.show('Enter your dose'); return; }
        if (!c.times.length) { Toast.show('Pick morning, evening or both'); return; }
        if (c.schedule.type === 'days' && !c.schedule.days.length) { Toast.show('Pick at least one day'); return; }
        if (remain) c.remainingMg = Math.max(0, Math.min(c.vialMg, parseFloat(remain.value) || 0));
        else c.remainingMg = c.vialMg;
        if (!orig) c.vialStarted = today();
        commit(dd => {
          const i = dd.compounds.findIndex(x => x.id === c.id);
          if (i >= 0) dd.compounds[i] = c; else dd.compounds.push(c);
        });
        closeModal();
        Toast.show(orig ? 'Saved' : 'Added ' + c.name);
      });
      const cancel = el('button', 'btn-secondary', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', closeModal);
      actions.append(saveBtn, cancel);
      if (orig) {
        const del = el('button', 'btn-ghost danger-text pep-del', 'Delete');
        del.type = 'button';
        del.addEventListener('click', () => {
          if (!confirm('Delete ' + (orig.name || 'this peptide') + '? Its dose history goes with it.')) return;
          const snapshot = load();
          commit(dd => {
            dd.compounds = dd.compounds.filter(x => x.id !== orig.id);
            dd.logs = dd.logs.filter(l => l.cid !== orig.id);
          });
          closeModal();
          Toast.show('Deleted ' + (orig.name || 'peptide'), { undo: () => { save(snapshot); render(); } });
        });
        actions.appendChild(del);
      }
      body.appendChild(actions);
      if (!orig) setTimeout(() => name.focus(), 60);
    });
  }

  /* Reconstitution calculator */
  function openCalc() {
    openModal('Reconstitution calculator', body => {
      body.appendChild(el('div', 'pep-calc-intro', 'How far to draw on an insulin syringe (U-100: 100 units = 1 mL). It only does the math on the numbers you enter.'));
      const form = el('div', 'pep-form');
      const vial = numInput('', 'mg');
      const water = numInput('', 'mL');
      const dose = numInput('', 'Your dose');
      let unit = 'mcg';
      const doseWrap = el('div', 'pep-inline');
      doseWrap.append(dose, segOf([['mcg', 'mcg'], ['mg', 'mg']], unit, k => { unit = k; calc(); }));
      const doseField = el('div', 'field');
      doseField.append(el('span', 'field-label', 'Dose'), doseWrap);
      const syr = el('select', 'goal-input sm');
      [[100, '1 mL (100 units)'], [50, '0.5 mL (50 units)'], [30, '0.3 mL (30 units)']].forEach(([v, label]) => {
        const o = el('option', null, label);
        o.value = String(v);
        syr.appendChild(o);
      });
      form.append(field('Peptide in vial (mg)', vial), field('Water added (mL)', water), doseField, field('Syringe', syr));
      body.appendChild(form);

      const out = el('div', 'pep-calc-out');
      body.appendChild(out);

      const solve = el('div', 'pep-solve');
      const target = numInput('', 'e.g. 10');
      const solveOut = el('div', 'pep-solve-out');
      const solveRow = el('label', 'pep-inline');
      solveRow.append(el('span', null, 'Want each dose to be'), target, el('span', null, 'units?'));
      solve.append(el('div', 'gm-eyebrow', 'Work backwards'), solveRow, solveOut);
      body.appendChild(solve);

      function calc() {
        const mg = parseFloat(vial.value) || 0;
        const ml = parseFloat(water.value) || 0;
        const mcg = (parseFloat(dose.value) || 0) * (unit === 'mg' ? 1000 : 1);
        const cap = Number(syr.value) || 100;
        out.innerHTML = '';
        const k = concOf(mg, ml);
        if (!k || !mcg) {
          out.appendChild(el('div', 'pep-preview-empty', 'Enter the vial, water and dose.'));
        } else {
          const u = unitsFor(mcg, mg, ml);
          const big = el('div', 'pep-calc-big');
          big.append(el('span', 'gm-eyebrow', 'Draw to'), el('div', 'pep-draw-num', fmtU(u)));
          out.appendChild(big);
          out.appendChild(syringe(u, cap));
          const stats = el('div', 'pep-preview-stats');
          [['Volume', fmtNum(u / 100) + ' mL'], ['Concentration', fmtNum(k) + ' mcg/mL'], ['Per 1 unit', fmtNum(k / 100) + ' mcg'], ['Doses per vial', String(Math.floor(mg * 1000 / mcg + 1e-6))]]
            .forEach(([l, v]) => {
              const b = el('div');
              b.append(el('span', null, l), el('b', null, v));
              stats.appendChild(b);
            });
          out.appendChild(stats);
          if (u > cap) out.appendChild(el('div', 'pep-warn', 'More than this syringe holds.'));
        }
        const t = parseFloat(target.value) || 0;
        solveOut.textContent = mg && mcg && t
          ? 'Add ' + fmtNum(mg * 1000 * t / 100 / mcg) + ' mL of water to the ' + fmtNum(mg) + ' mg vial.'
          : 'Fill in the vial and dose above, then a unit count.';
      }
      [vial, water, dose, target].forEach(i => i.addEventListener('input', calc));
      syr.addEventListener('change', calc);
      calc();
      setTimeout(() => vial.focus(), 60);
    });
  }

  function newVial(cid) {
    const d = load();
    const c = d.compounds.find(x => x.id === cid);
    if (!c) return;
    const before = { remainingMg: c.remainingMg, vialStarted: c.vialStarted };
    commit(dd => {
      const cc = dd.compounds.find(x => x.id === cid);
      cc.remainingMg = cc.vialMg;
      cc.vialStarted = today();
    });
    Toast.show('Fresh vial of ' + c.name, {
      undo: () => commit(dd => { const cc = dd.compounds.find(x => x.id === cid); if (cc) Object.assign(cc, before); })
    });
  }

  function togglePause(cid) {
    commit(dd => {
      const c = dd.compounds.find(x => x.id === cid);
      if (!c) return;
      c.pauses = Array.isArray(c.pauses) ? c.pauses : [];
      const open = c.pauses.find(p => !p[1]);
      if (open) {
        if (open[0] === today()) c.pauses = c.pauses.filter(p => p !== open); // paused and resumed the same day
        else open[1] = today();
      } else c.pauses.push([today(), null]);
    });
  }

  /* ---------- Render ---------- */
  function renderToday(d) {
    todayEl.innerHTML = '';
    const ds = today();
    const slots = [];
    d.compounds.forEach(c => {
      if (isScheduled(c, ds)) slotsOf(c).forEach(t => slots.push({ c, t, log: loggedFor(d, c.id, ds, t) }));
    });
    const done = slots.filter(s => s.log).length;

    if (!d.compounds.length) {
      const empty = el('div', 'pt-empty');
      const art = el('div', 'pt-empty-art');
      art.innerHTML = vialSvg({ id: 'demo1', color: 'blue' }, 0.7) + vialSvg({ id: 'demo2', color: 'violet' }, 0.4) + vialSvg({ id: 'demo3', color: 'teal' }, 0.9);
      const txt = el('div', 'pt-empty-text');
      txt.append(el('div', 'pt-empty-title', 'Build your stack'),
        el('div', 'pt-empty-sub', 'Add each peptide with its vial size, water and dose. Pulse works out how far to draw, tracks what’s left in the vial and rotates your injection sites.'));
      const btns = el('div', 'form-actions');
      const add = el('button', 'btn-primary', '+ Add peptide');
      add.type = 'button';
      add.addEventListener('click', () => openEditor());
      const calc = el('button', 'btn-secondary', 'Calculator');
      calc.type = 'button';
      calc.addEventListener('click', openCalc);
      btns.append(add, calc);
      txt.appendChild(btns);
      empty.append(art, txt);
      todayEl.appendChild(empty);
      return;
    }

    // Progress ring
    const ring = el('div', 'pt-ring');
    const R = 34;
    const C = 2 * Math.PI * R;
    const frac = slots.length ? done / slots.length : 0;
    ring.innerHTML = '<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="' + R + '" class="pt-ring-track"/>' +
      '<circle cx="42" cy="42" r="' + R + '" class="pt-ring-fill" stroke-dasharray="' + C.toFixed(1) + '" style="--off:' + (C * (1 - frac)).toFixed(1) + ';--len:' + C.toFixed(1) + '"/></svg>';
    const ringTxt = el('div', 'pt-ring-text');
    ringTxt.append(el('b', null, slots.length ? done + '/' + slots.length : '—'), el('span', null, slots.length ? 'doses' : 'rest day'));
    ring.appendChild(ringTxt);
    if (slots.length && done === slots.length) ring.classList.add('complete');

    const side = el('div', 'pt-side');
    const head2 = el('div', 'pt-head');
    head2.appendChild(el('div', 'gm-eyebrow', 'Today'));
    head2.appendChild(el('div', 'pt-status', !slots.length ? 'Nothing scheduled'
      : done === slots.length ? 'All done for today' : (slots.length - done) + ' to go'));
    side.appendChild(head2);

    if (!slots.length) {
      const nx = nextDose(d);
      side.appendChild(el('div', 'pt-next', nx ? 'Next up: ' + (nx.c.name || 'Peptide') + ' · ' +
        (nx.ds === shiftDate(ds, 1) ? 'tomorrow' : new Date(nx.ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })) +
        ' ' + SLOT_NAME[nx.t].toLowerCase() : 'Nothing coming up — check your schedules.'));
    }

    SLOTS.forEach(([t, label]) => {
      const lane = slots.filter(s => s.t === t);
      if (!lane.length) return;
      const row = el('div', 'pt-lane');
      row.appendChild(el('div', 'pt-lane-label', label));
      const caps = el('div', 'pt-caps');
      lane.forEach(s => {
        const cap = el('button', 'pt-cap' + (s.log ? ' done' : ''));
        cap.type = 'button';
        cap.style.setProperty('--c', colorOf(s.c));
        cap.appendChild(el('span', 'cap-fill'));
        const txt = el('span', 'cap-text');
        txt.appendChild(el('span', 'cap-name', s.c.name || 'Peptide'));
        txt.appendChild(el('span', 'cap-dose', s.log
          ? fmtTime(s.log.ts) + ' · ' + (siteById(s.log.site) ? siteById(s.log.site).label : '—')
          : fmtMcg(doseMcg(s.c)) + ' · ' + fmtU(units(s.c))));
        cap.appendChild(txt);
        const mark = el('span', 'cap-mark');
        mark.innerHTML = s.log
          ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        cap.appendChild(mark);
        cap.title = s.log ? 'Logged — tap to view or remove' : 'Tap to log';
        cap.addEventListener('click', () => openLog(s.c.id, s.t, s.log && s.log.id));
        caps.appendChild(cap);
      });
      row.appendChild(caps);
      side.appendChild(row);
    });

    todayEl.append(ring, side);
  }

  function renderStack(d) {
    stackEl.innerHTML = '';
    const add = iconBtn(SVG.plus, 'Add peptide', () => openEditor(), 'col-icon');
    const h = head('Your stack', add);
    h.insertBefore(el('span', 'col-count', String(d.compounds.length)), add);
    stackEl.appendChild(h);
    if (!d.compounds.length) {
      stackEl.appendChild(el('div', 'pep-empty-line', 'No peptides yet.'));
      return;
    }
    const list = el('div', 'vial-list');
    const ds = today();
    const ordered = d.compounds.slice().sort((a, b) => (isPaused(a) - isPaused(b)));
    ordered.forEach(c => {
      const card = el('div', 'vial-card' + (isPaused(c) ? ' paused' : ''));
      card.style.setProperty('--c', colorOf(c));
      const level = c.vialMg ? (Number(c.remainingMg) || 0) / c.vialMg : 0;
      const art = el('div', 'vial-art');
      art.innerHTML = vialSvg(c, level);
      art.appendChild(el('div', 'vial-pct', Math.round(level * 100) + '%'));
      card.appendChild(art);

      const info = el('div', 'vial-info');
      const top = el('div', 'vial-top');
      top.appendChild(el('div', 'vial-name', c.name || 'Peptide'));
      const left = dosesLeft(c);
      const n = c.start ? dayDiff(c.start, ds) : 0;
      const cycleDone = c.weeks > 0 && n >= c.weeks * 7;
      if (isPaused(c)) top.appendChild(el('span', 'vial-chip', 'Paused'));
      else if (cycleDone) top.appendChild(el('span', 'vial-chip', 'Cycle done'));
      else if (c.start > ds) top.appendChild(el('span', 'vial-chip', 'Starts ' + shortDate(c.start)));
      else if (left <= 3) top.appendChild(el('span', 'vial-chip low', left ? 'Low' : 'Empty'));
      info.appendChild(top);
      info.appendChild(el('div', 'vial-sched', fmtMcg(doseMcg(c)) + ' · ' + scheduleText(c)));

      const u = units(c);
      const draw = el('div', 'vial-draw');
      draw.appendChild(syringe(u, c.syringe));
      info.appendChild(draw);

      const stats = el('div', 'vial-stats');
      const out = runOut(d, c);
      [['Draw', fmtU(u)], ['Strength', fmtNum(concOf(c.vialMg, c.waterMl)) + ' mcg/mL'], ['Left', left + (left === 1 ? ' dose' : ' doses')],
        ['Runs out', isPaused(c) ? '—' : out ? (out === ds ? 'Today' : shortDate(out)) : 'Lasts cycle']].forEach(([l, v]) => {
        const b = el('div');
        b.append(el('span', null, l), el('b', null, v));
        stats.appendChild(b);
      });
      info.appendChild(stats);

      if (c.weeks > 0) {
        const wk = Math.min(c.weeks, Math.max(1, Math.floor(Math.max(0, n) / 7) + 1));
        const cyc = el('div', 'vial-cycle');
        cyc.appendChild(el('span', null, c.start > ds ? 'Cycle starts ' + shortDate(c.start) : cycleDone ? 'Cycle complete' : 'Week ' + wk + ' of ' + c.weeks));
        const bar = el('div', 'vial-cycle-bar');
        const fill = el('i');
        fill.style.width = Math.max(0, Math.min(100, n / (c.weeks * 7) * 100)) + '%';
        bar.appendChild(fill);
        cyc.appendChild(bar);
        info.appendChild(cyc);
      }

      const acts = el('div', 'vial-actions');
      const mk = (label, fn, cls) => {
        const b = el('button', 'btn-ghost btn-xs' + (cls ? ' ' + cls : ''), label);
        b.type = 'button';
        b.addEventListener('click', fn);
        acts.appendChild(b);
      };
      if (!isPaused(c)) mk('Log now', () => openLog(c.id, new Date().getHours() < 14 ? 'AM' : 'PM'));
      mk('New vial', () => newVial(c.id));
      mk(isPaused(c) ? 'Resume' : 'Pause', () => togglePause(c.id));
      mk('Edit', () => openEditor(c.id));
      info.appendChild(acts);
      card.appendChild(info);
      list.appendChild(card);
    });
    stackEl.appendChild(list);
  }

  function renderSites(d) {
    sitesEl.innerHTML = '';
    sitesEl.appendChild(head('Site rotation'));
    const next = suggestSite(d);
    const last = siteLastUsed(d);
    sitesEl.appendChild(bodyMap(d, { suggested: d.logs.length ? next : null }));
    const legend = el('div', 'bm-legend');
    [['s-hot', '< 24h'], ['s-warm', '1–3 days'], ['s-rest', 'Rested'], ['s-fresh', 'Unused']].forEach(([cls, label]) => {
      const item = el('span', 'bm-key ' + cls);
      item.appendChild(el('i'));
      item.appendChild(document.createTextNode(label));
      legend.appendChild(item);
    });
    sitesEl.appendChild(legend);
    if (d.logs.length) {
      const s = siteById(next);
      const tip = el('div', 'bm-next');
      tip.append(el('span', 'gm-eyebrow', 'Next site'), el('b', null, s.label), el('span', null, ' · ' + ago(last[next])));
      sitesEl.appendChild(tip);
    }
  }

  function renderCheckin(d) {
    checkEl.innerHTML = '';
    const ds = today();
    checkEl.appendChild(head('Daily check-in', el('span', 'col-hint', 'How do you feel?')));
    const cur = d.checkins[ds] || {};
    [['energy', 'Energy'], ['sleep', 'Sleep'], ['recovery', 'Recovery'], ['mood', 'Mood']].forEach(([k, label]) => {
      const row = el('div', 'ci-row');
      row.appendChild(el('span', 'ci-label', label));
      const scale = el('div', 'ci-scale');
      for (let v = 1; v <= 5; v++) {
        const b = el('button', 'ci-step' + (cur[k] >= v ? ' on' : ''));
        b.type = 'button';
        b.title = label + ' ' + v + '/5';
        b.setAttribute('aria-label', label + ' ' + v + ' of 5');
        b.addEventListener('click', () => commit(dd => {
          const c = dd.checkins[ds] = dd.checkins[ds] || {};
          c[k] = c[k] === v ? 0 : v;
        }));
        scale.appendChild(b);
      }
      row.appendChild(scale);
      // Last 14 days at a glance
      const spark = el('div', 'ci-spark');
      for (let i = 13; i >= 0; i--) {
        const day = shiftDate(ds, -i);
        const v = (d.checkins[day] || {})[k] || 0;
        const bar = el('i');
        bar.style.height = (v ? 4 + v * 3.2 : 2) + 'px';
        if (!v) bar.classList.add('none');
        bar.title = shortDate(day) + (v ? ': ' + v + '/5' : '');
        spark.appendChild(bar);
      }
      row.appendChild(spark);
      checkEl.appendChild(row);
    });
    const notes = el('input', 'goal-input sm ci-notes');
    notes.type = 'text';
    notes.placeholder = 'Side effects or notes for today';
    notes.value = cur.notes || '';
    let t = null;
    notes.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const dd = load();
        const c = dd.checkins[ds] = dd.checkins[ds] || {};
        c.notes = notes.value.trim();
        save(dd); // no re-render while typing
      }, 400);
    });
    checkEl.appendChild(notes);
  }

  function renderAdherence(d) {
    adhEl.innerHTML = '';
    adhEl.appendChild(head('Consistency', el('span', 'col-hint', 'Last 12 weeks')));
    const ds = today();
    // 7-day rate (today only counts what's done so far, so a pending dose isn't a miss yet)
    let s7 = 0;
    let d7 = 0;
    for (let i = 0; i < 7; i++) {
      const day = shiftDate(ds, -i);
      const k = dayCounts(d, day);
      d7 += k.done;
      s7 += i === 0 ? k.done : k.sched;
    }
    let streak = 0;
    let day = ds;
    const t0 = dayCounts(d, ds);
    if (!(t0.sched && t0.done >= t0.sched)) day = shiftDate(ds, -1);
    for (let i = 0; i < 400; i++) {
      const k = dayCounts(d, day);
      if (k.sched) {
        if (k.done >= k.sched) streak++;
        else break;
      }
      day = shiftDate(day, -1);
      if (d.compounds.every(c => !c.start || day < c.start)) break;
    }
    const stats = el('div', 'adh-stats');
    [['7-day', s7 ? Math.round(d7 / s7 * 100) + '%' : '—'], ['Streak', streak + (streak === 1 ? ' day' : ' days')], ['Logged', String(d.logs.length)]].forEach(([l, v]) => {
      const b = el('div');
      b.append(el('b', null, v), el('span', null, l));
      stats.appendChild(b);
    });
    adhEl.appendChild(stats);

    const wrap = el('div', 'adh-wrap');
    const dows = el('div', 'adh-dows');
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((x, i) => dows.appendChild(el('span', null, i % 2 ? x : '')));
    wrap.appendChild(dows);
    const grid = el('div', 'adh-grid');
    const endDow = new Date(ds + 'T12:00:00').getDay();
    const first = shiftDate(ds, -(7 * 11 + endDow));
    for (let i = 0; i < 84; i++) {
      const day2 = shiftDate(first, i);
      const cell = el('i');
      if (day2 > ds) cell.className = 'future';
      else {
        const k = dayCounts(d, day2);
        if (!k.sched) cell.className = k.done ? 'lv4' : 'off';
        else {
          const r = k.done / k.sched;
          cell.className = r >= 1 ? 'lv4' : r >= 0.66 ? 'lv3' : r >= 0.33 ? 'lv2' : r > 0 ? 'lv1' : (day2 === ds ? 'off' : 'miss');
        }
        cell.title = shortDate(day2) + (k.sched ? ' · ' + k.done + '/' + k.sched + ' doses' : k.done ? ' · ' + k.done + ' logged' : ' · nothing scheduled');
        if (day2 === ds) cell.classList.add('today');
      }
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    adhEl.appendChild(wrap);
  }

  function renderLog(d) {
    logEl.innerHTML = '';
    logEl.appendChild(head('Recent doses', el('span', 'col-count', String(d.logs.length))));
    const byId = new Map(d.compounds.map(c => [c.id, c]));
    const recent = d.logs.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    if (!recent.length) {
      logEl.appendChild(el('div', 'pep-empty-line', 'Doses you log show up here.'));
      return;
    }
    const list = el('div', 'plog');
    recent.forEach(l => {
      const c = byId.get(l.cid);
      const row = el('div', 'plog-row');
      const dot = el('i', 'plog-dot');
      dot.style.background = c ? colorOf(c) : '#888';
      const main = el('button', 'plog-main');
      main.type = 'button';
      main.append(el('span', 'plog-name', c ? c.name : 'Removed peptide'),
        el('span', 'plog-sub', fmtMcg(l.doseMcg) + ' · ' + fmtU(l.units || 0) + ' · ' + (siteById(l.site) ? siteById(l.site).label : '—') + (l.note ? ' · ' + l.note : '')));
      if (c) main.addEventListener('click', () => openLog(c.id, l.slot, l.id));
      row.append(dot, main, el('span', 'plog-when', whenText(l)));
      row.appendChild(iconBtn(SVG.trash, 'Remove this dose', () => removeLog(l.id), 'plog-del'));
      list.appendChild(row);
    });
    logEl.appendChild(list);
  }

  function render() {
    const d = load();
    const ds = today();
    $('pepDate').textContent = new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    renderToday(d);
    renderStack(d);
    renderSites(d);
    renderCheckin(d);
    renderAdherence(d);
    renderLog(d);
  }

  ['addPeptideBtn', 'addPeptideBtnMobile'].forEach(id => $(id).addEventListener('click', () => openEditor()));
  ['pepCalcBtn', 'pepCalcBtnMobile'].forEach(id => $(id).addEventListener('click', openCalc));

  return {
    render, load, openEditor, openCalc,
    units: c => units(c),
    dayCounts: ds => { const d = load(); return Object.assign(dayCounts(d, ds), { any: d.compounds.length > 0, checkin: d.checkins[ds] || null }); }
  };
})();

