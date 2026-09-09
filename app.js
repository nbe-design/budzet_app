/* Budžet — v1 skeleton. Vidi SPEC.md za model i pravila izračuna.
   Iznosi interno u CENTIMA (integer). */
'use strict';

/* ------------------------------------------------------------------ *
 * Seed (ugrađen; data-seed.json je referentna kopija za čitanje)
 * ------------------------------------------------------------------ */
const SEED = {
  version: 1,
  meta: { created: null, lastModified: null, deviceId: null },
  settings: { currency: 'EUR', startMonth: '2026-09', startingBalance: 0 },
  income: {
    recurring: [
      { id: 'inc-placa', name: 'Plaća', amount: 190000, day: 11 },
      { id: 'inc-najam', name: 'Najam', amount: 70000, day: 1 },
    ],
  },
  fixedCosts: [
    { id: 'fx-kredit',         name: 'Kredit',               amount: 96559, day: 1,  startMonth: null,      endMonth: null },
    { id: 'fx-osig-kredit',    name: 'Osiguranje kredita',   amount: 6032,  day: 11, startMonth: null,      endMonth: null },
    { id: 'fx-javni-prijevoz', name: 'Javni prijevoz',       amount: 4000,  day: 11, startMonth: null,      endMonth: null },
    { id: 'fx-vrtic-1',        name: 'Vrtić 1',              amount: 4000,  day: 1,  startMonth: null,      endMonth: null },
    { id: 'fx-vrtic-2',        name: 'Vrtić 2',              amount: 4000,  day: 1,  startMonth: null,      endMonth: null },
    { id: 'fx-teretana',       name: 'Teretana',             amount: 2560,  day: 1,  startMonth: null,      endMonth: null },
    { id: 'fx-dopunsko',       name: 'Dopunsko zdravstveno', amount: 1550,  day: 13, startMonth: null,      endMonth: null },
    { id: 'fx-bon',            name: 'Bon',                  amount: 1088,  day: 11, startMonth: null,      endMonth: null },
    { id: 'fx-claude',         name: 'Claude',               amount: 2250,  day: 11, startMonth: null,      endMonth: null },
    { id: 'fx-rata-banka-1',   name: 'Rata banka 1',         amount: 1667,  day: 11, startMonth: null,      endMonth: '2027-08' },
    { id: 'fx-rata-banka-2',   name: 'Rata banka 2',         amount: 5556,  day: 7,  startMonth: null,      endMonth: '2027-03' },
    { id: 'fx-kasko-pola',     name: 'Kasko (pola)',         amount: 25000, day: 15, startMonth: '2026-11', endMonth: '2026-11' },
  ],
  variableCategories: [
    { id: 'var-hrana',       name: 'Hrana',          plan: 30000 },
    { id: 'var-zivot',       name: 'Život',          plan: 20000 },
    { id: 'var-gorivo',      name: 'Gorivo',         plan: 15000 },
    { id: 'var-porez-najam', name: 'Porez na najam', plan: 5880 },
  ],
  pots: [
    { id: 'pot-ulaganja',    name: 'Ulaganja (T212)',                 type: 'savings', monthly: 22500, startMonth: '2026-09' },
    { id: 'pot-more',        name: 'More',                            type: 'sinking', monthly: 5000, targetAmount: 60000, dueMonth: 7,  startMonth: '2026-09' },
    { id: 'pot-kasko',       name: 'Kasko',                           type: 'sinking', monthly: 4167, targetAmount: 50000, dueMonth: 11, startMonth: '2026-12' },
    { id: 'pot-servis',      name: 'Servis auto',                     type: 'sinking', monthly: 3333, targetAmount: 40000, dueMonth: 5,  startMonth: '2026-09' },
    { id: 'pot-registracija',name: 'Registracija + osiguranje auto',  type: 'sinking', monthly: 3333, targetAmount: 40000, dueMonth: 7,  startMonth: '2026-09' },
    { id: 'pot-osig-doma',   name: 'Osiguranje doma',                 type: 'sinking', monthly: 501,  targetAmount: 6013,  dueMonth: 6,  startMonth: '2026-09' },
    { id: 'pot-osig-nezgoda',name: 'Osiguranje od nezgode',           type: 'sinking', monthly: 61,   targetAmount: 730,   dueMonth: 7,  startMonth: '2026-09' },
  ],
  months: {},
};

