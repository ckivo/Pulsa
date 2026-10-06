// Nutrition: food log, search, meal photo scan, recipe finder, liked meals.
/* ================= Nutrition ================= */
// Validated categorical palette (dark surface): protein / carbs / fat.
// Monotone theme: macro bars share the blue accent; each bar is labeled, so color isn't needed for identity.
const MACRO_COLORS = { p: '#7AA2F7', c: '#7AA2F7', f: '#7AA2F7' };

// Popular foods: [name, serving, kcal, protein g, carbs g, fat g, extra search words]
const FOOD_DB = [
  ['Chicken breast, cooked', '100 g', 165, 31, 0, 3.6, 'grilled'],
  ['Chicken thigh, cooked, skinless', '100 g', 209, 26, 0, 10.9],
  ['Ground beef 85/15, cooked', '100 g', 250, 26, 0, 15, 'hamburger mince'],
  ['Ground beef 93/7, cooked', '100 g', 182, 26, 0, 8, 'hamburger mince lean'],
  ['Ground turkey 93/7, cooked', '100 g', 176, 23, 0, 9],
  ['Sirloin steak, cooked', '100 g', 206, 29, 0, 9, 'beef'],
  ['Ribeye steak, cooked', '100 g', 291, 24, 0, 21, 'beef'],
  ['Pork chop, lean, cooked', '100 g', 196, 29, 0, 8],
  ['Bacon', '1 slice (8 g)', 43, 3, 0.1, 3.3],
  ['Salmon, cooked', '100 g', 206, 22, 0, 12, 'fish'],
  ['Tuna, canned in water', '100 g', 116, 26, 0, 0.8, 'fish'],
  ['Shrimp, cooked', '100 g', 99, 24, 0.2, 0.3, 'prawns'],
  ['Tilapia, cooked', '100 g', 128, 26, 0, 2.7, 'fish'],
  ['Egg, large', '1 egg (50 g)', 72, 6.3, 0.4, 4.8, 'eggs boiled scrambled fried'],
  ['Egg whites', '1 large white (33 g)', 17, 3.6, 0.2, 0.1],
  ['Tofu, firm', '100 g', 144, 17, 3, 9],
  ['Turkey deli slices', '2 oz (56 g)', 60, 12, 2, 0.5, 'lunch meat'],
  ['Ham slices', '2 oz (56 g)', 60, 10, 1, 2, 'deli lunch meat'],
  ['Breakfast sausage link', '1 link (25 g)', 80, 4, 0.5, 7],
  ['Hot dog', '1 frank (45 g)', 150, 5, 2, 13],
  ['Whey protein powder', '1 scoop (30 g)', 120, 24, 3, 1.5, 'protein shake'],
  ['Protein shake, ready to drink', '1 bottle (325 ml)', 160, 30, 5, 3],
  ['Protein bar', '1 bar (60 g)', 210, 20, 23, 7],
  ['Greek yogurt, nonfat plain', '170 g container', 100, 17, 6, 0.7, 'yoghurt'],
  ['Greek yogurt, 2% plain', '170 g container', 130, 17, 6, 3.5, 'yoghurt'],
  ['Cottage cheese, 2%', '1/2 cup (113 g)', 92, 12, 5, 2.5],
  ['Milk, whole', '1 cup (244 ml)', 149, 8, 12, 8],
  ['Milk, 2%', '1 cup (244 ml)', 122, 8, 12, 4.8],
  ['Milk, skim', '1 cup (244 ml)', 83, 8.3, 12, 0.2],
  ['Almond milk, unsweetened', '1 cup (240 ml)', 30, 1, 1, 2.5],
  ['Oat milk', '1 cup (240 ml)', 120, 3, 16, 5],
  ['Cheddar cheese', '1 oz (28 g)', 113, 7, 0.4, 9.3],
  ['Mozzarella, part-skim', '1 oz (28 g)', 72, 7, 0.8, 4.5],
  ['String cheese', '1 stick (28 g)', 80, 7, 1, 6],
  ['American cheese', '1 slice (21 g)', 64, 3.5, 1.5, 5],
  ['Parmesan, grated', '1 tbsp (5 g)', 21, 1.4, 0.2, 1.4],
  ['Butter', '1 tbsp (14 g)', 102, 0.1, 0, 11.5],
  ['Cream cheese', '1 tbsp (15 g)', 51, 0.9, 0.8, 5],
  ['Sour cream', '2 tbsp (24 g)', 47, 0.6, 1.1, 4.6],
  ['Ice cream, vanilla', '1/2 cup (66 g)', 137, 2.3, 16, 7.3],
  ['White rice, cooked', '1 cup (158 g)', 205, 4.3, 45, 0.4],
  ['Brown rice, cooked', '1 cup (195 g)', 216, 5, 45, 1.8],
  ['Pasta, cooked', '1 cup (140 g)', 221, 8, 43, 1.3, 'spaghetti noodles'],
  ['Oats, rolled, dry', '1/2 cup (40 g)', 150, 5, 27, 2.5, 'oatmeal porridge'],
  ['Oatmeal, cooked with water', '1 cup (234 g)', 166, 5.9, 28, 3.6, 'porridge oats'],
  ['Bread, whole wheat', '1 slice (32 g)', 80, 4, 13.7, 1.1, 'toast'],
  ['Bread, white', '1 slice (25 g)', 67, 2, 13, 0.8, 'toast'],
  ['Bagel, plain', '1 medium (105 g)', 289, 11, 56, 1.8],
  ['English muffin', '1 muffin (57 g)', 134, 4.4, 26, 1],
  ['Tortilla, flour (8")', '1 tortilla (49 g)', 146, 3.9, 24, 3.7, 'wrap'],
  ['Tortilla, corn', '1 tortilla (26 g)', 57, 1.5, 12, 0.7],
  ['Quinoa, cooked', '1 cup (185 g)', 222, 8, 39, 3.6],
  ['Potato, baked', '1 medium (173 g)', 161, 4.3, 37, 0.2],
  ['Sweet potato, baked', '1 medium (114 g)', 103, 2.3, 24, 0.2],
  ['French fries', 'medium order (117 g)', 320, 5, 43, 15, 'chips fries'],
  ['Cheerios', '1 cup (28 g)', 100, 3.6, 20, 2, 'cereal'],
  ['Granola', '1/2 cup (60 g)', 290, 7, 39, 12, 'cereal'],
  ['Pancakes', '2 medium (76 g)', 175, 5, 22, 7.5],
  ['Waffle, frozen', '1 waffle (35 g)', 98, 2.3, 15, 3.3],
  ['Crackers', '5 crackers (16 g)', 80, 1, 10, 4],
  ['Popcorn, air-popped', '3 cups (24 g)', 93, 3, 19, 1.1],
  ['Pretzels', '1 oz (28 g)', 108, 2.9, 22.5, 0.8],
  ['Tortilla chips', '1 oz (28 g)', 140, 2, 18, 7, 'nachos'],
  ['Potato chips', '1 oz (28 g)', 152, 2, 15, 10, 'crisps'],
  ['Banana', '1 medium (118 g)', 105, 1.3, 27, 0.4],
  ['Apple', '1 medium (182 g)', 95, 0.5, 25, 0.3],
  ['Orange', '1 medium (131 g)', 62, 1.2, 15.4, 0.2],
  ['Strawberries', '1 cup (152 g)', 49, 1, 11.7, 0.5, 'berries'],
  ['Blueberries', '1 cup (148 g)', 84, 1.1, 21, 0.5, 'berries'],
  ['Grapes', '1 cup (151 g)', 104, 1.1, 27, 0.2],
  ['Avocado', '1/2 avocado (68 g)', 114, 1.3, 6, 10.5, 'guacamole'],
  ['Mango', '1 cup (165 g)', 99, 1.4, 25, 0.6],
  ['Pineapple', '1 cup (165 g)', 82, 0.9, 22, 0.2],
  ['Watermelon', '1 cup (152 g)', 46, 0.9, 11.5, 0.2],
  ['Raisins', '1 small box (43 g)', 129, 1.3, 34, 0.2],
  ['Medjool date', '1 date (24 g)', 66, 0.4, 18, 0],
  ['Broccoli, cooked', '1 cup (156 g)', 55, 3.7, 11, 0.6],
  ['Spinach, raw', '1 cup (30 g)', 7, 0.9, 1.1, 0.1],
  ['Mixed salad greens', '2 cups (85 g)', 17, 1.2, 3, 0.2, 'lettuce salad'],
  ['Carrot', '1 medium (61 g)', 25, 0.6, 6, 0.1],
  ['Green beans, cooked', '1 cup (125 g)', 44, 2.4, 10, 0.4],
  ['Bell pepper', '1 medium (119 g)', 31, 1, 7, 0.4, 'capsicum'],
  ['Tomato', '1 medium (123 g)', 22, 1.1, 4.8, 0.2],
  ['Cucumber', '1 cup sliced (104 g)', 16, 0.7, 3.8, 0.1],
  ['Corn on the cob', '1 medium ear (90 g)', 77, 2.9, 17, 1.1, 'sweetcorn'],
  ['Green peas', '1/2 cup (80 g)', 67, 4.3, 12.5, 0.2],
  ['Black beans, cooked', '1/2 cup (86 g)', 114, 7.6, 20, 0.5],
  ['Chickpeas, cooked', '1/2 cup (82 g)', 134, 7.3, 22.5, 2.1, 'garbanzo'],
  ['Lentils, cooked', '1/2 cup (99 g)', 115, 9, 20, 0.4],
  ['Edamame, shelled', '1/2 cup (78 g)', 94, 9.2, 7, 4],
  ['Mushrooms', '1 cup (70 g)', 15, 2.2, 2.3, 0.2],
  ['Onion', '1/2 medium (55 g)', 22, 0.6, 5, 0.1],
  ['Cauliflower', '1 cup (107 g)', 27, 2, 5.3, 0.3],
  ['Zucchini', '1 medium (196 g)', 33, 2.4, 6, 0.6, 'courgette'],
  ['Olive oil', '1 tbsp (13.5 g)', 119, 0, 0, 13.5],
  ['Peanut butter', '2 tbsp (32 g)', 190, 7, 7, 16],
  ['Almond butter', '2 tbsp (32 g)', 196, 6.7, 6, 17.8],
  ['Almonds', '1 oz (28 g)', 164, 6, 6, 14, 'nuts'],
  ['Walnuts', '1 oz (28 g)', 185, 4.3, 3.9, 18.5, 'nuts'],
  ['Cashews', '1 oz (28 g)', 157, 5.2, 8.6, 12.4, 'nuts'],
  ['Peanuts', '1 oz (28 g)', 161, 7.3, 4.6, 14, 'nuts'],
  ['Chia seeds', '1 tbsp (12 g)', 58, 2, 5, 3.7],
  ['Trail mix', '1/4 cup (38 g)', 173, 5, 17, 11],
  ['Mayonnaise', '1 tbsp (14 g)', 94, 0.1, 0.1, 10.3, 'mayo'],
  ['Ranch dressing', '2 tbsp (30 g)', 129, 0.4, 1.8, 13.4],
  ['Hummus', '2 tbsp (30 g)', 50, 2.4, 4.3, 2.9],
  ['Ketchup', '1 tbsp (17 g)', 17, 0.2, 4.5, 0],
  ['Honey', '1 tbsp (21 g)', 64, 0.1, 17, 0],
  ['Maple syrup', '1 tbsp (20 g)', 52, 0, 13.4, 0],
  ['Sugar', '1 tsp (4 g)', 16, 0, 4, 0],
  ['Jam', '1 tbsp (20 g)', 56, 0.1, 13.8, 0, 'jelly'],
  ['Dark chocolate 70%', '1 oz (28 g)', 170, 2.2, 13, 12],
  ['Milk chocolate bar', '1 bar (43 g)', 210, 3, 26, 13, 'candy'],
  ['Chocolate chip cookie', '1 cookie (16 g)', 78, 0.9, 10.4, 3.9],
  ['Glazed donut', '1 donut (60 g)', 240, 3.8, 27, 13.7, 'doughnut'],
  ['Blueberry muffin', '1 medium (113 g)', 426, 5, 54, 20],
  ['Croissant', '1 medium (57 g)', 231, 4.7, 26, 12],
  ['Rice cake', '1 cake (9 g)', 35, 0.7, 7.3, 0.3],
  ['Beef jerky', '1 oz (28 g)', 116, 9.4, 3.1, 7.3],
  ['Cheese pizza', '1 slice (107 g)', 285, 12, 36, 10.4],
  ['Pepperoni pizza', '1 slice (111 g)', 313, 13, 36, 13],
  ['Cheeseburger, fast food', '1 burger', 300, 15, 32, 13, 'hamburger mcdonalds'],
  ['Big Mac', '1 burger', 590, 25, 46, 34, 'mcdonalds burger'],
  ['Chicken nuggets', '6 pieces (96 g)', 250, 14, 15, 15, 'mcnuggets'],
  ['Chicken burrito', '1 burrito (~350 g)', 650, 35, 75, 22, 'chipotle'],
  ['Chicken Caesar salad', '1 bowl (~300 g)', 440, 30, 15, 29],
  ['California roll', '6 pieces', 255, 9, 38, 7, 'sushi'],
  ['Pad thai', '1 cup (200 g)', 375, 14, 48, 14],
  ['Fried rice', '1 cup (137 g)', 238, 5.6, 34, 8.8],
  ['Spaghetti with meat sauce', '1 cup (~250 g)', 330, 16, 42, 11, 'bolognese'],
  ['Mac and cheese', '1 cup (~200 g)', 350, 12, 48, 12, 'macaroni'],
  ['Grilled cheese sandwich', '1 sandwich', 410, 16, 29, 26],
  ['PB&J sandwich', '1 sandwich', 380, 11, 47, 18, 'peanut butter jelly'],
  ['Turkey sandwich', '1 sandwich', 320, 22, 30, 11],
  ['Chicken noodle soup', '1 cup (241 g)', 62, 3.2, 7.3, 2.4],
  ['Coffee, black', '1 cup (240 ml)', 2, 0.3, 0, 0, 'americano espresso'],
  ['Latte, 2% milk', '16 oz (grande)', 190, 13, 19, 7, 'starbucks coffee'],
  ['Orange juice', '1 cup (248 ml)', 112, 1.7, 26, 0.5, 'oj'],
  ['Cola', '1 can (355 ml)', 140, 0, 39, 0, 'coke soda pop pepsi'],
  ['Sports drink', '20 oz bottle (591 ml)', 140, 0, 36, 0, 'gatorade powerade'],
  ['Fruit smoothie', '16 oz (473 ml)', 270, 4, 62, 1],
  ['Beer', '1 can (355 ml)', 153, 1.6, 12.6, 0],
  ['Light beer', '1 can (355 ml)', 103, 0.9, 5.8, 0],
  ['Red wine', '5 oz glass (148 ml)', 125, 0.1, 3.8, 0]
].map(([name, serving, kcal, p, c, f, extra]) => ({
  name, serving, kcal, p, c, f,
  source: 'db',
  search: (name + ' ' + (extra || '')).toLowerCase()
}));

