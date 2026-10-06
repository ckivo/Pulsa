// Shopping list + meal plan (Nutrition page). Uses the recipe pieces from Nutrition.recipeKit.

/* ================= Shopping list ================= */
const ShoppingList = (() => {
  const KEY = 'shopping_list_v1';
  const $ = id => document.getElementById(id);
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const load = () => {
    const d = storeGet(KEY);
    return d && Array.isArray(d.items) ? d : { items: [] };
  };
  function save(d) {
    storeSet(KEY, d);
    render();
  }

  // items: [{ name, amount? }]; from: what it's for (recipe or plan name).
  function add(items, from) {
    const d = load();
    let added = 0;
    items.forEach(x => {
      const name = String(x.name || '').trim();
      if (!name) return;
      const amount = String(x.amount || '').trim();
      const found = d.items.find(i => norm(i.name) === norm(name));
      if (found) {
        if (found.done) { found.done = false; found.amount = amount; found.from = []; added++; }
        else if (amount && found.amount && found.amount !== amount) found.amount += ' + ' + amount;
        else if (amount && !found.amount) found.amount = amount;
        if (from && !found.from.includes(from)) found.from.push(from);
      } else {
        d.items.push({ id: uid(), name, amount, from: from ? [from] : [], done: false });
        added++;
      }
    });
    save(d);
    Toast.show(added ? 'Added ' + added + ' item' + (added === 1 ? '' : 's') + ' to your shopping list' : 'Already on your shopping list');
  }

  function render() {
    const d = load();
    const list = $('shopList');
    list.innerHTML = '';
    // Still-needed items first, checked ones at the bottom.
    const items = d.items.filter(i => !i.done).concat(d.items.filter(i => i.done));
    items.forEach(item => {
      const li = el('li', 'shop-item' + (item.done ? ' done' : ''));
      li.appendChild(makeCheckbox(item.done, checked => {
        const d2 = load();
        const it = d2.items.find(i => i.id === item.id);
        if (!it) return;
        it.done = checked;
        save(d2);
        // Bought it → it's now one of your ingredients.
        if (checked) Nutrition.recipeKit.addPantryItems(it.name);
      }));
      const text = el('div', 'shop-text');
      if (item.amount) text.appendChild(el('b', null, item.amount));
      text.appendChild(document.createTextNode(item.name));
      if (item.from.length) text.appendChild(el('span', 'shop-from', 'For ' + item.from.join(', ')));
      li.appendChild(text);
      const del = el('button', 'icon-btn danger', '×');
      del.type = 'button';
      del.title = 'Remove';
      del.addEventListener('click', () => {
        const before = load();
        save({ items: before.items.filter(i => i.id !== item.id) });
        Toast.show('Removed ' + item.name, { undo: () => save(before) });
      });
      li.appendChild(del);
      list.appendChild(li);
    });
    const open = d.items.filter(i => !i.done).length;
    $('shopCount').textContent = open;
    $('shopEmpty').hidden = d.items.length > 0;
    $('shopClearBtn').hidden = !d.items.some(i => i.done);
  }

  function init() {
    $('shopAdd').addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.elements.namedItem('item');
      const name = input.value.trim();
      if (!name) return;
      add([{ name }]);
      input.value = '';
      input.focus();
    });
    $('shopClearBtn').addEventListener('click', () => {
      const before = load();
      const n = before.items.filter(i => i.done).length;
      save({ items: before.items.filter(i => !i.done) });
      Toast.show('Cleared ' + n + ' checked item' + (n === 1 ? '' : 's'), { undo: () => save(before) });
    });
    render();
  }

  return { init, render, add };
})();