/* ------------------------------------------------------------------ *
 * Pomoćne funkcije
 * ------------------------------------------------------------------ */
const HR_MONTHS = ['siječanj','veljača','ožujak','travanj','svibanj','lipanj',
  'srpanj','kolovoz','rujan','listopad','studeni','prosinac'];

const uid = () => Math.random().toString(36).slice(2, 10);
const eur = (c) => (c / 100).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const parseEur = (s) => Math.round(parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) * 100) || 0;

function mk(y, m) { return `${y}-${String(m).padStart(2, '0')}`; }
function parseMk(s) { const [y, m] = s.split('-').map(Number); return { y, m }; }
function addMonths(s, n) {
  let { y, m } = parseMk(s);
  const total = y * 12 + (m - 1) + n;
  return mk(Math.floor(total / 12), (total % 12) + 1);
}
function cmpMk(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function monthName(s) { const { y, m } = parseMk(s); return `${HR_MONTHS[m - 1]} ${y}`; }
function daysInMonth(s) { const { y, m } = parseMk(s); return new Date(y, m, 0).getDate(); }
function todayMk() { const d = new Date(); return mk(d.getFullYear(), d.getMonth() + 1); }

function activeInMonth(item, month) {
  if (item.startMonth && cmpMk(month, item.startMonth) < 0) return false;
  if (item.endMonth && cmpMk(month, item.endMonth) > 0) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */
const KEY = 'budzet_data_v1';
const Store = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('load', e); }
    const fresh = structuredClone(SEED);
    fresh.meta.created = new Date().toISOString();
    fresh.meta.deviceId = uid();
    return fresh;
  },
  save(state) {
    state.meta.lastModified = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { alert('Spremanje nije uspjelo: ' + e.message); }
  },
  exportJson(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budzet-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  },
};

/* ------------------------------------------------------------------ *
 * Generiranje mjeseca iz konfiguracije
 * ------------------------------------------------------------------ */
function buildMonth(state, month, openingBalance) {
  const prev = addMonths(month, -1);
  const prevM = state.months[prev];

  const income = state.income.recurring.map(r => ({
    refId: r.id, name: r.name, planned: r.amount, actual: null, received: false, date: null,
  }));

  const fixed = state.fixedCosts.filter(f => activeInMonth(f, month)).map(f => ({
    refId: f.id, name: f.name, planned: f.amount, actual: null, paid: false, date: null,
  }));

  const variable = state.variableCategories.map(c => {
    let plan = c.plan;
    if (prevM) {
      const pv = prevM.variable.find(v => v.catId === c.id);
      if (pv) plan = pv.plan;
    }
    return { catId: c.id, name: c.name, plan, entries: [] };
  });

  const potContribs = state.pots.filter(p => cmpMk(month, p.startMonth) >= 0).map(p => ({
    potId: p.id, name: p.name, planned: p.monthly, actual: null, paid: false,
  }));

  const potSpends = [];
  for (const p of state.pots) {
    if (p.type === 'sinking' && p.dueMonth === parseMk(month).m && cmpMk(month, p.startMonth) >= 0) {
      potSpends.push({ id: uid(), potId: p.id, name: p.name, amount: p.targetAmount, note: 'predložak — uredi stvarni iznos', date: null, done: false });
    }
  }

  return { opened: true, closed: false, openingBalance, income, honorari: [], fixed, variable, potContribs, potSpends, adjustments: [] };
}

