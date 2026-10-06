// Training: weekly split, workouts, weight, strength progression.
/* ================= Training ================= */
const Gym = (() => {
  // v2: weeks start on Sunday (days[0] = Sunday) and every template is home equipment only.
  const SPLIT_KEY = 'gym_split_v2';
  const LOG_KEY = 'gym_log_v1';
  const WEIGHT_KEY = 'weight_log_v1';
  const SETTINGS_KEY = 'gym_settings_v1';
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const KG_PER_LB = 0.45359237;
  // Equipment: resistance bands + one adjustable dumbbell that tops out at 25 lb.
  const MAX_DUMBBELL_KG = 25 * KG_PER_LB;
  const LINE = '#7AA2F7';
  const SURFACE = '#1c1d20';
  const $ = id => document.getElementById(id);

  // Home workouts: resistance bands (door anchor), bodyweight, and one adjustable 25 lb dumbbell.
  // "DB" = dumbbell. With a single dumbbell, do one side at a time ("each").
  const TEMPLATES = {
    push: ['Push', [
      ['Push-up (band-resisted when easy)', '4 × 8–15'],
      ['DB floor press, one arm', '3 × 10–12 each'],
      ['Band chest fly', '3 × 12–15'],
      ['Pike push-up', '3 × 6–10'],
      ['Band triceps pushdown', '3 × 12–15'],
      ['DB overhead triceps extension', '3 × 10–12']
    ]],
    pull: ['Pull', [
      ['DB one-arm row', '4 × 8–12 each'],
      ['Band lat pulldown (high anchor)', '3 × 12–15'],
      ['Band seated row', '3 × 12–15'],
      ['Band face pull', '3 × 15–20'],
      ['DB hammer curl', '3 × 10–12 each'],
      ['Band biceps curl', '2 × 15–20']
    ]],
    shoulders: ['Shoulders', [
      ['DB seated shoulder press, one arm', '4 × 8–12 each'],
      ['DB lateral raise', '3 × 12–15 each'],
      ['Band lateral raise', '2 × 15–20'],
      ['Band pull-apart', '3 × 15–20'],
      ['DB front raise', '2 × 12'],
      ['DB shrug', '3 × 15 each']
    ]],
    upper: ['Upper', [
      ['Deficit push-up', '3 × max'],
      ['DB one-arm row', '3 × 10 each'],
      ['DB Arnold press, one arm', '3 × 10 each'],
      ['Band chest press', '3 × 12–15'],
      ['Band pull-apart', '3 × 20'],
      ['DB curl + band pushdown superset', '3 × 12']
    ]],
    lower: ['Lower', [
      ['DB goblet squat', '4 × 12–15'],
      ['DB Bulgarian split squat', '3 × 8–12 each'],
      ['DB single-leg Romanian deadlift', '3 × 10 each'],
      ['Band glute bridge', '3 × 15'],
      ['Band lateral walk', '3 × 15 each way'],
      ['DB single-leg calf raise', '4 × 15 each']
    ]],
    abs: ['Abs', [
      ['Dead bug', '3 × 10 each'],
      ['Plank', '3 × 45 s'],
      ['DB Russian twist', '3 × 20'],
      ['Band Pallof press', '3 × 12 each'],
      ['Lying leg raise', '3 × 12–15'],
      ['DB weighted crunch', '3 × 15']
    ]],
    full: ['Full body', [
      ['DB goblet squat', '3 × 12–15'],
      ['Push-up', '3 × max'],
      ['DB one-arm row', '3 × 10 each'],
      ['DB single-leg Romanian deadlift', '3 × 10 each'],
      ['Band face pull', '3 × 15'],
      ['Plank', '3 × 45 s']
    ]]
  };
  // Days run Sunday → Saturday.
  const PRESETS = {
    home: { label: 'Push / Pull / Shoulders / Rest / Upper / Lower / Abs', days: ['push', 'pull', 'shoulders', null, 'upper', 'lower', 'abs'] },
    ul: { label: 'Upper / Lower ×2', days: [null, 'upper', 'lower', null, 'upper', 'lower', null] },
    full: { label: 'Full body ×3', days: [null, 'full', null, 'full', null, 'full', null] }
  };

  let selectedIdx = null;
  let editing = false;
  let editingToday = false; // Today's card in edit mode (rename / reorder / remove)
  let goalEditing = false;
  let lastChartWidth = 0;

  function buildPreset(id) {
    return {
      days: PRESETS[id].days.map(k => k
        ? { name: TEMPLATES[k][0], rest: false, exercises: TEMPLATES[k][1].map(([name, sets]) => ({ id: uid(), name, sets })) }
        : { name: 'Rest', rest: true, exercises: [] })
    };
  }

  function activeDate() {
    const [y, m, d] = getActiveDateString().split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dowIdx = d => d.getDay(); // Sunday = 0
  function weekDates() {
    const today = getActiveDateString();
    const offset = dowIdx(activeDate());
    return DOW.map((_, i) => shiftDate(today, i - offset));
  }

  function getSplit() {
    let split = storeGet(SPLIT_KEY);
    if (!split || !Array.isArray(split.days) || split.days.length !== 7) {
      split = buildPreset('home');
      storeSet(SPLIT_KEY, split);
    }
    return split;
  }
  function saveSplit(split) { storeSet(SPLIT_KEY, split); }

  const getLogAll = () => storeGet(LOG_KEY) || {};
  const dayLog = (all, ds) => all[ds] || { done: [], manual: false, complete: false };
  function isComplete(dl, day) {
    if (dl.manual) return true;
    return !!day && !day.rest && day.exercises.length > 0 && day.exercises.every(ex => dl.done.includes(ex.id));
  }
  function saveTodayLog(dl) {
    const all = getLogAll();
    const day = getSplit().days[dowIdx(activeDate())];
    dl.complete = isComplete(dl, day);
    all[getActiveDateString()] = dl;
    storeSet(LOG_KEY, all);
  }

  /* ----- Weekly progress ----- */
  function renderWeek() {
    const split = getSplit();
    const all = getLogAll();
    const today = getActiveDateString();
    let done = 0;
    let planned = 0;
    const bar = $('weekBar');
    bar.innerHTML = '';
    weekDates().forEach((ds, i) => {
      const day = split.days[i];
      const dl = dayLog(all, ds);
      const complete = ds === today ? isComplete(dl, day) : !!dl.complete;
      if (!day.rest) planned++;
      if (complete) done++;
      const cell = el('div', 'week-day' + (day.rest ? ' rest' : '') + (complete ? ' done' : '') + (ds === today ? ' today' : ''));
      cell.title = DOW[i] + ' · ' + (day.rest ? 'Rest' : day.name) + (complete ? ' · done ✓' : '');
      cell.append(el('div', 'week-seg'), el('div', 'week-label', DOW[i]));
      bar.appendChild(cell);
    });
    $('weekDone').textContent = done;
    $('weekPlanned').textContent = planned;
    $('weekPct').textContent = (planned ? Math.min(100, Math.round(done / planned * 100)) : 0) + '%';
    document.querySelector('.week-card').classList.toggle('all-done', planned > 0 && done >= planned);
  }

  /* ----- Today's workout ----- */
  function renderWorkout() {
    const split = getSplit();
    const day = split.days[dowIdx(activeDate())];
    const dl = dayLog(getLogAll(), getActiveDateString());
    const total = day.rest ? 0 : day.exercises.length;
    const doneCount = day.rest ? 0 : day.exercises.filter(ex => dl.done.includes(ex.id)).length;
    const complete = isComplete(dl, day);

    $('workoutTitle').textContent = 'Today · ' + (day.rest ? 'Rest day' : day.name);
    $('workoutCount').textContent = doneCount + '/' + total;
    $('workoutBar').style.width = (total ? doneCount / total * 100 : (complete ? 100 : 0)) + '%';

    const list = $('workoutList');
    list.innerHTML = '';
    const rest = $('restNote');
    rest.hidden = !day.rest;
    if (day.rest) {
      rest.innerHTML = '';
      rest.append(document.createTextNode('Rest day — recover and eat well.'),
        el('small', null, 'Trained anyway? Log it as a bonus workout below.'));
    }
    $('workoutAdd').hidden = day.rest;
    const editBtn = $('workoutEditBtn');
    editBtn.hidden = day.rest;
    if (day.rest) editingToday = false;
    editBtn.textContent = editingToday ? 'Done' : 'Edit';
    editBtn.classList.toggle('active', editingToday);
    $('workoutCard').classList.toggle('editing', editingToday);

    if (editingToday) {
      const li = el('li', 'ex-editor-li');
      li.appendChild(exerciseEditor(dowIdx(activeDate())));
      list.appendChild(li);
    } else if (!day.rest && !total) list.appendChild(el('li', 'split-empty', 'No exercises yet — add one below.'));

    if (!day.rest && !editingToday) {
      day.exercises.forEach(ex => {
        const isDone = dl.done.includes(ex.id);
        const li = el('li', 'ex-item' + (isDone ? ' done' : ''));
        li.appendChild(makeCheckbox(isDone, checked => toggleExercise(ex.id, checked)));
        li.appendChild(el('span', 'ex-name', ex.name));
        if (recentPRs.has(ex.id)) li.appendChild(el('span', 'ex-pr', 'NEW PR'));
        const todays = sessionOn(ex.name, getActiveDateString());
        li.appendChild(todays ? el('span', 'ex-today', summarizeSets(todays.sets)) : el('span', 'ex-sets', ex.sets));
        const logBtn = el('button', 'btn-ghost btn-xs ex-log-btn', openLifts.has(ex.id) ? 'Close' : (todays ? 'Edit' : 'Log'));
        logBtn.type = 'button';
        logBtn.title = 'Log weight × reps';
        logBtn.addEventListener('click', () => {
          if (openLifts.has(ex.id)) openLifts.delete(ex.id);
          else openLifts.add(ex.id);
          renderWorkout();
        });
        li.appendChild(logBtn);
        if (openLifts.has(ex.id)) li.appendChild(buildLiftPanel(ex));
        list.appendChild(li);
      });
    }

    const btn = $('completeBtn');
    btn.textContent = complete ? '✓ Workout complete' : (day.rest ? 'Log a bonus workout' : 'Mark workout complete');
    btn.classList.toggle('is-complete', complete);
  }

  function toggleExercise(id, checked) {
    const dl = dayLog(getLogAll(), getActiveDateString());
    dl.done = dl.done.filter(x => x !== id);
    if (checked) dl.done.push(id);
    saveTodayLog(dl);
    renderWorkout();
    renderWeek();
  }

  function toggleComplete() {
    const day = getSplit().days[dowIdx(activeDate())];
    const dl = dayLog(getLogAll(), getActiveDateString());
    if (isComplete(dl, day)) {
      dl.manual = false;
      dl.done = [];
    } else if (!day.rest && day.exercises.length) {
      dl.done = day.exercises.map(ex => ex.id);
    } else {
      dl.manual = true;
    }
    saveTodayLog(dl);
    renderWorkout();
    renderWeek();
  }

  /* ----- Split ----- */
  function renderSplitChips() {
    const split = getSplit();
    const todayIdx = dowIdx(activeDate());
    if (selectedIdx == null) selectedIdx = todayIdx;
    const wrap = $('splitDays');
    wrap.innerHTML = '';
    split.days.forEach((day, i) => {
      const chip = el('button', 'split-day' + (day.rest ? ' rest' : '') + (i === todayIdx ? ' today' : '') + (i === selectedIdx ? ' selected' : ''));
      chip.type = 'button';
      chip.title = DOW[i] + ' · ' + (day.rest ? 'Rest' : day.name);
      chip.append(el('span', 'sd-dow', DOW[i]), el('span', 'sd-name', day.rest ? 'Rest' : day.name));
      chip.addEventListener('click', () => { selectedIdx = i; renderSplit(); });
      wrap.appendChild(chip);
    });
    $('splitEditBtn').textContent = editing ? 'Done' : 'Edit';
  }

  function afterSplitChange(fullBody) {
    renderSplitChips();
    if (fullBody) renderSplitBody();
    renderWorkout();
    renderWeek();
  }

  function renderSplitBody() {
    const split = getSplit();
    const day = split.days[selectedIdx];
    const body = $('splitBody');
    body.innerHTML = '';

    if (!editing) {
      if (day.rest) body.appendChild(el('div', 'split-empty', 'Rest day'));
      else if (!day.exercises.length) body.appendChild(el('div', 'split-empty', 'No exercises — tap Edit to add some.'));
      else {
        const ul = el('ul', 'ex-list');
        day.exercises.forEach(ex => {
          const li = el('li', 'ex-item');
          li.append(el('span', 'ex-name', ex.name), el('span', 'ex-sets', ex.sets));
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }
      return;
    }

    const head = el('div', 'split-edit-head');
    const nameInput = el('input', 'goal-input sm');
    nameInput.placeholder = 'Day name, e.g. Push';
    nameInput.value = day.rest ? '' : day.name;
    nameInput.disabled = day.rest;
    nameInput.addEventListener('change', () => {
      const s = getSplit();
      s.days[selectedIdx].name = nameInput.value.trim() || 'Workout';
      saveSplit(s);
      afterSplitChange(false);
    });
    const restToggle = el('label', 'rest-toggle');
    const restCb = el('input');
    restCb.type = 'checkbox';
    restCb.checked = day.rest;
    restCb.addEventListener('change', () => {
      const s = getSplit();
      const d = s.days[selectedIdx];
      d.rest = restCb.checked;
      if (!d.rest && d.name === 'Rest') d.name = 'Workout';
      saveSplit(s);
      afterSplitChange(true);
    });
    restToggle.append(restCb, document.createTextNode('Rest day'));
    head.append(nameInput, restToggle);
    body.appendChild(head);

    if (!day.rest) {
      body.appendChild(exerciseEditor(selectedIdx));

      // Copy another day's exercises into this one (e.g. reuse Push on a second push day).
      const others = split.days.map((d, i) => ({ d, i })).filter(({ d, i }) => i !== selectedIdx && !d.rest && d.exercises.length);
      if (others.length) {
        const copyRow = el('div', 'ex-copy');
        const copySel = el('select', 'goal-input sm');
        const cph = el('option', null, 'Copy exercises from…');
        cph.value = '';
        copySel.appendChild(cph);
        others.forEach(({ d, i }) => {
          const o = el('option', null, DOW[i] + ' · ' + d.name + ' (' + d.exercises.length + ')');
          o.value = String(i);
          copySel.appendChild(o);
        });
        copySel.addEventListener('change', () => {
          if (copySel.value === '') return;
          const s = getSplit();
          const from = s.days[Number(copySel.value)];
          const before = s.days[selectedIdx].exercises.slice();
          s.days[selectedIdx].exercises = before.concat(from.exercises.map(x => ({ id: uid(), name: x.name, sets: x.sets })));
          saveSplit(s);
          afterSplitChange(true);
          Toast.show('Copied ' + from.exercises.length + ' from ' + from.name, {
            undo: () => { const s2 = getSplit(); s2.days[selectedIdx].exercises = before; saveSplit(s2); afterSplitChange(true); }
          });
        });
        copyRow.appendChild(copySel);
        if (day.exercises.length) {
          const clear = el('button', 'btn-ghost btn-xs danger-text', 'Clear day');
          clear.type = 'button';
          clear.addEventListener('click', () => {
            const s = getSplit();
            const before = s.days[selectedIdx].exercises.slice();
            s.days[selectedIdx].exercises = [];
            saveSplit(s);
            afterSplitChange(true);
            Toast.show('Cleared ' + DOW[selectedIdx], {
              undo: () => { const s2 = getSplit(); s2.days[selectedIdx].exercises = before; saveSplit(s2); afterSplitChange(true); }
            });
          });
          copyRow.appendChild(clear);
        }
        body.appendChild(copyRow);
      }

      const add = el('form', 'ex-add');
      const an = el('input', 'goal-input sm');
      an.placeholder = 'Add exercise';
      const as = el('input', 'goal-input sm ex-sets-input');
      as.placeholder = '3 × 10';
      const ab = el('button', 'btn-secondary', 'Add');
      ab.type = 'submit';
      add.append(an, as, ab);
      add.addEventListener('submit', e => {
        e.preventDefault();
        if (!an.value.trim()) { an.focus(); return; }
        const s = getSplit();
        s.days[selectedIdx].exercises.push({ id: uid(), name: an.value.trim(), sets: as.value.trim() || '3 × 10' });
        saveSplit(s);
        afterSplitChange(true);
        $('splitBody').querySelector('.ex-add input').focus();
      });
      body.appendChild(add);
    }

    const presets = el('div', 'split-presets');
    presets.appendChild(el('span', 'field-label', 'Load a preset'));
    const sel = el('select', 'goal-input sm');
    const ph = el('option', null, 'Choose…');
    ph.value = '';
    sel.appendChild(ph);
    Object.entries(PRESETS).forEach(([id, p]) => {
      const o = el('option', null, p.label);
      o.value = id;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      const id = sel.value;
      if (!id) return;
      if (confirm('Replace your whole split with “' + PRESETS[id].label + '”? Today’s checkmarks will reset.')) {
        saveSplit(buildPreset(id));
        afterSplitChange(true);
      } else {
        sel.value = '';
      }
    });
    presets.appendChild(sel);
    body.appendChild(presets);
  }

  function renderSplit() {
    renderSplitChips();
    renderSplitBody();
  }

  /* ----- Editing a day's exercises (used by Today's card and the split editor) ----- */
  const ICON_UP = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg>';
  const ICON_DOWN = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 10l6 6 6-6"/></svg>';

  function moveExercise(dayIdx, id, delta) {
    const s = getSplit();
    const list = s.days[dayIdx].exercises;
    const i = list.findIndex(x => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    saveSplit(s);
    afterSplitChange(true);
  }

  function removeExercise(dayIdx, id) {
    const s = getSplit();
    const list = s.days[dayIdx].exercises;
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    const [ex] = list.splice(i, 1);
    saveSplit(s);
    afterSplitChange(true);
    Toast.show('Removed “' + ex.name + '”', {
      undo: () => {
        const s2 = getSplit();
        const l2 = s2.days[dayIdx].exercises;
        l2.splice(Math.min(i, l2.length), 0, ex);
        saveSplit(s2);
        afterSplitChange(true);
      }
    });
  }

  // Rows of: name · sets × reps · move up · move down · remove. Changes save as you go.
  function exerciseEditor(dayIdx) {
    const wrap = el('div', 'ex-editor');
    const exercises = getSplit().days[dayIdx].exercises;
    if (!exercises.length) wrap.appendChild(el('div', 'split-empty', 'No exercises yet — add one below.'));
    exercises.forEach((ex, i) => {
      const row = el('div', 'ex-edit-row');
      const n = el('input', 'goal-input sm');
      n.value = ex.name;
      n.setAttribute('aria-label', 'Exercise name');
      const sets = el('input', 'goal-input sm');
      sets.value = ex.sets;
      sets.placeholder = '3 × 10';
      sets.setAttribute('aria-label', 'Sets × reps');
      const update = () => {
        const s = getSplit();
        const target = s.days[dayIdx].exercises.find(x => x.id === ex.id);
        if (!target) return;
        target.name = n.value.trim() || target.name;
        target.sets = sets.value.trim();
        saveSplit(s);
        renderSplitChips();
        if (!editingToday || dayIdx !== dowIdx(activeDate())) renderWorkout();
      };
      n.addEventListener('change', update);
      sets.addEventListener('change', update);
      const btn = (html, title, cls, fn, disabled) => {
        const b = el('button', 'icon-btn ' + cls);
        b.type = 'button';
        b.title = title;
        b.setAttribute('aria-label', title);
        b.innerHTML = html;
        b.disabled = !!disabled;
        b.addEventListener('click', fn);
        return b;
      };
      row.append(n, sets,
        btn(ICON_UP, 'Move up', 'ex-move', () => moveExercise(dayIdx, ex.id, -1), i === 0),
        btn(ICON_DOWN, 'Move down', 'ex-move', () => moveExercise(dayIdx, ex.id, 1), i === exercises.length - 1),
        btn(SVG.trash, 'Remove ' + ex.name, 'ex-del', () => removeExercise(dayIdx, ex.id)));
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ----- Weight ----- */
  function getSettings() { return Object.assign({ unit: 'lb', goalKg: null }, storeGet(SETTINGS_KEY) || {}); }
  function saveSettings(s) { storeSet(SETTINGS_KEY, s); }
  function getWeights() {
    return (storeGet(WEIGHT_KEY) || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  const toDisplay = (kg, unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
  const fromDisplay = (v, unit) => (unit === 'lb' ? v * KG_PER_LB : v);
  const fmtW = (kg, unit) => toDisplay(kg, unit).toFixed(1);
  function fmtDelta(kgDiff, unit) {
    const d = toDisplay(kgDiff, unit);
    if (Math.abs(d) < 0.05) return '• 0.0 ' + unit;
    return (d > 0 ? '▲ +' : '▼ −') + Math.abs(d).toFixed(1) + ' ' + unit;
  }

  function renderWeight() {
    const s = getSettings();
    const w = getWeights();
    document.querySelectorAll('#unitSeg button').forEach(b => b.classList.toggle('active', b.dataset.unit === s.unit));
    $('weightUnit').textContent = s.unit;
    $('weightInput').placeholder = 'Weight (' + s.unit + ')';
    const last = w[w.length - 1];
    $('weightNow').textContent = last ? fmtW(last.kg, s.unit) : '—';

    const deltas = $('weightDeltas');
    deltas.innerHTML = '';
    if (w.length >= 2) {
      const cutoff = shiftDate(last.date, -7);
      let weekRef = null;
      w.forEach(e => { if (e.date <= cutoff) weekRef = e; });
      if (weekRef && weekRef !== w[0]) {
        deltas.appendChild(el('span', 'delta-chip', fmtDelta(last.kg - weekRef.kg, s.unit) + ' this week'));
      }
      deltas.appendChild(el('span', 'delta-chip', fmtDelta(last.kg - w[0].kg, s.unit) + ' since ' + shortDate(w[0].date)));
    }

    renderGoal();

    const recent = $('weightRecent');
    recent.innerHTML = '';
    w.slice(-6).reverse().forEach(e => {
      const idx = w.indexOf(e);
      const prev = w[idx - 1];
      const li = el('li');
      li.append(
        el('span', 'wr-date', shortDate(e.date)),
        el('span', 'wr-val', fmtW(e.kg, s.unit) + ' ' + s.unit),
        el('span', 'wr-delta', prev ? fmtDelta(e.kg - prev.kg, s.unit) : 'first entry')
      );
      const del = el('button', 'icon-btn danger', '×');
      del.type = 'button';
      del.title = 'Delete entry';
      del.addEventListener('click', () => {
        const before = storeGet(WEIGHT_KEY) || [];
        storeSet(WEIGHT_KEY, getWeights().filter(x => x.date !== e.date));
        renderWeight();
        Toast.show('Deleted weigh-in from ' + shortDate(e.date), {
          undo: () => { storeSet(WEIGHT_KEY, before); renderWeight(); }
        });
      });
      li.appendChild(del);
      recent.appendChild(li);
    });

    renderChart();
  }

  function renderGoal() {
    const s = getSettings();
    const w = getWeights();
    const wrap = $('weightGoal');
    wrap.innerHTML = '';

    if (goalEditing) {
      const input = el('input', 'goal-input sm');
      input.type = 'number';
      input.step = '0.1';
      input.min = '0';
      input.placeholder = s.unit;
      if (s.goalKg) input.value = fmtW(s.goalKg, s.unit);
      const save = el('button', 'btn-secondary', 'Save');
      save.type = 'button';
      const commit = () => {
        const v = toNum(input.value);
        const next = getSettings();
        next.goalKg = v ? fromDisplay(v, next.unit) : null;
        saveSettings(next);
        goalEditing = false;
        renderWeight();
      };
      save.addEventListener('click', commit);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { goalEditing = false; renderGoal(); }
      });
      wrap.append(el('span', null, 'Goal'), input, save);
      input.focus();
      return;
    }

    const link = el('button', 'link');
    link.type = 'button';
    link.addEventListener('click', () => { goalEditing = true; renderGoal(); });
    if (s.goalKg) {
      const last = w[w.length - 1];
      let text = 'Goal ' + fmtW(s.goalKg, s.unit) + ' ' + s.unit;
      if (last) {
        const losing = w[0].kg >= s.goalKg;
        const reached = losing ? last.kg <= s.goalKg : last.kg >= s.goalKg;
        text += reached ? ' · reached ✓' : ' · ' + Math.abs(toDisplay(last.kg - s.goalKg, s.unit)).toFixed(1) + ' ' + s.unit + ' to go';
      }
      wrap.appendChild(el('span', null, text));
      link.textContent = 'Edit';
    } else {
      link.textContent = 'Set a goal weight';
    }
    wrap.appendChild(link);
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function renderChart() {
    const wrap = $('weightChart');
    const W = wrap.clientWidth;
    if (!W) return;
    lastChartWidth = W;
    const s = getSettings();
    const all = getWeights();
    wrap.innerHTML = '';

    if (all.length < 2) {
      wrap.appendChild(el('div', 'wchart-empty', all.length
        ? 'Log one more weigh-in to start your trend line.'
        : 'Log your first weigh-in below to start tracking.'));
      return;
    }

    let pts = all.filter(e => e.date >= shiftDate(getActiveDateString(), -90));
    if (pts.length < 2) pts = all.slice(-2);

    const H = wrap.clientHeight || 170;
    const pad = { l: 40, r: 12, t: 12, b: 22 };
    const dayMs = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
    const xs = pts.map(p => dayMs(p.date));
    const ys = pts.map(p => toDisplay(p.kg, s.unit));
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    const goal = s.goalKg ? toDisplay(s.goalKg, s.unit) : null;
    const window_ = Math.max(hi - lo, s.unit === 'lb' ? 4 : 2);
    const showGoal = goal != null && goal >= lo - window_ && goal <= hi + window_;
    if (showGoal) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
    const span = Math.max(hi - lo, s.unit === 'lb' ? 2 : 1);
    const mid = (hi + lo) / 2;
    lo = mid - span * 0.65;
    hi = mid + span * 0.65;

    const X = t => pad.l + (t - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1) * (W - pad.l - pad.r);
    const Y = v => pad.t + (hi - v) / (hi - lo) * (H - pad.t - pad.b);
    const bottom = H - pad.b;

    const step = niceStep((hi - lo) / 3);
    let grid = '';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const y = Y(v).toFixed(1);
      grid += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
      grid += '<text x="' + (pad.l - 8) + '" y="' + y + '" dy="0.32em" text-anchor="end" fill="#8A8D95" font-size="10" font-family="ui-monospace, Menlo, Consolas, monospace">' + (step < 1 ? v.toFixed(1) : Math.round(v)) + '</text>';
    }

    const linePath = pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(ys[i]).toFixed(1)).join(' ');
    const areaPath = linePath + ' L' + X(xs[xs.length - 1]).toFixed(1) + ' ' + bottom + ' L' + X(xs[0]).toFixed(1) + ' ' + bottom + ' Z';
    const lastX = X(xs[xs.length - 1]);
    const lastY = Y(ys[ys.length - 1]);

    let goalLine = '';
    if (showGoal) {
      const gy = Y(goal).toFixed(1);
      goalLine = '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="rgba(255,255,255,0.35)" stroke-dasharray="4 4" stroke-width="1"/>' +
        '<text x="' + (W - pad.r) + '" y="' + gy + '" dy="-5" text-anchor="end" fill="#8A8D95" font-size="10">Goal</text>';
    }

    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight trend">' +
        '<defs><linearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="' + LINE + '" stop-opacity="0.22"/>' +
          '<stop offset="1" stop-color="' + LINE + '" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        grid +
        '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + bottom + '" y2="' + bottom + '" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>' +
        '<text x="' + pad.l + '" y="' + (H - 6) + '" fill="#8A8D95" font-size="10">' + shortDate(pts[0].date) + '</text>' +
        '<text x="' + (W - pad.r) + '" y="' + (H - 6) + '" text-anchor="end" fill="#8A8D95" font-size="10">' + shortDate(pts[pts.length - 1].date) + '</text>' +
        goalLine +
        '<path d="' + areaPath + '" fill="url(#wArea)"/>' +
        '<path d="' + linePath + '" fill="none" stroke="' + LINE + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="4" fill="' + LINE + '" stroke="' + SURFACE + '" stroke-width="2"/>' +
        '<line class="wx" y1="' + pad.t + '" y2="' + bottom + '" stroke="rgba(255,255,255,0.28)" stroke-width="1" visibility="hidden"/>' +
        '<circle class="wd" r="5" fill="' + LINE + '" stroke="' + SURFACE + '" stroke-width="2" visibility="hidden"/>' +
        '<rect class="whit" x="' + pad.l + '" y="0" width="' + (W - pad.l - pad.r) + '" height="' + H + '" fill="transparent"/>' +
      '</svg>';

    const tip = el('div', 'chart-tip');
    wrap.appendChild(tip);
    const svg = wrap.querySelector('svg');
    const cross = svg.querySelector('.wx');
    const dot = svg.querySelector('.wd');
    const hit = svg.querySelector('.whit');

    hit.addEventListener('pointermove', e => {
      const mx = e.clientX - svg.getBoundingClientRect().left;
      let best = 0;
      xs.forEach((t, i) => { if (Math.abs(X(t) - mx) < Math.abs(X(xs[best]) - mx)) best = i; });
      const px = X(xs[best]);
      const py = Y(ys[best]);
      cross.setAttribute('x1', px);
      cross.setAttribute('x2', px);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', px);
      dot.setAttribute('cy', py);
      dot.setAttribute('visibility', 'visible');
      tip.innerHTML = '';
      tip.append(el('span', null, shortDate(pts[best].date)), el('b', null, ys[best].toFixed(1) + ' ' + s.unit));
      tip.style.left = Math.min(Math.max(px, 55), W - 55) + 'px';
      tip.style.top = Math.max(0, py - 44) + 'px';
      tip.style.opacity = '1';
    });
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      tip.style.opacity = '0';
    });
  }

  /* ----- Strength progression ----- */
  // History is keyed by exercise name, so it survives split edits and presets.
  const LIFTS_KEY = 'gym_lifts_v1';
  const openLifts = new Set();
  const recentPRs = new Set();
  let strengthLift = null;
  let lastLiftChartWidth = 0;

  const liftKey = name => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const getLifts = () => storeGet(LIFTS_KEY) || {};
  const e1rm = (kg, reps) => (reps <= 1 ? kg : kg * (1 + reps / 30)); // Epley estimate
  const unitNow = () => getSettings().unit;
  const wDisp = kg => String(round1(toDisplay(kg, unitNow())));

  function sessionsFor(name) {
    const entry = getLifts()[liftKey(name)];
    return entry ? entry.sessions.slice().sort((a, b) => a.date.localeCompare(b.date)) : [];
  }
  const sessionOn = (name, date) => sessionsFor(name).find(s => s.date === date) || null;

  function bestSet(sets) {
    return sets.reduce((best, s) => (!best || e1rm(s.kg, s.reps) > e1rm(best.kg, best.reps) ? s : best), null);
  }

  function summarizeSets(sets) {
    if (!sets.length) return '';
    const sameW = sets.every(s => s.kg === sets[0].kg);
    if (sameW) return (sets[0].kg ? wDisp(sets[0].kg) + ' × ' : '') + sets.map(s => s.reps).join(', ');
    return sets.map(s => (s.kg ? wDisp(s.kg) + '×' : '') + s.reps).join(', ');
  }

  // "Beat last time": one more rep on the top set, or add weight once it reaches 12 reps.
  function nextTarget(sets) {
    const top = sets.reduce((a, s) => (!a || s.kg > a.kg || (s.kg === a.kg && s.reps > a.reps) ? s : a), null);
    if (!top) return null;
    if (!top.kg) return { kg: 0, reps: top.reps + 1 };
    if (top.reps >= 12) {
      const step = unitNow() === 'lb' ? fromDisplay(5, 'lb') : 2.5;
      // The dumbbell maxes out at 25 lb: past that, keep progressing with reps (or a slower tempo).
      if (top.kg + step <= MAX_DUMBBELL_KG + 0.01) return { kg: top.kg + step, reps: 8 };
    }
    return { kg: top.kg, reps: top.reps + 1 };
  }

  function defaultSetCount(ex) {
    const m = String(ex.sets || '').match(/^\s*(\d+)/);
    return m ? Math.min(8, Math.max(1, +m[1])) : 3;
  }

  function buildLiftPanel(ex) {
    const today = getActiveDateString();
    const unit = unitNow();
    const history = sessionsFor(ex.name);
    const todays = history.find(s => s.date === today);
    const previous = history.filter(s => s.date < today);
    const last = previous[previous.length - 1];
    const allSets = previous.flatMap(s => s.sets.map(x => Object.assign({ date: s.date }, x)));
    const pr = bestSet(allSets);

    const panel = el('div', 'lift-panel');
    const meta = el('div', 'lift-meta');
    if (last) {
      meta.append(document.createTextNode('Last (' + shortDate(last.date) + '): '), el('b', null, summarizeSets(last.sets)));
      if (pr) meta.append(document.createTextNode(' · PR '), el('b', null, (pr.kg ? wDisp(pr.kg) + ' × ' : '') + pr.reps));
      const t = nextTarget(last.sets);
      if (t) meta.append(document.createTextNode(' · '), el('span', 'target', 'Next: ' + (t.kg ? wDisp(t.kg) + ' ' + unit + ' × ' : '') + t.reps));
    } else {
      meta.textContent = 'First time logging this lift — enter what you did. Leave weight at 0 for bodyweight moves.';
    }
    panel.appendChild(meta);

    const rows = el('div');
    const seed = todays ? todays.sets : last ? last.sets : Array.from({ length: defaultSetCount(ex) }, () => ({ kg: 0, reps: 0 }));
    const addRow = (s, i) => {
      const row = el('div', 'set-row');
      row.appendChild(el('span', 'set-no', 'Set ' + (i + 1)));
      const w = el('input', 'goal-input sm');
      w.type = 'number';
      w.step = 'any';
      w.min = '0';
      w.inputMode = 'decimal';
      w.placeholder = unit;
      w.setAttribute('aria-label', 'Weight (' + unit + ')');
      if (s.kg) w.value = round1(toDisplay(s.kg, unit));
      const r = el('input', 'goal-input sm');
      r.type = 'number';
      r.step = '1';
      r.min = '0';
      r.inputMode = 'numeric';
      r.placeholder = 'reps';
      r.setAttribute('aria-label', 'Reps');
      if (s.reps) r.value = s.reps;
      const del = el('button', 'icon-btn danger', '×');
      del.type = 'button';
      del.title = 'Remove set';
      del.addEventListener('click', () => {
        row.remove();
        [...rows.children].forEach((rw, j) => { rw.firstChild.textContent = 'Set ' + (j + 1); });
      });
      row.append(w, el('span', 'x', '×'), r, del);
      rows.appendChild(row);
    };
    seed.forEach(addRow);
    panel.appendChild(rows);

    const actions = el('div', 'form-actions');
    const addSet = el('button', 'btn-secondary', '+ Set');
    addSet.type = 'button';
    addSet.addEventListener('click', () => {
      const lastRow = rows.lastElementChild;
      const prevW = lastRow ? parseFloat(lastRow.children[1].value) || 0 : 0;
      addRow({ kg: fromDisplay(prevW, unit), reps: 0 }, rows.children.length);
      rows.lastElementChild.children[3].focus();
    });
    const saveBtn = el('button', 'btn-primary', 'Save sets');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', () => {
      const sets = [...rows.children].map(rw => ({
        kg: Math.round(fromDisplay(parseFloat(rw.children[1].value) || 0, unit) * 1000) / 1000,
        reps: Math.max(0, Math.round(parseFloat(rw.children[3].value) || 0))
      })).filter(s => s.reps > 0);
      saveSession(ex, sets);
    });
    actions.append(saveBtn, addSet);
    if (todays) {
      const clear = el('button', 'btn-ghost btn-xs', 'Clear today');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        const before = getLifts();
        saveSession(ex, []);
        Toast.show('Cleared today’s ' + ex.name + ' sets', {
          undo: () => { storeSet(LIFTS_KEY, before); renderWorkout(); renderStrength(); }
        });
      });
      actions.appendChild(clear);
    }
    panel.appendChild(actions);
    return panel;
  }

  function saveSession(ex, sets) {
    const today = getActiveDateString();
    const lifts = getLifts();
    const key = liftKey(ex.name);
    const entry = lifts[key] || { name: ex.name, sessions: [] };
    const before = bestSet(entry.sessions.filter(s => s.date !== today).flatMap(s => s.sets));
    entry.sessions = entry.sessions.filter(s => s.date !== today);
    if (sets.length) entry.sessions.push({ date: today, sets });
    entry.name = ex.name;
    lifts[key] = entry;
    if (!entry.sessions.length) delete lifts[key];
    storeSet(LIFTS_KEY, lifts);

    const now = bestSet(sets);
    recentPRs.delete(ex.id);
    if (before && now && e1rm(now.kg, now.reps) > e1rm(before.kg, before.reps) + 0.01) recentPRs.add(ex.id);
    openLifts.delete(ex.id);
    strengthLift = key;
    if (sets.length) toggleExercise(ex.id, true);
    else renderWorkout();
    renderStrength();
    if (sets.length) Toast.show(ex.name + ' saved' + (recentPRs.has(ex.id) ? ' · New PR!' : ''));
  }

  function renderStrength() {
    const lifts = getLifts();
    const unit = unitNow();
    const keys = Object.keys(lifts).filter(k => lifts[k].sessions.length);
    const select = $('liftSelect');
    const hero = $('liftHero');
    const chart = $('liftChart');
    const prList = $('prList');
    select.innerHTML = '';
    prList.innerHTML = '';
    if (!keys.length) {
      select.hidden = true;
      hero.innerHTML = '';
      chart.innerHTML = '';
      chart.appendChild(el('div', 'wchart-empty', 'Tap “Log” on an exercise in Today’s workout to record weight × reps. Your PRs and strength trend show up here.'));
      return;
    }
    select.hidden = false;
    const lastDate = k => lifts[k].sessions.reduce((m, s) => (s.date > m ? s.date : m), '');
    keys.sort((a, b) => lastDate(b).localeCompare(lastDate(a)));
    if (!strengthLift || !lifts[strengthLift]) strengthLift = keys[0];
    keys.forEach(k => {
      const o = el('option', null, lifts[k].name);
      o.value = k;
      select.appendChild(o);
    });
    select.value = strengthLift;

    // PR list
    keys.forEach(k => {
      const all = lifts[k].sessions.flatMap(s => s.sets);
      const best = bestSet(all);
      const li = el('li', k === strengthLift ? 'active' : '');
      li.append(
        el('span', 'pr-name', lifts[k].name),
        el('span', 'pr-set', (best.kg ? wDisp(best.kg) + ' × ' : '') + best.reps),
        el('span', 'pr-e1', best.kg ? '≈' + Math.round(toDisplay(e1rm(best.kg, best.reps), unit)) + ' 1RM' : '')
      );
      li.addEventListener('click', () => { strengthLift = k; renderStrength(); });
      prList.appendChild(li);
    });

    // Selected lift: best estimated 1-rep max per session.
    const sessions = lifts[strengthLift].sessions.slice().sort((a, b) => a.date.localeCompare(b.date));
    const bodyweight = sessions.every(s => s.sets.every(x => !x.kg));
    const points = sessions.map(s => {
      const b = bestSet(s.sets);
      return { date: s.date, v: bodyweight ? Math.max(...s.sets.map(x => x.reps)) : toDisplay(e1rm(b.kg, b.reps), unit), set: b };
    });
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const bestPt = points.reduce((a, p) => (p.v > a.v ? p : a), points[0]);
    hero.innerHTML = '';
    const big = el('span', 'big', String(Math.round(lastPt.v)));
    big.appendChild(el('span', 'unit', bodyweight ? 'reps' : unit + ' est. 1RM'));
    hero.appendChild(big);
    const parts = ['Best ' + (bestPt.set.kg ? wDisp(bestPt.set.kg) + ' × ' : '') + bestPt.set.reps + ' on ' + shortDate(bestPt.date)];
    if (points.length > 1 && firstPt.v) {
      const pct = (lastPt.v - firstPt.v) / firstPt.v * 100;
      parts.push((pct >= 0 ? '▲ +' : '▼ ') + pct.toFixed(1) + '% since ' + shortDate(firstPt.date));
    }
    parts.push(sessions.length + ' session' + (sessions.length === 1 ? '' : 's'));
    hero.appendChild(el('span', 'sub', parts.join(' · ')));
    drawLiftChart(points, bodyweight ? 'reps' : unit);
  }

  function drawLiftChart(points, unitLabel) {
    const wrap = $('liftChart');
    const W = wrap.clientWidth;
    if (!W) return;
    lastLiftChartWidth = W;
    wrap.innerHTML = '';
    if (points.length < 2) {
      wrap.appendChild(el('div', 'wchart-empty', 'Log this lift on another day to see your trend.'));
      return;
    }
    const H = wrap.clientHeight || 170;
    const pad = { l: 40, r: 12, t: 12, b: 22 };
    const dms = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
    const xs = points.map(p => dms(p.date));
    const ys = points.map(p => p.v);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    const span = Math.max(hi - lo, 4);
    const mid = (hi + lo) / 2;
    lo = mid - span * 0.65;
    hi = mid + span * 0.65;
    const X = t => pad.l + (t - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1) * (W - pad.l - pad.r);
    const Y = v => pad.t + (hi - v) / (hi - lo) * (H - pad.t - pad.b);
    const bottom = H - pad.b;
    const step = niceStep((hi - lo) / 3);
    let grid = '';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const y = Y(v).toFixed(1);
      grid += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,0.06)"/>' +
        '<text x="' + (pad.l - 8) + '" y="' + y + '" dy="0.32em" text-anchor="end" fill="#8A8D95" font-size="10" font-family="ui-monospace, Menlo, Consolas, monospace">' + Math.round(v) + '</text>';
    }
    const path = points.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(ys[i]).toFixed(1)).join(' ');
    const dots = points.map((p, i) => '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(ys[i]).toFixed(1) + '" r="3" fill="' + LINE + '" stroke="' + SURFACE + '" stroke-width="2"/>').join('');
    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Strength trend">' + grid +
      '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + bottom + '" y2="' + bottom + '" stroke="rgba(255,255,255,0.12)"/>' +
      '<text x="' + pad.l + '" y="' + (H - 6) + '" fill="#8A8D95" font-size="10">' + shortDate(points[0].date) + '</text>' +
      '<text x="' + (W - pad.r) + '" y="' + (H - 6) + '" text-anchor="end" fill="#8A8D95" font-size="10">' + shortDate(points[points.length - 1].date) + '</text>' +
      '<path d="' + path + '" fill="none" stroke="' + LINE + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots +
      '<line class="wx" y1="' + pad.t + '" y2="' + bottom + '" stroke="rgba(255,255,255,0.28)" visibility="hidden"/>' +
      '<rect class="whit" x="' + pad.l + '" y="0" width="' + (W - pad.l - pad.r) + '" height="' + H + '" fill="transparent"/></svg>';
    const tip = el('div', 'chart-tip');
    wrap.appendChild(tip);
    const svg = wrap.querySelector('svg');
    const cross = svg.querySelector('.wx');
    svg.querySelector('.whit').addEventListener('pointermove', e => {
      const mx = e.clientX - svg.getBoundingClientRect().left;
      let best = 0;
      xs.forEach((t, i) => { if (Math.abs(X(t) - mx) < Math.abs(X(xs[best]) - mx)) best = i; });
      const px = X(xs[best]);
      cross.setAttribute('x1', px);
      cross.setAttribute('x2', px);
      cross.setAttribute('visibility', 'visible');
      const p = points[best];
      tip.innerHTML = '';
      tip.append(el('span', null, shortDate(p.date)),
        el('b', null, Math.round(p.v) + ' ' + unitLabel + (p.set.kg ? ' · ' + wDisp(p.set.kg) + '×' + p.set.reps : '')));
      tip.style.left = Math.min(Math.max(px, 70), W - 70) + 'px';
      tip.style.top = Math.max(0, Y(ys[best]) - 44) + 'px';
      tip.style.opacity = '1';
    });
    svg.querySelector('.whit').addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      tip.style.opacity = '0';
    });
  }

  function init() {
    $('weightDate').value = getActiveDateString();
    $('liftSelect').addEventListener('change', e => { strengthLift = e.target.value; renderStrength(); });
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        const w = $('liftChart').clientWidth;
        if (w && w !== lastLiftChartWidth) renderStrength();
      }).observe($('liftChart'));
    }
    $('weightForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = toNum($('weightInput').value);
      if (!v) { $('weightInput').focus(); return; }
      const date = $('weightDate').value || getActiveDateString();
      const unit = getSettings().unit;
      const list = getWeights().filter(x => x.date !== date);
      list.push({ date, kg: Math.round(fromDisplay(v, unit) * 1000) / 1000 });
      storeSet(WEIGHT_KEY, list);
      $('weightInput').value = '';
      renderWeight();
      Toast.show('Logged ' + v + ' ' + unit + ' for ' + shortDate(date));
    });
    document.querySelectorAll('#unitSeg button').forEach(b => {
      b.addEventListener('click', () => {
        const s = getSettings();
        s.unit = b.dataset.unit;
        saveSettings(s);
        renderWeight();
        renderWorkout();
        renderStrength();
      });
    });
    $('completeBtn').addEventListener('click', toggleComplete);
    $('workoutAdd').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      const name = form.elements.namedItem('name').value.trim();
      if (!name) return;
      const s = getSplit();
      s.days[dowIdx(activeDate())].exercises.push({
        id: uid(),
        name,
        sets: form.elements.namedItem('sets').value.trim() || '3 × 10'
      });
      saveSplit(s);
      form.reset();
      form.elements.namedItem('name').focus();
      afterSplitChange(true);
    });
    $('workoutEditBtn').addEventListener('click', () => {
      editingToday = !editingToday;
      renderWorkout();
    });
    $('splitEditBtn').addEventListener('click', () => {
      editing = !editing;
      renderSplit();
    });

    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        const w = $('weightChart').clientWidth;
        if (w && w !== lastChartWidth) renderChart();
      }).observe($('weightChart'));
    }
  }

  function render() {
    $('gymDate').textContent = formatDate(getActiveDateString());
    if (!$('weightDate').value) $('weightDate').value = getActiveDateString();
    renderWeek();
    renderWeight();
    renderWorkout();
    renderSplit();
    renderStrength();
  }

  // Used by the dashboard's Workout tab.
  function todayPlan() {
    const day = getSplit().days[dowIdx(activeDate())];
    const dl = dayLog(getLogAll(), getActiveDateString());
    return { day, done: dl.done, complete: isComplete(dl, day) };
  }

  // Any day's plan and whether it was finished (Daily review summary).
  function dayStatus(ds) {
    const day = getSplit().days[new Date(ds + 'T12:00:00').getDay()];
    const dl = dayLog(getLogAll(), ds);
    return { day, done: dl.done, complete: isComplete(dl, day) };
  }

  return { init, render, renderChart, todayPlan, dayStatus, toggleExercise };
})();