const Nutrition = (() => {
  const TARGETS_KEY = 'nutrition_targets_v1';
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const MACROS = [
    { key: 'p', label: 'Protein' },
    { key: 'c', label: 'Carbs' },
    { key: 'f', label: 'Fat' }
  ];
  const $ = id => document.getElementById(id);

  let photoDataUrl = null;
  let estimateItems = [];
  let estimateNotes = '';
  let editorSource = 'custom';
  let localResults = [];
  let onlineTimer = null;
  let onlineCtrl = null;
  let statusTimer = null;
  const onlineCache = new Map();
  const openEdits = new Set();

  const logKey = () => 'nutrition:' + getActiveDateString();
  const getLog = () => storeGet(logKey()) || [];
  function getTargets() {
    return Object.assign({ kcal: 2200, p: 150, c: 220, f: 70 }, storeGet(TARGETS_KEY) || {});
  }

  function saveLog(log) {
    storeSet(logKey(), log);
    renderSummary();
    renderLog();
  }

  function defaultMeal() {
    const h = new Date().getHours();
    if (h >= 6 && h < 11) return 'Breakfast';
    if (h >= 11 && h < 16) return 'Lunch';
    if (h >= 16 && h < 21) return 'Dinner';
    return 'Snacks';
  }

  function fillMealSelect(select, value) {
    select.innerHTML = '';
    MEALS.forEach(m => {
      const o = el('option', null, m);
      o.value = m;
      select.appendChild(o);
    });
    select.value = value || defaultMeal();
  }

  function totalsOf(entries) {
    return entries.reduce((t, e) => {
      t.kcal += e.per.kcal * e.qty;
      t.p += e.per.p * e.qty;
      t.c += e.per.c * e.qty;
      t.f += e.per.f * e.qty;
      return t;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }

  function macroDot(key) {
    const d = el('i', 'macro-dot');
    d.style.background = MACRO_COLORS[key];
    return d;
  }

  /* ----- Summary ----- */
  function renderSummary() {
    const t = totalsOf(getLog());
    const g = getTargets();
    $('kcalNum').textContent = fmtInt(t.kcal);
    $('kcalTarget').textContent = fmtInt(g.kcal);
    const left = g.kcal - t.kcal;
    const leftEl = $('kcalLeft');
    leftEl.textContent = left >= 0 ? fmtInt(left) + ' kcal left' : '⚠ ' + fmtInt(-left) + ' kcal over target';
    leftEl.classList.toggle('over', left < 0);
    $('kcalBar').style.width = (g.kcal ? Math.min(100, t.kcal / g.kcal * 100) : 0) + '%';

    renderMacroRows($('macroList'), t, g);
  }

  function renderMacroRows(list, t, g) {
    list.innerHTML = '';
    MACROS.forEach(m => {
      const row = el('div', 'macro');
      const top = el('div', 'macro-top');
      const name = el('span', 'macro-name');
      name.append(macroDot(m.key), document.createTextNode(m.label));
      const val = el('span', 'macro-val');
      val.append(el('b', null, fmtInt(t[m.key])), document.createTextNode(' / ' + fmtInt(g[m.key]) + ' g'));
      top.append(name, val);
      const meter = el('div', 'meter');
      const fill = el('div', 'meter-fill');
      fill.style.background = MACRO_COLORS[m.key];
      fill.style.width = (g[m.key] ? Math.min(100, t[m.key] / g[m.key] * 100) : 0) + '%';
      meter.appendChild(fill);
      row.append(top, meter);
      list.appendChild(row);
    });
  }

  /* ----- Daily log ----- */
  function renderLog() {
    const log = getLog();
    $('foodCount').textContent = log.length;
    const wrap = $('mealGroups');
    wrap.innerHTML = '';
    MEALS.forEach(meal => {
      const items = log.filter(e => e.meal === meal);
      const group = el('div', 'meal-group');
      group.dataset.meal = meal;
      const head = el('div', 'meal-head');
      head.append(el('span', null, meal), el('span', null, items.length ? fmtInt(totalsOf(items).kcal) + ' kcal' : ''));
      group.appendChild(head);
      if (!items.length) group.appendChild(el('div', 'meal-empty', 'Nothing logged'));
      items.forEach(e => group.appendChild(buildEntry(e)));
      wrap.appendChild(group);
    });
  }

  function refreshSubtotals(log) {
    document.querySelectorAll('#mealGroups .meal-group').forEach(g => {
      const items = log.filter(e => e.meal === g.dataset.meal);
      g.querySelector('.meal-head span:last-child').textContent =
        items.length ? fmtInt(totalsOf(items).kcal) + ' kcal' : '';
    });
  }

  function patchEntry(id, patch) {
    const log = getLog();
    const entry = log.find(x => x.id === id);
    if (!entry) return null;
    Object.assign(entry, patch);
    return { log, entry };
  }

  function buildEntry(e) {
    const card = el('div', 'food-entry');
    if (e.at && Date.now() - e.at < 1500) card.classList.add('just-added');
    const form = buildEntryEditor(e, card);
    card.append(buildEntryRow(e, form), form);
    return card;
  }

  function buildEntryRow(e, form) {
    const row = el('div', 'fe-row');
    const main = el('div', 'fe-main');
    main.appendChild(el('div', 'fe-name', e.name));
    main.appendChild(el('div', 'fe-sub', (e.source === 'photo' ? 'Photo · ' : e.source === 'recipe' ? 'Recipe · ' : '') + fmtQty(e.qty) + ' × ' + e.serving));
    const macros = el('div', 'fe-macros');
    MACROS.forEach(m => {
      const s = el('span');
      s.append(macroDot(m.key), document.createTextNode(m.label[0] + ' ' + round1(e.per[m.key] * e.qty) + 'g'));
      macros.appendChild(s);
    });
    main.appendChild(macros);

    const side = el('div', 'fe-side');
    side.appendChild(el('div', 'fe-kcal', fmtInt(e.per.kcal * e.qty) + ' kcal'));
    const controls = el('div', 'fe-controls');
    const stepper = el('div', 'stepper');
    const minus = el('button', null, '−');
    minus.type = 'button';
    minus.title = 'Fewer servings';
    const plus = el('button', null, '+');
    plus.type = 'button';
    plus.title = 'More servings';
    minus.addEventListener('click', () => {
      const step = e.qty <= 1 ? 0.25 : 0.5;
      const r = patchEntry(e.id, { qty: Math.max(0.25, round2(e.qty - step)) });
      if (r) saveLog(r.log);
    });
    plus.addEventListener('click', () => {
      const step = e.qty < 1 ? 0.25 : 0.5;
      const r = patchEntry(e.id, { qty: round2(e.qty + step) });
      if (r) saveLog(r.log);
    });
    stepper.append(minus, el('span', null, fmtQty(e.qty)), plus);

    const edit = el('button', 'icon-btn', '✎');
    edit.type = 'button';
    edit.title = 'Adjust';
    edit.addEventListener('click', () => {
      if (openEdits.has(e.id)) openEdits.delete(e.id);
      else openEdits.add(e.id);
      form.hidden = !openEdits.has(e.id);
    });
    const del = el('button', 'icon-btn danger', '×');
    del.type = 'button';
    del.title = 'Remove';
    del.addEventListener('click', () => {
      openEdits.delete(e.id);
      const before = getLog();
      saveLog(before.filter(x => x.id !== e.id));
      Toast.show('Removed ' + e.name, { undo: () => saveLog(before) });
    });
    controls.append(stepper, edit, del);
    side.appendChild(controls);
    row.append(main, side);
    return row;
  }

  // Inline "adjust" panel. Edits save on change without rebuilding the panel, so tabbing between fields keeps focus.
  function buildEntryEditor(e, card) {
    const form = el('div', 'fe-edit');
    form.hidden = !openEdits.has(e.id);

    function commit(patchFn) {
      const log = getLog();
      const entry = log.find(x => x.id === e.id);
      if (!entry) return;
      patchFn(entry);
      storeSet(logKey(), log);
      Object.assign(e, entry);
      card.replaceChild(buildEntryRow(entry, form), card.firstChild);
      renderSummary();
      refreshSubtotals(log);
    }

    function field(label, value, cls, type, apply) {
      const f = el('label', 'field' + (cls ? ' ' + cls : ''));
      f.appendChild(el('span', 'field-label', label));
      const input = el('input', 'goal-input sm');
      input.type = type;
      input.value = value;
      if (type === 'number') { input.min = '0'; input.step = 'any'; }
      input.addEventListener('change', () => commit(entry => apply(entry, input.value)));
      f.appendChild(input);
      return f;
    }

    form.append(
      field('Food', e.name, 'span-2', 'text', (x, v) => { if (v.trim()) x.name = v.trim(); }),
      field('Serving', e.serving, 'span-2', 'text', (x, v) => { x.serving = v.trim() || '1 serving'; }),
      field('Servings', fmtQty(e.qty), '', 'number', (x, v) => { x.qty = toNum(v) || x.qty; }),
      field('kcal / serving', round1(e.per.kcal), '', 'number', (x, v) => { x.per.kcal = toNum(v); }),
      field('Protein g', round1(e.per.p), '', 'number', (x, v) => { x.per.p = toNum(v); }),
      field('Carbs g', round1(e.per.c), '', 'number', (x, v) => { x.per.c = toNum(v); }),
      field('Fat g', round1(e.per.f), '', 'number', (x, v) => { x.per.f = toNum(v); })
    );

    const mealField = el('label', 'field');
    mealField.appendChild(el('span', 'field-label', 'Meal'));
    const sel = el('select', 'goal-input sm');
    fillMealSelect(sel, e.meal);
    sel.addEventListener('change', () => {
      const r = patchEntry(e.id, { meal: sel.value });
      if (r) saveLog(r.log);
    });
    mealField.appendChild(sel);
    form.appendChild(mealField);
    return form;
  }

  /* ----- Search + manual add ----- */
  function searchLocal(q) {
    const ql = q.toLowerCase();
    const terms = ql.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return FOOD_DB
      .filter(fd => terms.every(t => fd.search.includes(t)))
      .map(fd => {
        // Whole-word matches first, then list order (the list runs roughly most-common first).
        const n = ' ' + fd.name.toLowerCase().replace(/[^a-z0-9%&]+/g, ' ');
        const rank = n.includes(' ' + ql) ? 0 : n.includes(' ' + terms[0]) ? 1 : 2;
        return { fd, score: rank + FOOD_DB.indexOf(fd) / 1000 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map(x => x.fd);
  }

  function resultItem(food) {
    const btn = el('button', 'fr-item');
    btn.type = 'button';
    const main = el('div', 'fr-main');
    main.appendChild(el('div', 'fr-name', food.name));
    main.appendChild(el('div', 'fr-sub',
      food.serving + ' · P ' + round1(food.p) + ' · C ' + round1(food.c) + ' · F ' + round1(food.f)));
    btn.append(main, el('span', 'fr-kcal', fmtInt(food.kcal) + ' kcal'));
    btn.addEventListener('click', () => openEditor(food));
    return btn;
  }

  function renderResults() {
    const q = $('foodSearch').value.trim();
    const box = $('foodResults');
    box.innerHTML = '';
    clearTimeout(onlineTimer);
    if (onlineCtrl) onlineCtrl.abort();
    localResults = [];
    if (!q) return;

    localResults = searchLocal(q);
    box.appendChild(el('div', 'fr-heading', 'Popular foods'));
    if (localResults.length) localResults.forEach(fd => box.appendChild(resultItem(fd)));
    else box.appendChild(el('div', 'fr-note', 'No common matches.'));

    const online = el('div');
    box.appendChild(online);
    if (q.length >= 3) queueOnline(q, online);

    const custom = el('button', 'fr-item');
    custom.type = 'button';
    const cm = el('div', 'fr-main');
    cm.appendChild(el('div', 'fr-name', '+ Add “' + q + '” with your own numbers'));
    custom.appendChild(cm);
    custom.addEventListener('click', () => openEditor(null, q));
    box.appendChild(custom);
  }

  function offToFood(p) {
    const n = p.nutriments || {};
    const kcal100 = Number(n['energy-kcal_100g']);
    if (!p.product_name || !isFinite(kcal100)) return null;
    const sq = Number(p.serving_quantity);
    const perServing = isFinite(sq) && sq > 0 && sq < 2000;
    const k = perServing ? sq / 100 : 1;
    const brand = String(p.brands || '').split(',')[0].trim();
    return {
      name: String(p.product_name).trim() + (brand ? ' (' + brand + ')' : ''),
      serving: perServing ? (p.serving_size || sq + ' g') : '100 g',
      kcal: round1(kcal100 * k),
      p: round1((Number(n.proteins_100g) || 0) * k),
      c: round1((Number(n.carbohydrates_100g) || 0) * k),
      f: round1((Number(n.fat_100g) || 0) * k),
      source: 'online'
    };
  }

  function titleCase(s) {
    return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s;
  }

  // USDA FoodData Central: nutrients come back per 100 g; branded foods also carry a serving size.
  function usdaToFood(item) {
    const find = (names, unit) => {
      const n = (item.foodNutrients || []).find(x => names.some(name => (x.nutrientName || '').startsWith(name)) && String(x.unitName).toUpperCase() === unit);
      return n ? Number(n.value) || 0 : null;
    };
    const kcal100 = find(['Energy'], 'KCAL');
    if (kcal100 == null || !item.description) return null;
    const size = Number(item.servingSize);
    const unit = String(item.servingSizeUnit || '').toLowerCase();
    const perServing = size > 0 && (unit === 'g' || unit === 'ml' || unit === 'grm' || unit === 'mlt');
    const k = perServing ? size / 100 : 1;
    const unitLabel = unit.startsWith('m') ? 'ml' : 'g';
    const household = item.householdServingFullText
      ? item.householdServingFullText.toLowerCase().replace(/\bonz\b/g, 'oz')
      : '';
    const brand = item.brandName || item.brandOwner || '';
    return {
      name: titleCase(item.description) + (brand ? ' (' + titleCase(brand) + ')' : ''),
      serving: perServing ? (household ? household + ' (' + round1(size) + ' ' + unitLabel + ')' : round1(size) + ' ' + unitLabel) : '100 g',
      kcal: round1(kcal100 * k),
      p: round1((find(['Protein'], 'G') || 0) * k),
      c: round1((find(['Carbohydrate, by difference'], 'G') || 0) * k),
      f: round1((find(['Total lipid'], 'G') || 0) * k),
      source: 'online'
    };
  }

  async function fetchUsda(q, signal) {
    const url = 'https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=15' +
      '&dataType=' + encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded') +
      '&api_key=' + encodeURIComponent(usdaKey()) +
      '&query=' + encodeURIComponent(q);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('USDA ' + res.status);
    const data = await res.json();
    return (data.foods || []).map(usdaToFood).filter(Boolean);
  }

  async function fetchOff(q, signal) {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=15' +
      '&fields=product_name,brands,nutriments,serving_size,serving_quantity&search_terms=' + encodeURIComponent(q);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('OFF ' + res.status);
    const data = await res.json();
    return (data.products || []).map(offToFood).filter(Boolean);
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter(x => {
      const key = x.name.toLowerCase() + '|' + x.kcal;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function paintOnline(wrap, items) {
    wrap.innerHTML = '';
    wrap.appendChild(el('div', 'fr-heading', 'Online results'));
    if (items.length) items.forEach(food => wrap.appendChild(resultItem(food)));
    else wrap.appendChild(el('div', 'fr-note', 'No online matches.'));
  }

  function queueOnline(q, wrap) {
    const key = q.toLowerCase();
    if (onlineCache.has(key)) {
      paintOnline(wrap, onlineCache.get(key));
      return;
    }
    wrap.appendChild(el('div', 'fr-heading', 'Online results'));
    const note = el('div', 'fr-note');
    note.append(el('span', 'spinner'), document.createTextNode('Searching…'));
    wrap.appendChild(note);

    onlineTimer = setTimeout(async () => {
      const ctrl = new AbortController();
      onlineCtrl = ctrl;
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      let items = null;
      try {
        items = await fetchUsda(q, ctrl.signal);
      } catch (err) {
        if (!wrap.isConnected) { clearTimeout(timeout); return; }
        console.warn('USDA search failed, trying Open Food Facts:', err);
        try {
          items = await fetchOff(q, ctrl.signal);
        } catch (err2) {
          console.warn('Open Food Facts search failed:', err2);
        }
      }
      clearTimeout(timeout);
      if (!wrap.isConnected) return;
      if (!items) {
        wrap.innerHTML = '';
        wrap.appendChild(el('div', 'fr-heading', 'Online results'));
        wrap.appendChild(el('div', 'fr-note', 'Online search is unavailable right now — popular foods still work.'));
        return;
      }
      items = dedupe(items).slice(0, 6);
      onlineCache.set(key, items);
      paintOnline(wrap, items);
    }, 600);
  }

  const editorField = name => $('foodEditor').elements.namedItem(name);

  function openEditor(food, presetName) {
    const form = $('foodEditor');
    editorField('name').value = food ? food.name : (presetName || '');
    editorField('serving').value = food ? food.serving : '1 serving';
    editorField('qty').value = 1;
    fillMealSelect(editorField('meal'));
    ['kcal', 'p', 'c', 'f'].forEach(k => { editorField(k).value = food ? round1(food[k]) : ''; });
    editorSource = food ? food.source : 'custom';
    form.hidden = false;
    $('customFoodBtn').hidden = true;
    updatePreview();
    const focusEl = food ? editorField('qty') : (presetName ? editorField('kcal') : editorField('name'));
    focusEl.focus();
    if (food) focusEl.select();
  }

  function closeEditor() {
    $('foodEditor').hidden = true;
    $('customFoodBtn').hidden = false;
  }

  function updatePreview() {
    const qty = toNum(editorField('qty').value) || 0;
    const v = k => toNum(editorField(k).value) * qty;
    const box = $('editorPreview');
    box.innerHTML = '';
    box.append(
      document.createTextNode('Total: '),
      el('b', null, fmtInt(v('kcal')) + ' kcal'),
      document.createTextNode(' · P ' + round1(v('p')) + 'g · C ' + round1(v('c')) + 'g · F ' + round1(v('f')) + 'g')
    );
  }

  function submitEditor(evt) {
    evt.preventDefault();
    const name = editorField('name').value.trim();
    if (!name) { editorField('name').focus(); return; }
    const log = getLog();
    log.push({
      id: uid(),
      name,
      serving: editorField('serving').value.trim() || '1 serving',
      qty: toNum(editorField('qty').value) || 1,
      per: {
        kcal: toNum(editorField('kcal').value),
        p: toNum(editorField('p').value),
        c: toNum(editorField('c').value),
        f: toNum(editorField('f').value)
      },
      meal: editorField('meal').value,
      source: editorSource,
      at: Date.now()
    });
    saveLog(log);
    closeEditor();
    $('foodSearch').value = '';
    renderResults();
    Toast.show('Added ' + name + ' to ' + editorField('meal').value);
  }

  /* ----- Photo scan ----- */
  function setPhotoStatus(msg, isError, spinning) {
    clearTimeout(statusTimer);
    const s = $('photoStatus');
    s.innerHTML = '';
    s.classList.toggle('error', !!isError);
    if (!msg) return;
    if (spinning) s.appendChild(el('span', 'spinner'));
    s.appendChild(document.createTextNode(msg));
  }

  function flashPhotoStatus(msg) {
    setPhotoStatus(msg);
    statusTimer = setTimeout(() => setPhotoStatus(''), 4000);
  }

  function downscaleImage(file, maxDim) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }

  async function loadPhoto(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setPhotoStatus('That file isn’t an image.', true);
      return;
    }
    try {
      photoDataUrl = await downscaleImage(file, 1280);
    } catch (e) {
      setPhotoStatus('Couldn’t read that image — try a JPG or PNG.', true);
      return;
    }
    $('photoPreview').src = photoDataUrl;
    $('photoWork').hidden = false;
    $('dropzone').hidden = true;
    $('estimate').hidden = true;
    $('photoNote').value = '';
    setPhotoStatus('');
    $('analyzeBtn').focus();
  }

  function resetPhoto() {
    photoDataUrl = null;
    estimateItems = [];
    estimateNotes = '';
    $('mealPhoto').value = '';
    $('photoWork').hidden = true;
    $('estimate').hidden = true;
    $('dropzone').hidden = false;
  }

  async function requestMealEstimate(base64, note) {
    const prompt = [
      'Estimate the nutrition of the meal in this photo.',
      'Identify each distinct food or drink you can see. For each one, estimate the portion shown (use cues like plate size and utensils) and its calories and macronutrients for that portion, using typical nutrition-database values.',
      note ? 'The person added this note — trust it over what you can see: ' + note : '',
      'Reply with only a JSON object — no prose and no code fences — in this shape:',
      '{"foods":[{"name":"Grilled chicken breast","portion":"about 150 g","kcal":248,"protein":46,"carbs":0,"fat":5}],"notes":"One short sentence on anything uncertain."}',
      'Use whole numbers; protein, carbs and fat are grams. If there is no food in the photo, return {"foods":[],"notes":"<why>"}.'
    ].filter(Boolean).join('\n');

    const data = await callClaude({
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    }, 'Scan');
    if (data.stop_reason === 'refusal') {
      throw new Error('Claude couldn’t analyze that photo. Try another shot, or add the foods by search.');
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Couldn’t read the estimate — try again.');
    return JSON.parse(text.slice(start, end + 1));
  }

  async function analyzePhoto() {
    if (!photoDataUrl) return;
    if (!anthropicKey()) {
      setPhotoStatus('Meal scanning needs an Anthropic API key — add it in Settings (gear in the sidebar, or More → Settings on your phone). You can still search and add foods below.', true);
      return;
    }
    const btn = $('analyzeBtn');
    btn.disabled = true;
    setPhotoStatus('Looking at your meal…', false, true);
    try {
      const result = await requestMealEstimate(photoDataUrl.split(',')[1], $('photoNote').value.trim());
      estimateItems = (Array.isArray(result.foods) ? result.foods : []).map(f => ({
        name: String(f.name || 'Food'),
        portion: String(f.portion || '1 serving'),
        kcal: toNum(f.kcal),
        p: toNum(f.protein),
        c: toNum(f.carbs),
        f: toNum(f.fat)
      }));
      estimateNotes = typeof result.notes === 'string' ? result.notes : '';
      if (!estimateItems.length) {
        setPhotoStatus(estimateNotes || 'No food found in that photo.', true);
        return;
      }
      setPhotoStatus('');
      fillMealSelect($('estimateMeal'));
      renderEstimate();
    } catch (err) {
      console.warn('Meal scan failed:', err);
      setPhotoStatus(err.message || 'Something went wrong — try again.', true);
    } finally {
      btn.disabled = false;
    }
  }

  function renderEstimate() {
    const rows = $('estimateRows');
    rows.innerHTML = '';
    const labels = { kcal: 'kcal', p: 'Protein g', c: 'Carbs g', f: 'Fat g' };
    estimateItems.forEach((item, i) => {
      const row = el('div', 'est-row');
      const nameBox = el('div', 'est-name');
      const name = el('input', 'goal-input');
      name.value = item.name;
      name.setAttribute('aria-label', 'Food name');
      name.addEventListener('input', () => { item.name = name.value; });
      const portion = el('input', 'goal-input est-portion');
      portion.value = item.portion;
      portion.setAttribute('aria-label', 'Portion');
      portion.addEventListener('input', () => { item.portion = portion.value; });
      nameBox.append(name, portion);
      row.appendChild(nameBox);

      ['kcal', 'p', 'c', 'f'].forEach(k => {
        const wrap = el('label', 'est-num');
        wrap.appendChild(el('span', null, labels[k]));
        const inp = el('input', 'goal-input');
        inp.type = 'number';
        inp.min = '0';
        inp.step = 'any';
        inp.value = round1(item[k]);
        inp.setAttribute('aria-label', labels[k]);
        inp.addEventListener('input', () => { item[k] = toNum(inp.value); renderEstimateTotal(); });
        wrap.appendChild(inp);
        row.appendChild(wrap);
      });

      const del = el('button', 'icon-btn danger', '×');
      del.type = 'button';
      del.title = 'Remove this item';
      del.addEventListener('click', () => {
        estimateItems.splice(i, 1);
        if (estimateItems.length) renderEstimate();
        else resetPhoto();
      });
      row.appendChild(del);
      rows.appendChild(row);
    });

    const notes = $('estimateNotes');
    notes.textContent = estimateNotes;
    notes.hidden = !estimateNotes;
    renderEstimateTotal();
    $('estimate').hidden = false;
  }

  function renderEstimateTotal() {
    const t = estimateItems.reduce((a, x) => {
      a.kcal += x.kcal; a.p += x.p; a.c += x.c; a.f += x.f;
      return a;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
    const box = $('estimateTotal');
    box.innerHTML = '';
    box.append(
      document.createTextNode('Meal total: '),
      el('b', null, fmtInt(t.kcal) + ' kcal'),
      document.createTextNode(' · P ' + round1(t.p) + 'g · C ' + round1(t.c) + 'g · F ' + round1(t.f) + 'g')
    );
    const n = estimateItems.length;
    $('estimateAdd').textContent = 'Add ' + n + ' item' + (n === 1 ? '' : 's') + ' to log';
  }

  function addEstimateToLog() {
    if (!estimateItems.length) return;
    const meal = $('estimateMeal').value;
    const log = getLog();
    estimateItems.forEach(x => {
      log.push({
        id: uid(),
        name: x.name.trim() || 'Food',
        serving: x.portion.trim() || '1 serving',
        qty: 1,
        per: { kcal: x.kcal, p: x.p, c: x.c, f: x.f },
        meal,
        source: 'photo',
        at: Date.now()
      });
    });
    const n = estimateItems.length;
    saveLog(log);
    resetPhoto();
    flashPhotoStatus('Added ' + n + ' item' + (n === 1 ? '' : 's') + ' to ' + meal + '.');
  }

  /* ----- Recipe finder: ingredients + goal → TikTok recipes ----- */
  const RECIPE_KEY = 'recipe_finder_v1';
  const RECIPE_GOALS = [
    { id: 'hp-lc', label: 'High protein, low carb', hint: 'Cutting', search: 'high protein low carb',
      brief: 'high protein (35 g+ per serving), low carb (under ~20 g carbs), moderate fat' },
    { id: 'lean-carbs', label: 'Lean protein + carbs', hint: 'Fuel training', search: 'high protein meal prep',
      brief: 'lean protein (30 g+ per serving) with a solid portion of complex carbs, low fat (under ~12 g)' },
    { id: 'balanced', label: 'Balanced', hint: 'Maintenance', search: 'healthy high protein',
      brief: 'a balanced plate: about 30 g protein with moderate carbs and fat' },
    { id: 'low-cal', label: 'Low calorie', hint: 'Under 450 kcal', search: 'low calorie high protein',
      brief: 'high volume and low calorie (under ~450 kcal per serving) with 25 g+ protein' },
    { id: 'bulk', label: 'High calorie', hint: 'Bulking', search: 'high calorie bulking',
      brief: 'calorie dense (700+ kcal per serving) and high protein (40 g+)' }
  ];
  let recipeResults = [];
  let recipeBusy = false;

  function recipeState() {
    const s = Object.assign({ pantry: [], goal: 'hp-lc', liked: [] }, storeGet(RECIPE_KEY) || {});
    if (!Array.isArray(s.pantry)) s.pantry = [];
    if (!Array.isArray(s.liked)) s.liked = [];
    if (!RECIPE_GOALS.some(g => g.id === s.goal)) s.goal = 'hp-lc';
    return s;
  }
  function saveRecipeState(s) {
    storeSet(RECIPE_KEY, s);
    renderRecipeForm();
  }
  const recipeGoal = () => RECIPE_GOALS.find(g => g.id === recipeState().goal);

  function setRecipeStatus(msg, isError, spinning) {
    const s = $('recipeStatus');
    s.innerHTML = '';
    s.classList.toggle('error', !!isError);
    if (!msg) return;
    if (spinning) s.appendChild(el('span', 'spinner'));
    s.appendChild(document.createTextNode(msg));
  }

  const tiktokSearchUrl = q => 'https://www.tiktok.com/search?q=' + encodeURIComponent(q);

  function renderRecipeForm() {
    const s = recipeState();
    const pantry = $('pantry');
    const input = $('pantryInput');
    pantry.querySelectorAll('.pantry-chip').forEach(c => c.remove());
    s.pantry.forEach((item, i) => {
      const chip = el('span', 'pantry-chip', item);
      const x = el('button', null, '×');
      x.type = 'button';
      x.title = 'Remove ' + item;
      x.addEventListener('click', e => {
        e.stopPropagation();
        const st = recipeState();
        st.pantry.splice(i, 1);
        saveRecipeState(st);
      });
      chip.appendChild(x);
      pantry.insertBefore(chip, input);
    });
    input.placeholder = s.pantry.length ? 'Add more…' : 'Type an ingredient, press Enter — e.g. chicken, rice, eggs';

    const goals = $('recipeGoals');
    goals.innerHTML = '';
    RECIPE_GOALS.forEach(g => {
      const b = el('button', 'recipe-goal' + (g.id === s.goal ? ' active' : ''));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(g.id === s.goal));
      b.append(document.createTextNode(g.label), el('small', null, g.hint));
      b.addEventListener('click', () => {
        const st = recipeState();
        st.goal = g.id;
        saveRecipeState(st);
      });
      goals.appendChild(b);
    });

    // Plain TikTok search: works without an API key.
    const q = [recipeGoal().search, ...s.pantry.slice(0, 4), $('recipeMeal').value.toLowerCase(), 'recipe'].join(' ');
    $('recipeTikTokLink').href = tiktokSearchUrl(q);
  }

  function addPantryItems(text) {
    const items = text.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!items.length) return;
    const s = recipeState();
    items.forEach(x => { if (!s.pantry.includes(x)) s.pantry.push(x); });
    saveRecipeState(s);
  }

  // Pantry, meal, goal and (optionally) today's remaining macros: shared by both recipe prompts.
  function recipeContextLines() {
    const lines = [
      'Ingredients I have: ' + recipeState().pantry.join(', ') + '. Assume basics like salt, pepper, cooking oil and common dried spices are available too.',
      'Meal: ' + $('recipeMeal').value + '.',
      'Fitness goal for this meal: ' + recipeGoal().brief + '.'
    ];
    if ($('recipeFit').checked) {
      const left = getTargets();
      const t = totalsOf(getLog());
      const rem = k => Math.max(0, Math.round(left[k] - t[k]));
      lines.push('What is left of my daily targets: ' + rem('kcal') + ' kcal, ' + rem('p') + ' g protein, ' + rem('c') + ' g carbs, ' + rem('f') + ' g fat. Keep one serving within that where you can.');
    }
    return lines;
  }

  function recipePrompt() {
    const lines = ['Find real TikTok recipe videos I can cook with what I have.', ...recipeContextLines()];
    lines.push(
      'Use web search to find TikTok recipe videos (tiktok.com/@creator/video/… pages). Prefer recipes that mostly use my ingredients; skip any that need more than 3 things I don’t have.',
      'Return up to 5 recipes. Only use video URLs exactly as they appeared in your search results — never make one up. If you can’t find a video for a good idea, leave its url empty.',
      'Estimate calories and macros for one serving from the recipe’s ingredients and amounts.',
      'Reply with only a JSON object — no prose and no code fences — in this shape:',
      '{"recipes":[{"title":"Crispy chicken rice bowl","creator":"@handle","url":"https://www.tiktok.com/@handle/video/123","why":"One sentence on why it fits the goal.","serving":"1 bowl","kcal":540,"protein":48,"carbs":45,"fat":14,"uses":["chicken","rice"],"missing":["sriracha"]}],"notes":"One short sentence, or empty."}',
      'Use whole numbers; protein, carbs and fat are grams.'
    );
    return lines.join('\n');
  }

  // Normalizes a TikTok URL so links Claude returns can be checked against what search actually found.
  function normUrl(u) {
    try {
      const x = new URL(u);
      return (x.hostname.replace(/^(www|m|vm)\./, '') + x.pathname).replace(/\/+$/, '').toLowerCase();
    } catch (e) { return ''; }
  }
  const isTikTok = u => { try { return /(^|\.)tiktok\.com$/i.test(new URL(u).hostname); } catch (e) { return false; } };

  // Runs a prompt with server-side web tools and returns the JSON object Claude replies with,
  // plus every URL its searches actually returned.
  async function askClaudeWithTools(prompt, tools, what) {
    const messages = [{ role: 'user', content: prompt }];
    const found = new Set();
    let data = null;
    // Server-side tools can pause a long turn; send it back to let Claude finish (a few rounds at most).
    for (let round = 0; round < 4; round++) {
      data = await callClaude({ model: RECIPE_MODEL, messages, tools }, what);
      (data.content || []).forEach(b => {
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
          b.content.forEach(r => { if (r && r.url) found.add(normUrl(r.url)); });
        }
      });
      if (data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
    if (data.stop_reason === 'refusal') throw new Error('Claude couldn’t do that one — try different ingredients.');
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Couldn’t read Claude’s reply — try again.');
    return { result: JSON.parse(text.slice(start, end + 1)), found };
  }

  async function requestRecipes() {
    const { result, found } = await askClaudeWithTools(recipePrompt(),
      [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6, allowed_domains: ['tiktok.com'] }],
      'Recipe search');
    const recipes = (Array.isArray(result.recipes) ? result.recipes : []).map(r => {
      const url = String(r.url || '');
      return {
        title: String(r.title || 'Recipe'),
        creator: String(r.creator || ''),
        why: String(r.why || ''),
        serving: String(r.serving || '1 serving'),
        kcal: toNum(r.kcal), p: toNum(r.protein), c: toNum(r.carbs), f: toNum(r.fat),
        uses: Array.isArray(r.uses) ? r.uses.map(String) : [],
        missing: Array.isArray(r.missing) ? r.missing.map(String) : [],
        // Only link straight to a video search actually returned; otherwise fall back to a TikTok search.
        url: url && isTikTok(url) && found.has(normUrl(url)) ? url : ''
      };
    });
    return { recipes, notes: typeof result.notes === 'string' ? result.notes : '' };
  }

  async function findRecipes() {
    if (recipeBusy) return;
    const pending = $('pantryInput').value.trim();
    if (pending) { addPantryItems(pending); $('pantryInput').value = ''; }
    if (!recipeState().pantry.length) {
      setRecipeStatus('Add at least one ingredient first.', true);
      $('pantryInput').focus();
      return;
    }
    if (!anthropicKey()) {
      setRecipeStatus('Finding recipes needs an Anthropic API key — add it in Settings. “Search TikTok ↗” still works without one.', true);
      return;
    }
    recipeBusy = true;
    const btn = $('recipeFindBtn');
    btn.disabled = true;
    recipeResults = [];
    renderRecipeResults();
    setRecipeStatus('Searching TikTok for recipes that fit…', false, true);
    try {
      const { recipes, notes } = await requestRecipes();
      recipeResults = recipes;
      renderRecipeResults();
      setRecipeStatus(recipes.length ? notes : (notes || 'No recipes found — try adding a few more ingredients.'), !recipes.length);
    } catch (err) {
      console.warn('Recipe search failed:', err);
      setRecipeStatus(err.message || 'Something went wrong — try again.', true);
    } finally {
      recipeBusy = false;
      btn.disabled = false;
    }
  }

  // Adds one serving of a recipe ({ title, serving, kcal, p, c, f }) to a meal (default: the one picked in Find a recipe).
  function logRecipe(r, meal) {
    meal = meal || $('recipeMeal').value;
    const entries = getLog();
    entries.push({
      id: uid(),
      name: r.title,
      serving: r.serving,
      qty: 1,
      per: { kcal: r.kcal, p: r.p, c: r.c, f: r.f },
      meal,
      source: 'recipe',
      at: Date.now()
    });
    saveLog(entries);
    Toast.show('Logged ' + r.title + ' to ' + meal);
  }

  function renderRecipeResults() {
    const wrap = $('recipeResults');
    wrap.innerHTML = '';
    recipeResults.forEach(r => {
      const card = el('article', 'recipe-item');
      const head = el('div');
      head.appendChild(el('div', 'recipe-title', r.title));
      if (r.creator) head.appendChild(el('div', 'recipe-creator', r.creator));
      card.appendChild(head);
      if (r.why) card.appendChild(el('div', 'recipe-why', r.why));

      const macros = el('div', 'recipe-macros');
      macros.append(el('b', null, fmtInt(r.kcal) + ' kcal'), el('span', null, 'P ' + round1(r.p) + 'g'),
        el('span', null, 'C ' + round1(r.c) + 'g'), el('span', null, 'F ' + round1(r.f) + 'g'), el('span', null, '· ' + r.serving));
      card.appendChild(macros);

      if (r.uses.length || r.missing.length) {
        const ings = el('div', 'recipe-ings');
        r.uses.forEach(x => ings.appendChild(el('span', 'recipe-ing', x)));
        r.missing.forEach(x => {
          const m = el('span', 'recipe-ing missing', '+ ' + x);
          m.title = 'You’d need to buy this';
          ings.appendChild(m);
        });
        card.appendChild(ings);
      }

      const actions = el('div', 'recipe-item-actions');
      const watch = el('a', 'btn-secondary', r.url ? 'Watch on TikTok ↗' : 'Search on TikTok ↗');
      watch.href = r.url || tiktokSearchUrl(r.title + ' ' + r.creator + ' recipe');
      watch.target = '_blank';
      watch.rel = 'noopener';
      const log = el('button', 'btn-primary', 'Log it');
      log.type = 'button';
      log.title = 'Add one serving to ' + $('recipeMeal').value;
      log.addEventListener('click', () => logRecipe(r));
      actions.append(watch, log);
      if (r.missing.length) actions.appendChild(shopButton(r.missing.map(name => ({ name })), r.title));
      card.appendChild(actions);
      if (!r.url) card.appendChild(el('div', 'recipe-unverified', 'No exact video link found — opens a TikTok search instead.'));
      wrap.appendChild(card);
    });
  }

  /* ----- Meals I liked: TikTok link → Claude's own version with my ingredients ----- */
  const remaking = new Set();     // ids with a request in flight
  const remakeOpen = new Set();   // ids whose recipe is expanded
  const remakeStatus = new Map(); // id → { msg, error }

  function remakePrompt(item) {
    return [
      'I liked the meal in this TikTok: ' + item.url,
      item.note ? 'What I liked about it: ' + item.note : '',
      'Read the video page with web fetch (caption, description, hashtags) to work out the dish, its flavor profile and how it’s cooked. If the page doesn’t say enough, web search the creator and dish name for the recipe. If you still can’t tell what it is, go by my note and say so in "inspiration".',
      'Then write your own version I can cook with what I have — same vibe and flavors, adjusted to my ingredients and goal.',
      ...recipeContextLines(),
      'Make it taste really good, like a restaurant or a top food creator would make it, not bland diet food:',
      '- Give exact amounts for every seasoning, sauce and aromatic (tsp / tbsp / g), not "to taste".',
      '- Build flavor in layers: season or marinate the protein, bloom spices in fat, use aromatics, balance salt, acid, sweetness and heat, and finish with something fresh or bright.',
      '- Get the texture right: say how to get a proper sear or crisp, pan heat, timings, and resting.',
      '- Keep it macro-friendly: get flavor from spices, acid, herbs and low-calorie sauces rather than lots of oil or sugar, and use measured amounts of oil.',
      'You may add up to 3 ingredients I don’t have if they really make the dish — mark them have:false.',
      'Estimate calories and macros per serving from the exact amounts.',
      'Reply with only a JSON object — no prose and no code fences — in this shape:',
      '{"title":"Crispy garlic parmesan chicken bowl","inspiration":"One sentence: what the TikTok was and what you kept from it.","servings":2,"time":"25 min","serving":"1 bowl","kcal":560,"protein":52,"carbs":48,"fat":16,' +
        '"ingredients":[{"item":"chicken breast","amount":"400 g","have":true}],' +
        '"seasoning":[{"item":"smoked paprika","amount":"1 tsp"}],' +
        '"steps":["Pat the chicken dry and …"],"tips":["One short tip that makes it taste better."]}',
      'ingredients lists the main ingredients (protein, carbs, vegetables, sauce bases); seasoning lists every spice, herb, aromatic and condiment with its amount. Numbers are per serving except servings. Use whole numbers.'
    ].filter(Boolean).join('\n');
  }

  function cleanRemake(r) {
    const list = (a, f) => (Array.isArray(a) ? a.map(f).filter(Boolean) : []);
    return {
      title: String(r.title || 'Your version'),
      inspiration: String(r.inspiration || ''),
      servings: toNum(r.servings) || 1,
      time: String(r.time || ''),
      serving: String(r.serving || '1 serving'),
      kcal: toNum(r.kcal), p: toNum(r.protein), c: toNum(r.carbs), f: toNum(r.fat),
      ingredients: list(r.ingredients, x => x && x.item ? { item: String(x.item), amount: String(x.amount || ''), have: x.have !== false } : null),
      seasoning: list(r.seasoning, x => x && x.item ? { item: String(x.item), amount: String(x.amount || '') } : null),
      steps: list(r.steps, x => (x ? String(x) : null)),
      tips: list(r.tips, x => (x ? String(x) : null)),
      madeAt: Date.now()
    };
  }

  function updateLiked(id, fn) {
    const s = recipeState();
    const item = s.liked.find(x => x.id === id);
    if (!item) return;
    fn(item);
    storeSet(RECIPE_KEY, s);
  }

  async function remake(id) {
    if (remaking.has(id)) return;
    const item = recipeState().liked.find(x => x.id === id);
    if (!item) return;
    if (!recipeState().pantry.length) {
      remakeStatus.set(id, { msg: 'Add your ingredients above first.', error: true });
      renderLiked();
      $('pantryInput').focus();
      return;
    }
    if (!anthropicKey()) {
      remakeStatus.set(id, { msg: 'This needs an Anthropic API key — add it in Settings.', error: true });
      renderLiked();
      return;
    }
    remaking.add(id);
    remakeStatus.set(id, { msg: 'Watching the TikTok and writing your version…' });
    renderLiked();
    try {
      const { result } = await askClaudeWithTools(remakePrompt(item), [
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
        { type: 'web_search_20260209', name: 'web_search', max_uses: 4 }
      ], 'Remake');
      const recipe = cleanRemake(result);
      if (!recipe.steps.length) throw new Error('Claude didn’t return a recipe — try again.');
      updateLiked(id, x => { x.recipe = recipe; });
      remakeOpen.add(id);
      remakeStatus.delete(id);
    } catch (err) {
      console.warn('Remake failed:', err);
      remakeStatus.set(id, { msg: err.message || 'Something went wrong — try again.', error: true });
    } finally {
      remaking.delete(id);
      renderLiked();
    }
  }

  // "@handle · video" from a TikTok URL, for a tidy label.
  function likedLabel(url) {
    try {
      const u = new URL(url);
      const handle = (u.pathname.match(/@[^/]+/) || [''])[0];
      return handle ? handle + ' · TikTok' : u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '');
    } catch (e) { return url; }
  }

  // "🛒 Add N to list": puts items ({ name, amount? }) on the shopping list.
  function shopButton(items, from) {
    const b = el('button', 'btn-secondary', '🛒 Add ' + items.length + ' to list');
    b.type = 'button';
    b.title = 'Add what you’d need to buy to your shopping list';
    b.addEventListener('click', () => ShoppingList.add(items, from));
    return b;
  }

  // Full recipe view. opts.meal: which meal "Log 1 serving" goes to (default: the Find a recipe picker).
  function buildRemake(r, opts) {
    opts = opts || {};
    const box = el('div', 'remake');
    const head = el('div');
    head.appendChild(el('div', 'remake-title', r.title));
    head.appendChild(el('div', 'remake-meta', [r.time, r.servings + (r.servings === 1 ? ' serving' : ' servings')].filter(Boolean).join(' · ')));
    box.appendChild(head);
    if (r.inspiration) box.appendChild(el('div', 'recipe-why', r.inspiration));

    const macros = el('div', 'recipe-macros');
    macros.append(el('b', null, fmtInt(r.kcal) + ' kcal'), el('span', null, 'P ' + round1(r.p) + 'g'),
      el('span', null, 'C ' + round1(r.c) + 'g'), el('span', null, 'F ' + round1(r.f) + 'g'), el('span', null, 'per ' + r.serving));
    box.appendChild(macros);

    const amountLi = (x, cls) => {
      const li = el('li', cls);
      if (x.amount) li.append(el('b', null, x.amount), document.createTextNode(' '));
      li.appendChild(document.createTextNode(x.item + (x.have === false ? ' (buy)' : '')));
      return li;
    };
    const cols = el('div', 'remake-cols');
    const left = el('div');
    left.appendChild(el('h4', null, 'Ingredients'));
    const ing = el('ul');
    r.ingredients.forEach(x => ing.appendChild(amountLi(x, x.have ? '' : 'missing')));
    left.appendChild(ing);
    if (r.seasoning.length) {
      const season = el('div', 'remake-season');
      season.appendChild(el('h4', null, 'Seasoning & sauce'));
      const ul = el('ul');
      r.seasoning.forEach(x => ul.appendChild(amountLi(x)));
      season.appendChild(ul);
      left.appendChild(season);
    }
    const right = el('div');
    right.appendChild(el('h4', null, 'Steps'));
    const ol = el('ol');
    r.steps.forEach(s => ol.appendChild(el('li', null, s)));
    right.appendChild(ol);
    if (r.tips.length) {
      const tips = el('div');
      tips.style.marginTop = '10px';
      tips.appendChild(el('h4', null, 'Make it hit'));
      const ul = el('ul', 'remake-tips');
      r.tips.forEach(t => ul.appendChild(el('li', null, t)));
      tips.appendChild(ul);
      right.appendChild(tips);
    }
    cols.append(left, right);
    box.appendChild(cols);

    const actions = el('div', 'recipe-item-actions');
    const log = el('button', 'btn-primary', 'Log 1 serving' + (opts.meal ? ' to ' + opts.meal : ''));
    log.type = 'button';
    log.addEventListener('click', () => logRecipe(r, opts.meal));
    actions.appendChild(log);
    const toBuy = r.ingredients.filter(x => !x.have).map(x => ({ name: x.item, amount: x.amount }));
    if (toBuy.length) actions.appendChild(shopButton(toBuy, r.title));
    box.appendChild(actions);
    return box;
  }

  function renderLiked() {
    const list = $('likedList');
    list.innerHTML = '';
    recipeState().liked.forEach(item => {
      const li = el('li', 'liked-item');
      const row = el('div', 'liked-row');
      const info = el('div', 'liked-info');
      const link = el('a', 'liked-link', likedLabel(item.url));
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = item.url;
      info.appendChild(link);
      if (item.note) info.appendChild(el('div', 'liked-note', item.note));
      row.appendChild(info);

      const busy = remaking.has(item.id);
      const go = el('button', item.recipe ? 'btn-secondary' : 'btn-primary', busy ? 'Working…' : item.recipe ? '↻ Remake' : '✦ Make my version');
      go.type = 'button';
      go.disabled = busy;
      go.title = 'Write a recipe like this one with your ingredients and goal';
      go.addEventListener('click', () => remake(item.id));
      row.appendChild(go);
      if (item.recipe) {
        const open = remakeOpen.has(item.id);
        const toggle = el('button', 'btn-secondary', open ? 'Hide recipe' : 'Show recipe');
        toggle.type = 'button';
        toggle.addEventListener('click', () => {
          if (open) remakeOpen.delete(item.id); else remakeOpen.add(item.id);
          renderLiked();
        });
        row.appendChild(toggle);
      }
      const del = el('button', 'icon-btn danger', '×');
      del.type = 'button';
      del.title = 'Remove';
      del.addEventListener('click', () => {
        const before = recipeState().liked;
        const s = recipeState();
        s.liked = s.liked.filter(x => x.id !== item.id);
        storeSet(RECIPE_KEY, s);
        renderLiked();
        Toast.show('Removed', { undo: () => { const s2 = recipeState(); s2.liked = before; storeSet(RECIPE_KEY, s2); renderLiked(); } });
      });
      row.appendChild(del);
      li.appendChild(row);

      const st = remakeStatus.get(item.id);
      if (st || busy) {
        const status = el('div', 'polish-status' + (st && st.error ? ' error' : ''));
        if (busy) status.appendChild(el('span', 'spinner'));
        status.appendChild(document.createTextNode(st ? st.msg : ''));
        li.appendChild(status);
      }
      if (item.recipe && remakeOpen.has(item.id)) li.appendChild(buildRemake(item.recipe));
      list.appendChild(li);
    });
  }

  function addLiked(e) {
    e.preventDefault();
    const form = e.target;
    const url = form.elements.namedItem('url').value.trim();
    const note = form.elements.namedItem('note').value.trim();
    if (!isTikTok(url)) {
      setRecipeStatus('That doesn’t look like a TikTok link — copy it from Share → Copy link.', true);
      return;
    }
    setRecipeStatus('');
    const s = recipeState();
    s.liked.unshift({ id: uid(), url, note, addedAt: Date.now() });
    storeSet(RECIPE_KEY, s);
    form.reset();
    renderLiked();
  }

  /* ----- Targets ----- */
  function openTargets() {
    const form = $('targetsForm');
    const g = getTargets();
    ['kcal', 'p', 'c', 'f'].forEach(k => { form.elements.namedItem(k).value = g[k]; });
    form.hidden = false;
    form.elements.namedItem('kcal').focus();
  }

  function init() {
    // Photo
    const dz = $('dropzone');
    $('mealPhoto').addEventListener('change', e => loadPhoto(e.target.files[0]));
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) loadPhoto(e.dataTransfer.files[0]);
    });
    $('analyzeBtn').addEventListener('click', analyzePhoto);
    $('photoNote').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); analyzePhoto(); } });
    $('photoCancel').addEventListener('click', () => { resetPhoto(); setPhotoStatus(''); });
    $('estimateAdd').addEventListener('click', addEstimateToLog);
    $('estimateDiscard').addEventListener('click', () => { resetPhoto(); setPhotoStatus(''); });

    // Recipe finder
    const pantryInput = $('pantryInput');
    pantryInput.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && pantryInput.value.trim()) {
        e.preventDefault();
        addPantryItems(pantryInput.value);
        pantryInput.value = '';
      } else if (e.key === 'Enter') {
        e.preventDefault();
        findRecipes();
      } else if (e.key === 'Backspace' && !pantryInput.value) {
        const s = recipeState();
        if (s.pantry.length) { s.pantry.pop(); saveRecipeState(s); }
      }
    });
    pantryInput.addEventListener('paste', e => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/[,\n]/.test(text)) { e.preventDefault(); addPantryItems(text); }
    });
    $('pantry').addEventListener('click', () => pantryInput.focus());
    fillMealSelect($('recipeMeal'));
    $('recipeMeal').addEventListener('change', renderRecipeForm);
    $('recipeFindBtn').addEventListener('click', findRecipes);
    $('likedAdd').addEventListener('submit', addLiked);
    renderRecipeForm();
    renderLiked();

    // Search + editor
    const search = $('foodSearch');
    search.addEventListener('input', renderResults);
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (localResults[0]) openEditor(localResults[0]);
      } else if (e.key === 'Escape') {
        search.value = '';
        renderResults();
      }
    });
    const editor = $('foodEditor');
    editor.addEventListener('submit', submitEditor);
    editor.addEventListener('input', updatePreview);
    $('editorCancel').addEventListener('click', closeEditor);
    $('customFoodBtn').addEventListener('click', () => openEditor(null));

    // Targets
    $('editTargetsBtn').addEventListener('click', () => {
      if ($('targetsForm').hidden) openTargets();
      else $('targetsForm').hidden = true;
    });
    $('targetsCancel').addEventListener('click', () => { $('targetsForm').hidden = true; });
    $('targetsForm').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      const g = getTargets();
      ['kcal', 'p', 'c', 'f'].forEach(k => { g[k] = toNum(form.elements.namedItem(k).value) || g[k]; });
      storeSet(TARGETS_KEY, g);
      form.hidden = true;
      renderSummary();
    });
  }

  function render() {
    $('nutriDate').textContent = formatDate(getActiveDateString());
    renderSummary();
    renderLog();
    renderRecipeForm();
    renderLiked();
    // Meal plan + shopping list live on this page too (js/mealplan.js); they may have synced from another device.
    if (typeof MealPlan !== 'undefined') { MealPlan.render(); ShoppingList.render(); }
  }

  // Used by the dashboard's Nutrition card.
  function snapshot() {
    const log = getLog();
    return { totals: totalsOf(log), targets: getTargets(), count: log.length };
  }

  // Used by the Daily review summary.
  function dayTotals(ds) {
    const log = storeGet('nutrition:' + ds) || [];
    return { totals: totalsOf(log), targets: getTargets(), count: log.length };
  }

  // Recipe pieces shared with the meal plan and shopping list (js/mealplan.js).
  const recipeKit = {
    pantry: () => recipeState().pantry.slice(),
    addPantryItems,
    goal: recipeGoal,
    targets: getTargets,
    savedRecipes: () => recipeState().liked.filter(x => x.recipe).map(x => x.recipe),
    cleanRecipe: cleanRemake,
    buildRecipe: buildRemake,
    logRecipe,
    meals: MEALS
  };

  return { init, render, snapshot, dayTotals, renderMacroRows, recipeKit };
})();