/* Osigura da su svi mjeseci od startMonth do ciljanog generirani i povezani. */
function ensureMonthChain(state, targetMonth) {
  let m = state.settings.startMonth;
  let opening = state.settings.startingBalance;
  const guard = 600;
  for (let i = 0; i < guard; i++) {
    if (!state.months[m] || !state.months[m].opened) {
      if (cmpMk(m, targetMonth) <= 0) state.months[m] = buildMonth(state, m, opening);
      else break;
    } else {
      state.months[m].openingBalance = opening;
    }
    const roll = computeMonth(state, m);
    opening = roll.closingBalance;
    if (m === targetMonth) break;
    m = addMonths(m, 1);
  }
}

/* ------------------------------------------------------------------ *
 * Izračuni
 * ------------------------------------------------------------------ */
function sum(arr, f) { return arr.reduce((a, x) => a + (f(x) || 0), 0); }

function computeMonth(state, month) {
  const M = state.months[month];
  if (!M) return null;

  const incomeActual = sum(M.income, i => i.received ? (i.actual ?? i.planned) : 0)
                     + sum(M.honorari, h => h.toAccount);
  const incomePlanned = sum(M.income, i => i.planned);

  const fixedActual = sum(M.fixed, f => f.paid ? (f.actual ?? f.planned) : 0);
  const fixedPlanned = sum(M.fixed, f => f.planned);

  const varActual = sum(M.variable, c => sum(c.entries, e => e.amount));
  const varPlanned = sum(M.variable, c => c.plan);

  // doprinosi u savings lonce stvarno napuštaju račun
  const savingsIds = new Set(state.pots.filter(p => p.type === 'savings').map(p => p.id));
  const savingsContribActual = sum(M.potContribs, pc => pc.paid && savingsIds.has(pc.potId) ? (pc.actual ?? pc.planned) : 0);

  // sinking računi plaćeni ovaj mjesec (novac stvarno odlazi)
  const sinkingSpend = sum(M.potSpends, s => s.done ? s.amount : 0);

  const adjust = sum(M.adjustments, a => a.amount);

  const closingBalance = M.openingBalance + incomeActual - fixedActual - varActual
    - savingsContribActual - sinkingSpend + adjust;

  const closingPlanned = M.openingBalance + incomePlanned - fixedPlanned - varPlanned
    - sum(M.potContribs, pc => savingsIds.has(pc.potId) ? pc.planned : 0)
    - sum(M.potSpends, s => s.amount) + adjust;

  return {
    month, incomeActual, incomePlanned, fixedActual, fixedPlanned,
    varActual, varPlanned, savingsContribActual, sinkingSpend, adjust,
    closingBalance, closingPlanned,
  };
}

/* Stanje sinking lonca zaključno s (i uključujući) danim mjesecom. */
function potBalance(state, potId, uptoMonth) {
  let bal = 0;
  for (const m of Object.keys(state.months).sort()) {
    if (uptoMonth && cmpMk(m, uptoMonth) > 0) continue;
    const M = state.months[m];
    for (const pc of M.potContribs) if (pc.potId === potId && pc.paid) bal += (pc.actual ?? pc.planned);
    for (const s of M.potSpends) if (s.potId === potId && s.done) bal -= s.amount;
  }
  return bal;
}

function latestOpenMonth(state) {
  const opened = Object.keys(state.months).filter(m => state.months[m].opened).sort();
  return opened[opened.length - 1] || state.settings.startMonth;
}

/* Stanje računa = zatvarajuće stanje zadnjeg otvorenog mjeseca. */
function accountBalance(state) {
  const last = latestOpenMonth(state);
  const roll = computeMonth(state, last);
  return roll ? roll.closingBalance : state.settings.startingBalance;
}

/* Slobodno za potrošiti = stanje računa − Σ svih sinking lonaca. */
function freeToSpend(state) {
  const last = latestOpenMonth(state);
  let reserved = 0;
  for (const p of state.pots) if (p.type === 'sinking') reserved += potBalance(state, p.id, last);
  return accountBalance(state) - reserved;
}

