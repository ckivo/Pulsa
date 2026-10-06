// Dashboard overview cards (Trading, Nutrition / Workout).
/* ================= Dashboard overview cards ================= */
const Overview = (() => {
  const $ = id => document.getElementById(id);

  function renderPnl() {
    const [y, m] = getActiveDateString().split('-').map(Number);
    const s = Trades.monthStats(y, m - 1);
    $('pnlMonthLabel').textContent = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });

    const net = $('pnlNet');
    net.textContent = s.hasPnl ? fmtMoney(s.net) : '$0';
    net.className = 'ov-big' + (s.hasPnl ? ' ' + signClass(s.net) : '');

    const decided = s.wins + s.losses;
    $('pnlWinRate').textContent = decided ? Math.round(s.wins / decided * 100) + '%' : '—';
    $('pnlWL').textContent = s.wins + 'W · ' + s.losses + 'L';
    $('pnlWinBar').style.width = (decided ? s.wins / decided * 100 : 0) + '%';
    $('pnlDays').textContent = s.days;
    $('pnlJournals').textContent = s.entries + (s.entries === 1 ? ' journal' : ' journals');

    const best = $('pnlBest');
    best.textContent = s.best != null ? fmtMoney(s.best) : '—';
    best.className = 'ov-mid' + (s.best != null ? ' ' + signClass(s.best) : '');

    renderPnlChart(y, m - 1, s.byDay);
  }

  // One bar per calendar day; gains rise from the baseline, losses hang below it.
  function renderPnlChart(year, month, byDay) {
    const wrap = $('pnlChart');
    const W = wrap.clientWidth;
    if (!W) return;
    const H = wrap.clientHeight || 92;
    wrap.innerHTML = '';
    if (!byDay.size) {
      wrap.appendChild(el('div', 'ov-empty', 'No P&L logged this month yet — add it in Trades.'));
      return;
    }
    const values = [...byDay.values()];
    const hasPos = values.some(v => v > 0);
    const hasNeg = values.some(v => v < 0);
    const maxAbs = Math.max(...values.map(Math.abs)) || 1;
    const zeroY = hasPos && hasNeg ? H / 2 : hasNeg ? 4 : H - 4;
    const room = hasPos && hasNeg ? H / 2 - 4 : H - 8;
    const days = new Date(year, month + 1, 0).getDate();
    const slot = W / days;
    const bw = Math.max(2, Math.min(14, slot - 3));
    let bars = '';
    for (let d = 1; d <= days; d++) {
      const ds = year + '-' + pad2(month + 1) + '-' + pad2(d);
      if (!byDay.has(ds)) continue;
      const v = byDay.get(ds);
      const h = Math.max(2, Math.abs(v) / maxAbs * room);
      const x = (d - 0.5) * slot - bw / 2;
      const yTop = v >= 0 ? zeroY - h : zeroY;
      const fill = v >= 0 ? 'var(--accent)' : 'var(--loss)';
      bars += '<rect x="' + x.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="2" fill="' + fill + '"><title>' + shortDate(ds) + ': ' + fmtMoney(v) + '</title></rect>';
    }
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily P&amp;L this month">' +
      '<line x1="0" x2="' + W + '" y1="' + zeroY + '" y2="' + zeroY + '" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>' +
      bars + '</svg>';
  }

  function renderMacros() {
    const s = Nutrition.snapshot();
    const t = s.totals;
    const g = s.targets;
    $('dashFoodCount').textContent = s.count;
    $('dashKcal').textContent = fmtInt(t.kcal);
    $('dashKcalTarget').textContent = fmtInt(g.kcal);
    const left = g.kcal - t.kcal;
    const leftEl = $('dashKcalLeft');
    leftEl.textContent = left >= 0 ? fmtInt(left) + ' kcal left' : '⚠ ' + fmtInt(-left) + ' kcal over target';
    leftEl.classList.toggle('over', left < 0);
    $('dashKcalBar').style.width = (g.kcal ? Math.min(100, t.kcal / g.kcal * 100) : 0) + '%';
    Nutrition.renderMacroRows($('dashMacros'), t, g);
  }

  // Nutrition / Workout tab on the third card (remembered per browser).
  const TAB_KEY = 'dashboard_card_tab';
  let tab = (() => { try { return Store.getItem(TAB_KEY) || 'nutrition'; } catch (e) { return 'nutrition'; } })();

  function renderWorkoutTab() {
    const wrap = $('dashWorkout');
    wrap.innerHTML = '';
    const plan = Gym.todayPlan();
    const day = plan.day;
    const total = day.rest ? 0 : day.exercises.length;
    const done = day.rest ? 0 : day.exercises.filter(ex => plan.done.includes(ex.id)).length;
    $('dashFoodCount').textContent = day.rest ? 'Rest' : done + '/' + total;

    const hero = el('div', 'ov-hero');
    hero.appendChild(el('div', 'gm-eyebrow', 'Today · ' + formatDate(getActiveDateString()).split(',')[0]));
    hero.appendChild(el('div', 'ov-big', day.rest ? 'Rest day' : day.name));
    if (!day.rest) {
      const meter = el('div', 'meter meter-lg');
      const fill = el('div', 'meter-fill meter-done');
      fill.style.width = (total ? done / total * 100 : 0) + '%';
      meter.appendChild(fill);
      hero.appendChild(meter);
      hero.appendChild(el('div', 'kcal-left', plan.complete ? 'Workout complete' : (total - done) + ' exercise' + (total - done === 1 ? '' : 's') + ' left'));
    } else {
      hero.appendChild(el('div', 'kcal-left', 'Recover, stretch, and hit your protein.'));
    }
    wrap.appendChild(hero);

    if (!day.rest) {
      const list = el('ul', 'ex-list ov-ex-list');
      day.exercises.forEach(ex => {
        const isDone = plan.done.includes(ex.id);
        const li = el('li', 'ex-item' + (isDone ? ' done' : ''));
        li.appendChild(makeCheckbox(isDone, checked => {
          Gym.toggleExercise(ex.id, checked);
          renderWorkoutTab();
        }));
        li.append(el('span', 'ex-name', ex.name), el('span', 'ex-sets', ex.sets));
        list.appendChild(li);
      });
      wrap.appendChild(list);
    }
    const open = el('button', 'col-add', 'Open Training');
    open.type = 'button';
    open.addEventListener('click', () => setPage('gym'));
    wrap.appendChild(open);
  }

  function applyTab() {
    document.querySelectorAll('[data-ovtab]').forEach(b => b.classList.toggle('active', b.dataset.ovtab === tab));
    $('dashNutrition').hidden = tab !== 'nutrition';
    $('dashWorkout').hidden = tab !== 'workout';
    const go = $('macroGo');
    go.dataset.goto = tab === 'workout' ? 'gym' : 'nutrition';
    go.title = tab === 'workout' ? 'Open Training' : 'Open Nutrition';
    if (tab === 'workout') renderWorkoutTab();
    else renderMacros();
  }

  document.querySelectorAll('[data-ovtab]').forEach(b => {
    b.addEventListener('click', () => {
      tab = b.dataset.ovtab;
      try { Store.setItem(TAB_KEY, tab); } catch (e) { /* ignore */ }
      applyTab();
    });
  });

  function render() {
    renderPnl();
    applyTab();
  }

  if (window.ResizeObserver) {
    let lastW = 0;
    new ResizeObserver(() => {
      const w = $('pnlChart').clientWidth;
      if (w && w !== lastW) { lastW = w; renderPnl(); }
    }).observe($('pnlChart'));
  }

  return { render };
})();