/* ================= Meal plan ================= */
const MealPlan = (() => {
  const KEY = 'meal_plan_v1';
  const $ = id => document.getElementById(id);
  const kit = () => Nutrition.recipeKit;
  // Rough share of the day's targets each meal carries, to size planned meals when only some are planned.
  const MEAL_SHARE = { Breakfast: 0.25, Lunch: 0.3, Dinner: 0.35, Snacks: 0.1 };
  let busy = false;
  const open = new Set(); // "day:meal" rows with the recipe expanded

  function load() {
    const d = storeGet(KEY) || {};
    const settings = Object.assign({ days: 5, meals: ['Lunch', 'Dinner'] }, d.settings || {});
    if (![3, 5, 7].includes(settings.days)) settings.days = 5;
    settings.meals = kit().meals.filter(m => (settings.meals || []).includes(m));
    if (!settings.meals.length) settings.meals = ['Lunch', 'Dinner'];
    return { settings, plan: d.plan || null };
  }
  function save(d) {
    storeSet(KEY, d);
    render();
  }

  function setStatus(msg, isError, spinning) {
    const s = $('planStatus');
    s.innerHTML = '';
    s.classList.toggle('error', !!isError);
    if (!msg) return;
    if (spinning) s.appendChild(el('span', 'spinner'));
    s.appendChild(document.createTextNode(msg));
  }

  function plannedTargets(meals) {
    const t = kit().targets();
    const share = meals.reduce((a, m) => a + (MEAL_SHARE[m] || 0.25), 0);
    const k = Math.min(1, share);
    return { share: k, kcal: Math.round(t.kcal * k), p: Math.round(t.p * k), c: Math.round(t.c * k), f: Math.round(t.f * k) };
  }

  function prompt(settings) {
    const start = getActiveDateString();
    const pantry = kit().pantry();
    const saved = kit().savedRecipes();
    const target = plannedTargets(settings.meals);
    const t = kit().targets();
    const lines = [
      'Plan my meals for the next ' + settings.days + ' days, starting ' + formatDate(start) + '.',
      'Meals to plan each day: ' + settings.meals.join(', ') + '.',
      'Ingredients I already have: ' + (pantry.length ? pantry.join(', ') : 'nothing listed') + '. Assume basics like salt, pepper, cooking oil and common dried spices too.',
      'Fitness goal for these meals: ' + kit().goal().brief + '.',
      'My full daily targets: ' + t.kcal + ' kcal, ' + t.p + ' g protein, ' + t.c + ' g carbs, ' + t.f + ' g fat.' +
        (target.share < 1 ? ' The planned meals should cover about ' + target.kcal + ' kcal and ' + target.p + ' g protein per day; the rest is eaten outside the plan.' : '')
    ];
    if (saved.length) {
      lines.push('Recipes I’ve saved and like — reuse any that fit by referring to them as {"saved": index}:');
      saved.forEach((r, i) => lines.push('  ' + i + ': ' + r.title + ' (' + r.kcal + ' kcal, ' + r.p + ' g P, ' + r.c + ' g C, ' + r.f + ' g F per serving; ' +
        r.ingredients.map(x => x.item).slice(0, 8).join(', ') + ')'));
    }
    lines.push(
      'Make it realistic meal prep: use at most 4 or 5 different recipes for the whole plan, each cooked once as a batch that covers several meals, and spread them so I’m not eating the same thing every meal.',
      'Use what I have first. Every new recipe must taste really good — exact amounts for every seasoning, sauce and aromatic, flavor built in layers (season or marinate, bloom spices, aromatics, balance salt / acid / sweet / heat, finish fresh), proper searing and texture — while staying macro-friendly (flavor from spices, acid and herbs, measured oil).',
      'For new recipes, write ingredient amounts for the whole batch (servings = how many planned meals it covers) and give calories and macros per serving. Mark ingredients I don’t have with have:false.',
      'shopping lists everything I need to buy for the whole plan with total amounts. prep is a short ordered batch-cooking plan (what to cook on which day, and how to store and reheat it).',
      'Reply with only a JSON object — no prose and no code fences — in this shape:',
      '{"recipes":[{"saved":0,"servings":3},{"title":"…","servings":4,"time":"35 min","serving":"1 container","kcal":520,"protein":45,"carbs":50,"fat":14,' +
        '"ingredients":[{"item":"chicken thighs","amount":"900 g","have":true}],"seasoning":[{"item":"smoked paprika","amount":"2 tsp"}],"steps":["…"],"tips":["…"]}],' +
        '"days":[{"meals":{' + settings.meals.map((m, i) => '"' + m + '":' + (i % 2)).join(',') + '}}],' +
        '"shopping":[{"item":"chicken thighs","amount":"900 g"}],"prep":["Day 1: …"],"notes":"One short sentence, or empty."}',
      '"days" has exactly ' + settings.days + ' entries, in order; each meal is the index of a recipe in "recipes". Use whole numbers.'
    );
    return lines.join('\n');
  }

  function parse(data, settings) {
    if (data.stop_reason === 'refusal') throw new Error('Claude couldn’t plan that — try different ingredients.');
    if (data.stop_reason === 'max_tokens') throw new Error('That plan came out too long — try fewer days or meals.');
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Couldn’t read the plan — try again.');
    const raw = JSON.parse(text.slice(start, end + 1));
    const saved = kit().savedRecipes();
    // Positions are kept (days refer to recipes by index); anything unusable becomes null and is skipped.
    const recipes = (Array.isArray(raw.recipes) ? raw.recipes : []).map(r => {
      if (!r || typeof r !== 'object') return null;
      if ('saved' in r) {
        return saved[r.saved] ? { recipe: saved[r.saved], batch: toNum(r.servings) || 1, saved: true } : null;
      }
      const recipe = kit().cleanRecipe(r);
      return recipe.steps.length ? { recipe, batch: recipe.servings, saved: false } : null;
    });
    if (!recipes.some(Boolean)) throw new Error('Claude didn’t return any recipes — try again.');
    const start0 = getActiveDateString();
    const days = Array.from({ length: settings.days }, (_, i) => {
      const src = (Array.isArray(raw.days) && raw.days[i] && raw.days[i].meals) || {};
      const meals = {};
      settings.meals.forEach(m => {
        const idx = Number(src[m]);
        if (Number.isInteger(idx) && recipes[idx]) meals[m] = idx;
      });
      return { date: shiftDate(start0, i), meals };
    });
    const list = (a, f) => (Array.isArray(a) ? a.map(f).filter(Boolean) : []);
    return {
      created: Date.now(),
      meals: settings.meals.slice(),
      recipes,
      days,
      shopping: list(raw.shopping, x => (x && x.item ? { name: String(x.item), amount: String(x.amount || '') } : null)),
      prep: list(raw.prep, x => (x ? String(x) : null)),
      notes: typeof raw.notes === 'string' ? raw.notes : ''
    };
  }

  async function make() {
    if (busy) return;
    const d = load();
    if (!anthropicKey()) {
      setStatus('Meal planning needs an Anthropic API key — add it in Settings.', true);
      return;
    }
    if (d.plan && !confirm('Replace your current meal plan with a new one?')) return;
    busy = true;
    $('planMakeBtn').disabled = true;
    setStatus('Planning ' + d.settings.days + ' days of ' + d.settings.meals.join(' + ').toLowerCase() + '… this can take a minute.', false, true);
    try {
      const data = await callClaude({ model: RECIPE_MODEL, messages: [{ role: 'user', content: prompt(d.settings) }] }, 'Meal plan');
      const plan = parse(data, d.settings);
      open.clear();
      save({ settings: d.settings, plan });
      setStatus(plan.notes);
    } catch (err) {
      console.warn('Meal plan failed:', err);
      setStatus(err.message || 'Something went wrong — try again.', true);
    } finally {
      busy = false;
      $('planMakeBtn').disabled = false;
    }
  }

  function renderSetup(settings, hasPlan) {
    document.querySelectorAll('#planDays button').forEach(b => b.classList.toggle('active', Number(b.dataset.days) === settings.days));
    const meals = $('planMeals');
    meals.innerHTML = '';
    kit().meals.forEach(m => {
      const lab = el('label', 'plan-meal-opt');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = settings.meals.includes(m);
      cb.addEventListener('change', () => {
        const d = load();
        const set = new Set(d.settings.meals);
        if (cb.checked) set.add(m); else set.delete(m);
        if (!set.size) { cb.checked = true; return; }
        d.settings.meals = kit().meals.filter(x => set.has(x));
        save(d);
      });
      lab.append(cb, document.createTextNode(m));
      meals.appendChild(lab);
    });
    $('planMakeBtn').textContent = hasPlan ? '↻ New plan' : '✦ Plan my meals';
  }

  function renderPlan(plan) {
    const view = $('planView');
    view.innerHTML = '';
    if (!plan) { $('planHint').textContent = 'Cook in batches, hit your macros'; return; }
    const today = getActiveDateString();
    const last = plan.days[plan.days.length - 1];
    $('planHint').textContent = last && last.date < today ? 'This plan has ended' : formatDate(plan.days[0].date) + ' → ' + formatDate(last.date);

    const target = plannedTargets(plan.meals);
    const sums = plan.days.map(day => Object.values(day.meals).reduce((a, idx) => {
      const r = plan.recipes[idx].recipe;
      a.kcal += r.kcal; a.p += r.p; a.c += r.c; a.f += r.f;
      return a;
    }, { kcal: 0, p: 0, c: 0, f: 0 }));
    const avg = sums.reduce((a, s) => a + s.kcal, 0) / (sums.length || 1);

    const summary = el('div', 'plan-summary');
    summary.appendChild(el('span', null, plan.days.length + ' days · ' + plan.recipes.filter(Boolean).length + ' recipes · ~' + fmtInt(avg) + ' kcal/day planned'));
    summary.appendChild(el('span', 'spacer'));
    if (plan.shopping.length) {
      const shop = el('button', 'btn-primary', '🛒 Add ' + plan.shopping.length + ' to shopping list');
      shop.type = 'button';
      shop.addEventListener('click', () => ShoppingList.add(plan.shopping, 'meal plan'));
      summary.appendChild(shop);
    }
    const clear = el('button', 'btn-secondary', 'Clear plan');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      const before = load();
      save({ settings: before.settings, plan: null });
      Toast.show('Meal plan cleared', { undo: () => save(before) });
    });
    summary.appendChild(clear);
    view.appendChild(summary);

    if (plan.prep.length) {
      const prep = el('div', 'plan-prep');
      prep.appendChild(el('h4', null, 'Batch prep'));
      const ol = el('ol');
      plan.prep.forEach(p => ol.appendChild(el('li', null, p)));
      prep.appendChild(ol);
      view.appendChild(prep);
    }

    const days = el('div', 'plan-days');
    plan.days.forEach((day, di) => {
      const card = el('div', 'plan-day' + (day.date === today ? ' today' : ''));
      const head = el('div', 'plan-day-head');
      head.appendChild(el('span', 'plan-day-name', (day.date === today ? 'Today · ' : '') + formatDate(day.date)));
      const s = sums[di];
      const hit = target.kcal && Math.abs(s.kcal - target.kcal) <= target.kcal * 0.1 && s.p >= target.p * 0.9;
      const total = el('span', 'plan-day-total' + (hit ? ' hit' : ''), fmtInt(s.kcal) + ' kcal · ' + Math.round(s.p) + 'g P');
      total.title = 'Planned meals vs. about ' + fmtInt(target.kcal) + ' kcal and ' + target.p + ' g protein';
      head.appendChild(total);
      card.appendChild(head);

      plan.meals.forEach(meal => {
        if (!(meal in day.meals)) return;
        const entry = plan.recipes[day.meals[meal]];
        const r = entry.recipe;
        const rowKey = di + ':' + meal;
        const row = el('div', 'plan-meal-row');
        row.appendChild(el('span', 'plan-meal-label', meal));
        const title = el('button', 'plan-meal-title', r.title);
        title.type = 'button';
        title.appendChild(el('small', null, fmtInt(r.kcal) + ' kcal · P ' + round1(r.p) + ' · C ' + round1(r.c) + ' · F ' + round1(r.f) +
          (entry.batch > 1 ? ' · batch of ' + entry.batch : '')));
        title.addEventListener('click', () => {
          if (open.has(rowKey)) open.delete(rowKey); else open.add(rowKey);
          render();
        });
        row.appendChild(title);
        const log = el('button', 'btn-ghost', 'Log');
        log.type = 'button';
        log.title = 'Log one serving to today’s ' + meal;
        log.addEventListener('click', () => kit().logRecipe(r, meal));
        row.appendChild(log);
        if (open.has(rowKey)) {
          const box = el('div', 'plan-recipe');
          if (entry.saved && entry.batch !== r.servings) {
            box.appendChild(el('div', 'plan-note', 'Your saved recipe makes ' + r.servings + ' — scale it to ' + entry.batch + ' servings for this plan.'));
          }
          box.appendChild(kit().buildRecipe(r, { meal }));
          row.appendChild(box);
        }
        card.appendChild(row);
      });
      days.appendChild(card);
    });
    view.appendChild(days);
  }

  function render() {
    const d = load();
    renderSetup(d.settings, !!d.plan);
    renderPlan(d.plan);
  }

  function init() {
    document.querySelectorAll('#planDays button').forEach(b => b.addEventListener('click', () => {
      const d = load();
      d.settings.days = Number(b.dataset.days);
      save(d);
    }));
    $('planMakeBtn').addEventListener('click', make);
    render();
  }

  return { init, render };
})();

ShoppingList.init();
MealPlan.init();