/* Projekcija: hoće li sinking lonac biti pun do dueMonth. */
function potForecast(state, pot) {
  const cur = todayMk();
  const bal = potBalance(state, pot.id, latestOpenMonth(state));
  if (pot.type === 'savings') return { bal, shortfall: 0, dueLabel: null };
  // sljedeći dueMonth (mora biti i nakon što lonac uopće počne)
  let { y, m } = parseMk(cur);
  let dueY = y;
  if (pot.dueMonth <= m) dueY = y + 1;
  let dueKey = mk(dueY, pot.dueMonth);
  const firstDue = pot.startMonth && cmpMk(dueKey, pot.startMonth) < 0;
  if (firstDue) { dueY += 1; dueKey = mk(dueY, pot.dueMonth); }
  const monthsLeft = (dueY * 12 + pot.dueMonth) - (y * 12 + m);
  const projected = bal + monthsLeft * pot.monthly;
  const shortfall = Math.max(0, pot.targetAmount - projected);
  return { bal, projected, shortfall, monthsLeft, dueLabel: monthName(dueKey) };
}

/* ------------------------------------------------------------------ *
 * Stanje aplikacije / render
 * ------------------------------------------------------------------ */
let state = Store.load();
let currentMonth = latestOpenMonth(state);
let currentView = 'dashboard';

function persist() { Store.save(state); }

function setMonth(m) { currentMonth = m; render(); }
function setView(v) {
  currentView = v;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === v));
  render();
}

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
};

function render() {
  document.getElementById('month-label').textContent = monthName(currentMonth);
  const view = document.getElementById('view');
  view.innerHTML = '';
  const M = state.months[currentMonth];
  if (!M || !M.opened) { view.append(renderClosedMonth()); return; }
  const fn = { dashboard: renderDashboard, month: renderMonth, pots: renderPots, analysis: renderAnalysis, settings: renderSettings }[currentView];
  view.append(fn());
}

function renderClosedMonth() {
  const prev = addMonths(currentMonth, -1);
  const canOpen = state.months[prev] && state.months[prev].opened;
  return el('div', { class: 'card' },
    el('h2', {}, 'Mjesec nije otvoren'),
    el('p', { class: 'notice' }, canOpen
      ? `Otvori ${monthName(currentMonth)} da počneš unos. Početno stanje preuzima se iz ${monthName(prev)}.`
      : `Prvo otvori ranije mjesece (${monthName(prev)}).`),
    canOpen ? el('button', { class: 'primary', onclick: () => { ensureMonthChain(state, currentMonth); persist(); render(); } }, `Otvori ${monthName(currentMonth)}`) : null,
  );
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const wrap = el('div');
  const roll = computeMonth(state, currentMonth);
  const M = state.months[currentMonth];
  const free = freeToSpend(state);

  const freeCard = el('div', { class: 'card' },
    el('h2', {}, 'Slobodno za potrošiti'),
    el('div', { class: 'big-number ' + (free < 0 ? 'neg' : '') }, eur(free)),
    el('p', { class: 'notice' }, `Stanje računa ${eur(accountBalance(state))} − rezerve u loncima`),
  );
  wrap.append(freeCard);

  // dnevni budžet (preostali plan varijabilnih diskrecijskih / preostali dani)
  const spentVar = sum(M.variable, c => sum(c.entries, e => e.amount));
  const planVar = sum(M.variable, c => c.plan);
  const leftVar = planVar - spentVar;
  const dim = daysInMonth(currentMonth);
  const { y, m } = parseMk(currentMonth);
  const now = new Date();
  const isThisMonth = (now.getFullYear() === y && now.getMonth() + 1 === m);
  const daysLeft = isThisMonth ? Math.max(1, dim - now.getDate() + 1) : dim;
  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Dnevni budžet (varijabilno)'),
    el('div', { class: 'big-number ' + (leftVar < 0 ? 'neg' : '') }, eur(Math.round(leftVar / daysLeft))),
    el('p', { class: 'notice' }, `Ostalo ${eur(leftVar)} varijabilnog plana • ${daysLeft} ${isThisMonth ? 'dana do kraja mjeseca' : 'dana'}`),
  ));

  // projekcija kraja mjeseca
  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Projekcija kraja mjeseca'),
    row('Planirani ostatak', eur(roll.closingPlanned)),
    row('Trenutni (stvarni) ostatak', eur(roll.closingBalance)),
  ));

  // upozorenja
  const alerts = [];
  const placa = M.income.find(i => i.refId === 'inc-placa');
  if (placa && !placa.received) alerts.push('Plaća još nije unesena.');
  for (const f of M.fixed) if (!f.paid) {
    const dueDay = (state.fixedCosts.find(x => x.refId === f.refId) || {}).day;
  }
  const dueThisWeek = M.fixed.filter(f => !f.paid).map(f => {
    const cfg = state.fixedCosts.find(x => x.id === f.refId);
    return { name: f.name, day: cfg ? cfg.day : 1, amount: f.planned };
  }).sort((a, b) => a.day - b.day);
  for (const p of state.pots) {
    const fc = potForecast(state, p);
    if (fc.shortfall > 0) alerts.push(`Lonac "${p.name}": manjak ${eur(fc.shortfall)} do ${fc.dueLabel}.`);
  }
  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Za pažnju'),
    alerts.length ? el('div', {}, alerts.map(a => el('div', { class: 'row' }, el('span', { class: 'label' }, a)))) : el('p', { class: 'notice' }, 'Sve pod kontrolom.'),
    dueThisWeek.length ? el('div', { style: 'margin-top:10px' },
      el('h2', {}, 'Neplaćeni fiksni'),
      dueThisWeek.map(d => row(`${d.name} (${d.day}.)`, eur(d.amount)))) : null,
  ));

  wrap.append(el('button', { class: 'primary', onclick: openHonorarModal }, '+ Unesi honorar'));
  return wrap;
}

function row(label, amount, sub) {
  return el('div', { class: 'row' },
    el('span', { class: 'label' }, label, sub ? el('span', { class: 'sub' }, ' · ' + sub) : null),
    el('span', { class: 'amount' }, amount),
  );
}

/* ---------- Mjesec ---------- */
function renderMonth() {
  const wrap = el('div');
  const M = state.months[currentMonth];
  const roll = computeMonth(state, currentMonth);

  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Sažetak mjeseca'),
    row('Početno stanje', eur(M.openingBalance)),
    row('Prihodi (stvarno)', eur(roll.incomeActual)),
    row('Fiksni (stvarno)', '−' + eur(roll.fixedActual)),
    row('Varijabilno (stvarno)', '−' + eur(roll.varActual)),
    row('Ulaganja + sinking računi', '−' + eur(roll.savingsContribActual + roll.sinkingSpend)),
    row('Ostatak', eur(roll.closingBalance)),
    M.closed ? el('span', { class: 'pill warn' }, 'zaključen') : el('button', { class: 'ghost', onclick: () => { M.closed = true; persist(); render(); } }, 'Označi zaključenim'),
  ));

  // Prihodi
  const incCard = el('div', { class: 'card' }, el('h2', {}, 'Prihodi'));
  for (const i of M.income) {
    incCard.append(checkline(i.received, `${i.name}`, eur(i.actual ?? i.planned), (v) => { i.received = v; if (v && i.date == null) i.date = new Date().toISOString(); persist(); render(); }));
  }
  for (const h of M.honorari) incCard.append(row(`Honorar → račun`, eur(h.toAccount), `ulaganja ${eur(h.toInvest)}`));
  wrap.append(incCard);

  // Fiksni
  const fxCard = el('div', { class: 'card' }, el('h2', {}, 'Fiksni troškovi'));
  for (const f of M.fixed) {
    fxCard.append(checkline(f.paid, f.name, '−' + eur(f.actual ?? f.planned), (v) => { f.paid = v; if (v && f.date == null) f.date = new Date().toISOString(); persist(); render(); }));
  }
  wrap.append(fxCard);

  // Varijabilno
  const vCard = el('div', { class: 'card' }, el('h2', {}, 'Varijabilno'));
  for (const c of M.variable) {
    const spent = sum(c.entries, e => e.amount);
    vCard.append(el('div', { class: 'row' },
      el('span', { class: 'label' }, c.name, el('span', { class: 'sub' }, ` · ${eur(spent)} / ${eur(c.plan)}`)),
      el('span', { class: 'amount ' + (spent > c.plan ? 'neg' : 'muted') }, spent > c.plan ? '+' + eur(spent - c.plan) : eur(c.plan - spent) + ' ostalo'),
    ));
    const amt = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00' });
    const note = el('input', { type: 'text', placeholder: 'bilješka' });
    const add = () => { const v = parseEur(amt.value); if (!v) return; c.entries.push({ id: uid(), amount: v, note: note.value, date: new Date().toISOString() }); persist(); render(); };
    amt.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    note.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    vCard.append(el('div', { class: 'inline-add' }, amt, note, el('button', { class: 'ghost', onclick: add }, '+')));
    if (c.entries.length) {
      vCard.append(el('div', { style: 'margin-top:6px' }, c.entries.slice().reverse().map(e =>
        el('div', { class: 'row' },
          el('span', { class: 'sub' }, (e.note || '—') + ' · ' + e.date.slice(5, 10)),
          el('span', { class: 'amount sub' }, '−' + eur(e.amount),
            el('button', { class: 'ghost', style: 'margin-left:8px;padding:2px 8px', onclick: () => { c.entries = c.entries.filter(x => x.id !== e.id); persist(); render(); } }, '×')),
        ))));
    }
  }
  wrap.append(vCard);

  // Doprinosi loncima
  const pcCard = el('div', { class: 'card' }, el('h2', {}, 'Uplate u lonce'));
  for (const pc of M.potContribs) {
    pcCard.append(checkline(pc.paid, pc.name, '−' + eur(pc.actual ?? pc.planned), (v) => { pc.paid = v; persist(); render(); }));
  }
  wrap.append(pcCard);

  // Sinking računi koji dospijevaju
  if (M.potSpends.length) {
    const psCard = el('div', { class: 'card' }, el('h2', {}, 'Godišnji računi ovaj mjesec'));
    for (const s of M.potSpends) {
      psCard.append(checkline(s.done, `${s.name}`, '−' + eur(s.amount), (v) => { s.done = v; persist(); render(); }));
    }
    wrap.append(psCard);
  }

  // Otvaranje sljedećeg mjeseca
  const next = addMonths(currentMonth, 1);
  if (!state.months[next] || !state.months[next].opened) {
    wrap.append(el('button', { class: 'primary', onclick: () => { ensureMonthChain(state, next); currentMonth = next; persist(); render(); } }, `Otvori ${monthName(next)}`));
  }
  return wrap;
}

function checkline(checked, label, amount, onToggle) {
  const cb = el('input', { type: 'checkbox' });
  cb.checked = !!checked;
  cb.addEventListener('change', () => onToggle(cb.checked));
  const line = el('label', { class: 'checkline' + (checked ? ' paid' : '') }, cb,
    el('span', { class: 'label', style: 'flex:1' }, label),
    el('span', { class: 'amount' }, amount));
  return line;
}

/* ---------- Lonci ---------- */
function renderPots() {
  const wrap = el('div');
  for (const p of state.pots) {
    const fc = potForecast(state, p);
    const card = el('div', { class: 'card' },
      el('h2', {}, p.name + (p.type === 'savings' ? ' · štednja' : '')),
      el('div', { class: 'big-number' }, eur(fc.bal)),
    );
    if (p.type === 'sinking') {
      card.append(el('p', { class: 'notice' }, `Cilj ${eur(p.targetAmount)} do ${fc.dueLabel} • ${p.monthly ? eur(p.monthly) + '/mj' : ''}`));
      if (fc.shortfall > 0) card.append(el('span', { class: 'pill bad' }, `manjak ${eur(fc.shortfall)}`));
      else card.append(el('span', { class: 'pill good' }, 'na putu'));
    } else {
      card.append(el('p', { class: 'notice' }, `Raste ${eur(p.monthly)}/mj + honorari`));
    }
    wrap.append(card);
  }
  return wrap;
}

/* ---------- Analiza ---------- */
function renderAnalysis() {
  const wrap = el('div');
  const months = Object.keys(state.months).filter(m => state.months[m].opened).sort();

  // potrošnja po mjesecima (fiksni stvarni + varijabilni stvarni + sinking spend)
  const data = months.map(m => {
    const r = computeMonth(state, m);
    return { m, total: r.fixedActual + r.varActual + r.sinkingSpend };
  });
  const max = Math.max(1, ...data.map(d => d.total));
  const chart = el('div', { class: 'bar-chart' });
  for (const d of data) {
    chart.append(el('div', { class: 'bar', style: `height:${Math.round(d.total / max * 100)}%`, title: eur(d.total) },
      el('span', {}, HR_MONTHS[parseMk(d.m).m - 1].slice(0, 3))));
  }
  wrap.append(el('div', { class: 'card' }, el('h2', {}, 'Potrošnja po mjesecima'), chart, el('div', { style: 'height:20px' })));

  // prosjek po kategoriji
  const catCard = el('div', { class: 'card' }, el('h2', {}, 'Prosjek po kategoriji (varijabilno)'));
  for (const c of state.variableCategories) {
    let tot = 0, n = 0;
    for (const m of months) { const mc = state.months[m].variable.find(v => v.catId === c.id); if (mc) { tot += sum(mc.entries, e => e.amount); n++; } }
    catCard.append(row(c.name, n ? eur(Math.round(tot / n)) + '/mj' : '—'));
  }
  wrap.append(catCard);

  // top 5 stavki ovog mjeseca
  const M = state.months[currentMonth];
  const items = [];
  if (M) {
    for (const f of M.fixed) if (f.paid) items.push({ name: f.name, amount: f.actual ?? f.planned });
    for (const c of M.variable) for (const e of c.entries) items.push({ name: `${c.name}: ${e.note || '—'}`, amount: e.amount });
    for (const s of M.potSpends) if (s.done) items.push({ name: s.name, amount: s.amount });
  }
  items.sort((a, b) => b.amount - a.amount);
  const topCard = el('div', { class: 'card' }, el('h2', {}, `Top 5 — ${monthName(currentMonth)}`));
  for (const it of items.slice(0, 5)) topCard.append(row(it.name, '−' + eur(it.amount)));
  if (!items.length) topCard.append(el('p', { class: 'notice' }, 'Nema podataka.'));
  wrap.append(topCard);

  // plan vs ostvareno kumulativno (godina currentMonth)
  const yr = parseMk(currentMonth).y;
  let planCum = 0, actCum = 0;
  for (const m of months) {
    if (parseMk(m).y !== yr) continue;
    const r = computeMonth(state, m);
    planCum += r.fixedPlanned + r.varPlanned;
    actCum += r.fixedActual + r.varActual;
  }
  wrap.append(el('div', { class: 'card' },
    el('h2', {}, `Plan vs. ostvareno — ${yr}. (kumulativno)`),
    row('Planirano', eur(planCum)),
    row('Ostvareno', eur(actCum)),
    row('Razlika', (actCum - planCum > 0 ? '+' : '') + eur(actCum - planCum)),
  ));
  return wrap;
}

/* ---------- Postavke ---------- */
function renderSettings() {
  const wrap = el('div');
  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Podaci'),
    row('Prvi mjesec', monthName(state.settings.startMonth)),
    row('Početno stanje', eur(state.settings.startingBalance)),
    el('div', { class: 'inline-add', style: 'margin-top:10px' },
      el('button', { class: 'ghost', onclick: () => Store.exportJson(state) }, 'Izvezi JSON'),
      el('button', { class: 'ghost', onclick: importJson }, 'Uvezi JSON'),
      el('button', { class: 'ghost', onclick: () => { if (confirm('Obrisati sve i vratiti seed?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Reset'),
    ),
  ));

  wrap.append(listCard('Prihodi (mjesečni)', state.income.recurring.map(r => `${r.name} · ${eur(r.amount)} · ${r.day}.`)));
  wrap.append(listCard('Fiksni troškovi', state.fixedCosts.map(f => `${f.name} · ${eur(f.amount)} · ${f.day}.${f.endMonth ? ' · do ' + f.endMonth : ''}`)));
  wrap.append(listCard('Varijabilne kategorije', state.variableCategories.map(c => `${c.name} · plan ${eur(c.plan)}`)));
  wrap.append(listCard('Lonci', state.pots.map(p => `${p.name} · ${eur(p.monthly)}/mj · ${p.type}${p.dueMonth ? ' · dospijeće ' + HR_MONTHS[p.dueMonth - 1] : ''}`)));

  wrap.append(el('p', { class: 'notice' }, 'Uređivanje stavki u postavkama — sljedeća iteracija. Za sad se mijenja kroz Izvoz/Uvoz JSON ili izravno u kodu (SEED).'));
  return wrap;
}
function listCard(title, lines) {
  return el('div', { class: 'card' }, el('h2', {}, title), lines.map(l => el('div', { class: 'row' }, el('span', { class: 'label' }, l))));
}
function importJson() {
  const inp = el('input', { type: 'file', accept: 'application/json' });
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { state = JSON.parse(r.result); Store.save(state); currentMonth = latestOpenMonth(state); render(); } catch (e) { alert('Neispravan JSON: ' + e.message); } };
    r.readAsText(f);
  });
  inp.click();
}

/* ---------- Honorar modal ---------- */
function openHonorarModal() {
  const gross = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00' });
  const invest = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00' });
  const modal = el('div', { class: 'modal' },
    el('h3', {}, 'Unos honorara'),
    el('div', { class: 'field' }, el('label', {}, 'Bruto iznos honorara'), gross),
    el('div', { class: 'field' }, el('label', {}, 'Koliko ide u Ulaganja (T212)?'), invest),
    el('p', { class: 'notice' }, 'Ostatak se pribraja stanju računa.'),
    el('div', { class: 'actions' },
      el('button', { class: 'ghost', onclick: closeModal }, 'Odustani'),
      el('button', { class: 'primary', onclick: () => {
        const g = parseEur(gross.value), inv = Math.min(g, parseEur(invest.value));
        if (!g) return closeModal();
        const M = state.months[currentMonth];
        M.honorari.push({ id: uid(), gross: g, toInvest: inv, toAccount: g - inv, date: new Date().toISOString(), note: '' });
        if (inv > 0) M.potContribs.push({ potId: 'pot-ulaganja', name: 'Ulaganja (T212) — honorar', planned: inv, actual: inv, paid: true });
        persist(); closeModal(); render();
      } }, 'Spremi'),
    ),
  );
  showModal(modal);
}
function showModal(node) { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.append(node); r.hidden = false; }
function closeModal() { const r = document.getElementById('modal-root'); r.hidden = true; r.innerHTML = ''; }
document.getElementById('modal-root').addEventListener('click', e => { if (e.target.id === 'modal-root') closeModal(); });

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
ensureMonthChain(state, state.settings.startMonth);
if (!Object.keys(state.months).length) ensureMonthChain(state, state.settings.startMonth);
persist();
currentMonth = latestOpenMonth(state);

document.getElementById('btn-month-prev').addEventListener('click', () => setMonth(addMonths(currentMonth, -1)));
document.getElementById('btn-month-next').addEventListener('click', () => setMonth(addMonths(currentMonth, 1)));
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
