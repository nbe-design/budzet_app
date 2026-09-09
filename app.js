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
    // godišnji jednokratni trošak, ne skuplja se kroz lonac (vidi SPEC.md odluku #14)
    { id: 'fx-osig-nezgoda',   name: 'Osiguranje od nezgode', amount: 730, day: 15, startMonth: '2027-07', endMonth: null, recurrence: 'annual' },
    { id: 'fx-hrana',          name: 'Hrana',                amount: 35000, day: 11, startMonth: null,      endMonth: null },
  ],
  // analyze: true → uključeno u "Prosjek po kategoriji" u Analizi (vidi SPEC.md odluku #18).
  variableCategories: [
    { id: 'var-zivot',       name: 'Život',          plan: 20000, analyze: true },
    { id: 'var-gorivo',      name: 'Gorivo',         plan: 15000, analyze: true },
    { id: 'var-porez-najam', name: 'Porez na najam', plan: 5880 },
    { id: 'var-ulaganja',    name: 'Ulaganja (T212)', plan: 22500 },
  ],
  // nextDue = "YYYY-MM" sljedećeg dospijeća. Prvi ciklus koristi ratu = cilj / preostali mjeseci
  // do prvog dospijeća (da lonac stigne na cilj bez manjka); nakon dospijeća app automatski
  // resetira na standardnu ratu = cilj / 12 i nextDue += 12 mj. (vidi SPEC.md odluku #15).
  pots: [
    { id: 'pot-more',        name: 'More',                            type: 'sinking', monthly: 5450, targetAmount: 60000, nextDue: '2027-07', startMonth: '2026-09' },
    { id: 'pot-kasko',       name: 'Kasko',                           type: 'sinking', monthly: 3333, targetAmount: 50000, nextDue: '2027-11', startMonth: '2026-09' },
    { id: 'pot-servis',      name: 'Servis auto',                     type: 'sinking', monthly: 4444, targetAmount: 40000, nextDue: '2027-05', startMonth: '2026-09' },
    { id: 'pot-registracija',name: 'Registracija + osiguranje auto',  type: 'sinking', monthly: 3636, targetAmount: 40000, nextDue: '2027-07', startMonth: '2026-09' },
    { id: 'pot-osig-doma',   name: 'Osiguranje doma',                 type: 'sinking', monthly: 601,  targetAmount: 6013,  nextDue: '2027-06', startMonth: '2026-09' },
  ],
  months: {},
};

/* ------------------------------------------------------------------ *
 * Pomoćne funkcije
 * ------------------------------------------------------------------ */
const HR_MONTHS = ['siječanj','veljača','ožujak','travanj','svibanj','lipanj',
  'srpanj','kolovoz','rujan','listopad','studeni','prosinac'];

const uid = () => Math.random().toString(36).slice(2, 10);
const eurPlain = (c) => (c / 100).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (c) => eurPlain(c) + ' €';
const parseEur = (s) => {
  let str = String(s).trim().replace(/\s/g, '');
  if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.'); // "1.850,00" (hr format) → "1850.00"
  return Math.round(parseFloat(str) * 100) || 0;
};

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
  if (item.recurrence === 'annual') return parseMk(month).m === parseMk(item.startMonth).m;
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
  /* Ravna lista svih stvarnih (actual) transakcija, za pregled u Excelu. ';' delimiter
     i zarez kao decimalni znak jer je to hr-HR Excel default. */
  exportCsv(state) {
    const esc = (s) => { s = String(s ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Mjesec', 'Datum', 'Tip', 'Naziv', 'Iznos']];
    for (const m of Object.keys(state.months).sort()) {
      const M = state.months[m];
      if (!M.opened) continue;
      for (const i of M.income) if (i.received) rows.push([m, (i.date || '').slice(0, 10), 'Prihod', i.name, eurPlain(i.actual ?? i.planned)]);
      for (const h of M.honorari) rows.push([m, (h.date || '').slice(0, 10), 'Honorar', 'Honorar → račun', eurPlain(h.toAccount)]);
      for (const f of M.fixed) if (f.paid) rows.push([m, (f.date || '').slice(0, 10), 'Fiksni', f.name, '-' + eurPlain(f.actual ?? f.planned)]);
      for (const c of M.variable) for (const e of c.entries) rows.push([m, (e.date || '').slice(0, 10), 'Varijabilno', `${c.name}: ${e.note || ''}`, '-' + eurPlain(e.amount)]);
      for (const pc of M.potContribs) if (pc.paid) rows.push([m, '', 'Uplata u lonac', pc.name, '-' + eurPlain(pc.actual ?? pc.planned)]);
      for (const s of M.potSpends) if (s.done) rows.push([m, (s.date || '').slice(0, 10), 'Godišnji račun', s.name, '-' + eurPlain(s.amount)]);
      for (const a of M.adjustments) rows.push([m, '', 'Prilagodba', a.note || '', (a.amount >= 0 ? '' : '-') + eurPlain(Math.abs(a.amount))]);
    }
    const csv = rows.map(r => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budzet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  },
};

/* ------------------------------------------------------------------ *
 * Google Drive sinkronizacija (pohrana v2) — vidi SPEC.md odjeljak 10
 * ------------------------------------------------------------------ */
const GOOGLE_CLIENT_ID = '88610669220-vudppbquk5p9nn6dds92kmh1stdta6sa.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILENAME = 'budzet.json';
const DRIVE_BACKUP_KEY = 'budzet_drive_last_backup';

const Drive = {
  tokenClient: null,
  token: null,
  fileId: null,
  fileModifiedTime: null,
  status: 'signed-out', // 'signed-out' | 'syncing' | 'signed-in' | 'error'
  error: null,

  init() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) return;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => this._onToken(resp),
    });
    // tiha prijava — bez popupa, radi ako je korisnik već jednom pristao na ovom uređaju
    this.tokenClient.requestAccessToken({ prompt: '' });
  },

  signIn() {
    if (!this.tokenClient) { alert('Google Drive se još učitava — pokušaj opet za par sekundi.'); return; }
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  },

  signOut() {
    if (this.token && google.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(this.token, () => {});
    this.token = null; this.fileId = null; this.status = 'signed-out'; this.error = null;
    render();
  },

  async _onToken(resp) {
    if (resp.error) { this.status = 'signed-out'; render(); return; }
    this.token = resp.access_token;
    this.status = 'syncing'; render();
    try {
      await this._syncOnConnect();
      this.status = 'signed-in';
    } catch (e) {
      console.warn('Drive sync', e);
      this.status = 'error'; this.error = e.message;
    }
    render();
  },

  async _authFetch(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`Drive API ${res.status}`);
    return res;
  },

  async _findFile(exactName) {
    const q = encodeURIComponent(`name='${exactName.replace(/'/g, "\\'")}' and trashed=false`);
    const res = await this._authFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
    return (await res.json()).files || [];
  },

  async _listBackups() {
    const q = encodeURIComponent(`name contains 'budzet-backup-' and trashed=false`);
    const res = await this._authFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=100`);
    return (await res.json()).files || [];
  },

  async _createFile(name, contentStr) {
    const boundary = 'budzet_' + uid();
    const metadata = JSON.stringify({ name });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
      + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${contentStr}\r\n--${boundary}--`;
    const res = await this._authFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return res.json();
  },

  async _updateFile(fileId, contentStr) {
    const res = await this._authFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: contentStr,
    });
    return res.json();
  },

  async _downloadFile(fileId) {
    const res = await this._authFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return res.text();
  },

  async _deleteFile(fileId) {
    await this._authFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
  },

  async _pruneBackups() {
    const files = await this._listBackups();
    for (const f of files.slice(20)) await this._deleteFile(f.id).catch(() => {});
  },

  /* Pri spajanju: nađi budzet.json na Driveu. Ako je novije od lokalnog → pitaj za učitavanje. */
  async _syncOnConnect() {
    const files = await this._findFile(DRIVE_FILENAME);
    if (!files.length) {
      const created = await this._createFile(DRIVE_FILENAME, JSON.stringify(state));
      this.fileId = created.id; this.fileModifiedTime = created.modifiedTime;
      return;
    }
    const f = files[0];
    this.fileId = f.id; this.fileModifiedTime = f.modifiedTime;
    const remoteModified = new Date(f.modifiedTime).getTime();
    const localModified = state.meta.lastModified ? new Date(state.meta.lastModified).getTime() : 0;
    if (remoteModified > localModified + 5000) {
      if (confirm(`Na Google Driveu postoji novija verzija podataka (${new Date(f.modifiedTime).toLocaleString('hr-HR')}). Učitati je? (Zamijenit će trenutne podatke na ovom uređaju.)`)) {
        const text = await this._downloadFile(this.fileId);
        state = JSON.parse(text);
        Store.save(state);
        currentMonth = latestOpenMonth(state);
      }
    }
  },

  /* Pošalji lokalno stanje na Drive. Backup postojeće verzije prije prepisivanja (max 1×/24h). */
  async push() {
    if (!this.token || !this.fileId) return;
    try {
      const lastBackup = Number(localStorage.getItem(DRIVE_BACKUP_KEY) || 0);
      if (Date.now() - lastBackup > 24 * 3600 * 1000) {
        const text = await this._downloadFile(this.fileId).catch(() => null);
        if (text) {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          await this._createFile(`budzet-backup-${stamp}.json`, text);
          localStorage.setItem(DRIVE_BACKUP_KEY, String(Date.now()));
          this._pruneBackups();
        }
      }
      const updated = await this._updateFile(this.fileId, JSON.stringify(state));
      this.fileModifiedTime = updated.modifiedTime;
    } catch (e) {
      console.warn('Drive push', e);
    }
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
    if (p.type === 'sinking' && p.nextDue === month) {
      potSpends.push({ id: uid(), potId: p.id, name: p.name, amount: p.targetAmount, note: 'predložak — uredi stvarni iznos', date: null, done: false });
      // automatski reset ciklusa: sljedeća rata = cilj / 12, sljedeće dospijeće za godinu dana
      p.nextDue = addMonths(p.nextDue, 12);
      p.monthly = Math.round(p.targetAmount / 12);
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

/* Projekcija: hoće li sinking lonac biti pun do nextDue. */
function potForecast(state, pot) {
  const bal = potBalance(state, pot.id, latestOpenMonth(state));
  if (pot.type === 'savings') return { bal, shortfall: 0, dueLabel: null };
  const { y, m } = parseMk(todayMk());
  const { y: dueY, m: dueM } = parseMk(pot.nextDue);
  const monthsLeft = (dueY * 12 + dueM) - (y * 12 + m);
  const projected = bal + monthsLeft * pot.monthly;
  const shortfall = Math.max(0, pot.targetAmount - projected);
  return { bal, projected, shortfall, monthsLeft, dueLabel: monthName(pot.nextDue) };
}

function absDay(month, day) { const { y, m } = parseMk(month); return y * 372 + m * 31 + day; }

/* Sljedeća isplata plaće: ovaj mjesec (ako još nije primljena) ili iduci. */
function nextPayday(state) {
  const placa = state.income.recurring.find(r => r.id === 'inc-placa') || state.income.recurring[0];
  const cur = latestOpenMonth(state);
  const M = state.months[cur];
  const entry = M.income.find(i => i.refId === placa.id);
  const month = (entry && entry.received) ? addMonths(cur, 1) : cur;
  return { placa, month, day: placa.day };
}

/* Predviđeno stanje računa točno prije nego sljedeća plaća sjedne — trenutno stanje
   umanjeno za sve još neplaćene obveze koje dospijevaju do tada. Varijabilno se
   projicira po GOREM od (plan/dan, stvarni tempo/dan) — ako se već trošI više od
   plana, projekcija to uzima u obzir umjesto da se drži optimističkog plana. */
function projectedBeforePayday(state) {
  const cur = latestOpenMonth(state);
  const M = state.months[cur];
  const { placa, month: paydayMonth, day: paydayDay } = nextPayday(state);
  const paydayAbs = absDay(paydayMonth, paydayDay);
  const next = addMonths(cur, 1);

  let projected = accountBalance(state);

  // neplaćeni fiksni troškovi do isplate (ovaj mjesec iz M.fixed, iduci iz predloška)
  for (const f of state.fixedCosts) {
    for (const month of [cur, next]) {
      if (!activeInMonth(f, month)) continue;
      if (absDay(month, f.day) > paydayAbs) continue;
      if (month === cur) {
        const fm = M.fixed.find(x => x.refId === f.id);
        if (fm && fm.paid) continue;
        projected -= (fm ? (fm.actual ?? fm.planned) : f.amount);
      } else {
        projected -= f.amount;
      }
    }
  }
  // ostali (ne-plaća) prihodi koji još nisu primljeni a dolaze do isplate
  for (const r of state.income.recurring) {
    if (r.id === placa.id) continue;
    if (absDay(cur, r.day) > paydayAbs) continue;
    const im = M.income.find(x => x.refId === r.id);
    if (im && !im.received) projected += (im.actual ?? im.planned);
  }
  // neplaćeni doprinosi u lonce i godišnji računi ovaj mjesec
  for (const pc of M.potContribs) if (!pc.paid) projected -= (pc.actual ?? pc.planned);
  for (const s of M.potSpends) if (!s.done) projected -= s.amount;

  // varijabilno: preostali dani do isplate, po gorem od plan-tempa i stvarnog tempa
  const dim = daysInMonth(cur);
  const todayDate = new Date().getDate();
  const spentVar = sum(M.variable, c => sum(c.entries, e => e.amount));
  const planVar = sum(M.variable, c => c.plan);
  const planRate = planVar / dim;
  const actualRate = todayDate > 0 ? spentVar / todayDate : planRate;
  const rate = Math.max(planRate, actualRate);
  const windowEndDay = (paydayMonth === cur) ? Math.min(paydayDay, dim) : dim;
  const remainingDays = Math.max(0, windowEndDay - todayDate);
  projected -= Math.round(rate * remainingDays);

  return { amount: projected, paydayMonth, paydayDay };
}

/* ------------------------------------------------------------------ *
 * Stanje aplikacije / render
 * ------------------------------------------------------------------ */
let state = Store.load();
let currentMonth = latestOpenMonth(state);
let currentView = 'dashboard';
let settingsEdit = null; // { section: 'income'|'fixed'|'variable'|'pots', id: string|null } — id null = novi unos

function persist() {
  Store.save(state);
  if (Drive.status === 'signed-in') Drive.push();
}

function setMonth(m) { currentMonth = m; render(); }
function setView(v) {
  currentView = v;
  if (v !== 'settings') settingsEdit = null;
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
    (() => { const pb = projectedBeforePayday(state);
      return row(`Predviđeno stanje prije iduće plaće (${pb.paydayDay}. ${monthName(pb.paydayMonth)})`,
        eur(pb.amount), 'uzima u obzir trenutni tempo trošenja, ne samo plan');
    })(),
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
      dueThisWeek.map(d => row(`${d.name} (${d.day}. u mj.)`, eur(d.amount)))) : null,
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
    row('Sinking računi (godišnji)', '−' + eur(roll.sinkingSpend)),
    row('Ostatak', eur(roll.closingBalance)),
    M.closed ? el('span', { class: 'pill warn' }, 'zaključen') : el('button', { class: 'ghost', onclick: () => { M.closed = true; persist(); render(); } }, 'Označi zaključenim'),
  ));

  // Prihodi
  const incCard = el('div', { class: 'card' }, el('h2', {}, 'Prihodi'));
  for (const i of M.income) {
    incCard.append(checklineAmount(i.received, i.name, i.actual ?? i.planned,
      (v) => { i.received = v; if (v && i.date == null) i.date = new Date().toISOString(); persist(); render(); },
      (amt) => { i.actual = amt; persist(); render(); }));
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
    pcCard.append(checklineAmount(pc.paid, pc.name, pc.actual ?? pc.planned,
      (v) => { pc.paid = v; persist(); render(); },
      (amt) => { pc.actual = amt; persist(); render(); }));
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

/* Kao checkline, ali s uređivim iznosom (kad stvarni iznos odstupa od planiranog). */
function checklineAmount(checked, label, amountCents, onToggle, onAmount) {
  const cb = el('input', { type: 'checkbox' });
  cb.checked = !!checked;
  cb.addEventListener('change', () => onToggle(cb.checked));
  const amt = el('input', { type: 'text', inputmode: 'decimal', style: 'width:100px;text-align:right;flex:none' });
  amt.value = (amountCents / 100).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const commit = () => onAmount(parseEur(amt.value));
  amt.addEventListener('change', commit);
  amt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); amt.blur(); } });
  return el('div', { class: 'checkline' + (checked ? ' paid' : '') }, cb,
    el('span', { class: 'label', style: 'flex:1' }, label), amt);
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

  // prosjek po kategoriji (samo kategorije koje ima smisla analizirati — vidi odluku #18)
  const catCard = el('div', { class: 'card' }, el('h2', {}, 'Prosjek po kategoriji (varijabilno)'));
  for (const c of state.variableCategories.filter(c => c.analyze)) {
    let tot = 0, n = 0;
    for (const m of months) { const mc = state.months[m].variable.find(v => v.catId === c.id); if (mc) { tot += sum(mc.entries, e => e.amount); n++; } }
    catCard.append(row(c.name, n ? eur(Math.round(tot / n)) + '/mj' : '—'));
  }
  wrap.append(catCard);

  // ukupno uloženo (Ulaganja T212) kroz sve mjesece — nastavak lonca-ideje, sad kao varijabilna kategorija
  let investedTotal = 0;
  for (const m of months) { const mc = state.months[m].variable.find(v => v.catId === 'var-ulaganja'); if (mc) investedTotal += sum(mc.entries, e => e.amount); }
  wrap.append(el('div', { class: 'card' }, el('h2', {}, 'Ulaganja (T212)'), row('Ukupno uloženo do sada', eur(investedTotal))));

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
    el('h2', {}, 'Google Drive sinkronizacija'),
    driveStatusNotice(),
    el('div', { class: 'inline-add', style: 'margin-top:10px' },
      (Drive.status === 'signed-out' || Drive.status === 'error')
        ? el('button', { class: 'primary', onclick: () => Drive.signIn() }, 'Prijavi se')
        : el('button', { class: 'ghost', onclick: () => Drive.signOut() }, 'Odjava'),
      Drive.status === 'signed-in'
        ? el('button', { class: 'ghost', onclick: async () => { await Drive.push(); render(); } }, 'Spremi na Drive sada')
        : null,
    ),
  ));

  wrap.append(el('div', { class: 'card' },
    el('h2', {}, 'Podaci'),
    row('Prvi mjesec', monthName(state.settings.startMonth)),
    startBalanceRow(),
    el('div', { class: 'inline-add', style: 'margin-top:10px' },
      el('button', { class: 'ghost', onclick: () => Store.exportJson(state) }, 'Izvezi JSON'),
      el('button', { class: 'ghost', onclick: () => Store.exportCsv(state) }, 'Izvezi CSV'),
      el('button', { class: 'ghost', onclick: importJson }, 'Uvezi JSON'),
      el('button', { class: 'ghost', onclick: () => { if (confirm('Ovo će TRAJNO izbrisati sve tvoje podatke (sve mjesece, unose, plaćanja) i vratiti app na početne postavke. Ovo se ne može poništiti — ako nisi siguran, prvo napravi "Izvezi JSON". Jesi li siguran da želiš nastaviti?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Reset'),
    ),
  ));

  wrap.append(el('p', { class: 'notice' }, 'Promjene ispod utječu na buduće mjesece (već otvoreni mjeseci se ne mijenjaju retroaktivno).'));

  wrap.append(renderIncomeSettings());
  wrap.append(renderFixedSettings());
  wrap.append(renderVariableSettings());
  wrap.append(renderPotsSettings());

  return wrap;
}

function startBalanceRow() {
  if (isEditing('meta', 'sb')) {
    const amt = el('input', { type: 'text', inputmode: 'decimal', value: eurPlain(state.settings.startingBalance), placeholder: '0,00' });
    const save = () => {
      state.settings.startingBalance = parseEur(amt.value);
      ensureMonthChain(state, latestOpenMonth(state)); // preračunaj openingBalance kroz već otvorene mjesece
      persist(); cancelEdit();
    };
    return el('div', { class: 'field' }, el('label', {}, 'Početno stanje (€)'), amt, formActions(save));
  }
  return el('div', { class: 'row' },
    el('span', { class: 'label' }, 'Početno stanje'),
    el('span', {}, eur(state.settings.startingBalance) + '  ',
      el('button', { class: 'ghost', style: 'padding:2px 8px', onclick: () => startEdit('meta', 'sb') }, 'Uredi')));
}

/* --- generički helperi za uređivanje popisa u Postavkama --- */
function startEdit(section, id) { settingsEdit = { section, id }; render(); }
function cancelEdit() { settingsEdit = null; render(); }
function isEditing(section, id) { return settingsEdit && settingsEdit.section === section && settingsEdit.id === id; }
function editRow(label, section, id) {
  return el('div', { class: 'row' },
    el('span', { class: 'label' }, label),
    el('span', {},
      el('button', { class: 'ghost', style: 'padding:2px 8px;margin-right:4px', onclick: () => startEdit(section, id) }, 'Uredi'),
      el('button', { class: 'ghost', style: 'padding:2px 8px', onclick: () => deleteSettingsItem(section, id) }, 'Obriši')));
}
function deleteSettingsItem(section, id) {
  if (!confirm('Obrisati ovu stavku? Ne utječe na već otvorene mjesece, samo na buduće.')) return;
  const arr = { income: state.income.recurring, fixed: state.fixedCosts, variable: state.variableCategories, pots: state.pots }[section];
  const idx = arr.findIndex(x => x.id === id);
  if (idx >= 0) arr.splice(idx, 1);
  persist(); render();
}
function formCard(...kids) { return el('div', { class: 'card', style: 'background:var(--surface-2);margin-top:8px' }, ...kids); }
function formActions(onSave) {
  return el('div', { class: 'actions' },
    el('button', { class: 'ghost', onclick: cancelEdit }, 'Odustani'),
    el('button', { class: 'primary', onclick: onSave }, 'Spremi'));
}
function field(label, inputEl) { return el('div', { class: 'field' }, el('label', {}, label), inputEl); }

/* --- Prihodi --- */
function renderIncomeSettings() {
  const card = el('div', { class: 'card' }, el('h2', {}, 'Prihodi (mjesečni)'));
  for (const r of state.income.recurring) {
    card.append(isEditing('income', r.id) ? incomeForm(r) : editRow(`${r.name} · ${eur(r.amount)} · ${r.day}. u mj.`, 'income', r.id));
  }
  card.append(isEditing('income', null) ? incomeForm(null) : el('button', { class: 'ghost', onclick: () => startEdit('income', null) }, '+ Dodaj prihod'));
  return card;
}
function incomeForm(r) {
  const name = el('input', { type: 'text', value: r?.name ?? '', placeholder: 'npr. Plaća' });
  const amount = el('input', { type: 'text', inputmode: 'decimal', value: r ? eurPlain(r.amount) : '', placeholder: '0,00' });
  const day = el('input', { type: 'number', min: 1, max: 31, value: r?.day ?? 1 });
  const save = () => {
    const n = name.value.trim(), a = parseEur(amount.value), d = Math.min(31, Math.max(1, Number(day.value) || 1));
    if (!n || !a) return alert('Naziv i iznos su obavezni.');
    if (r) { r.name = n; r.amount = a; r.day = d; }
    else state.income.recurring.push({ id: 'inc-' + uid(), name: n, amount: a, day: d });
    persist(); cancelEdit();
  };
  return formCard(field('Naziv', name), field('Iznos (€)', amount), field('Dan u mjesecu', day), formActions(save));
}

/* --- Fiksni troškovi --- */
function renderFixedSettings() {
  const card = el('div', { class: 'card' }, el('h2', {}, 'Fiksni troškovi'));
  for (const f of state.fixedCosts) {
    const label = `${f.name} · ${eur(f.amount)} · ${f.day}. u mj.${f.endMonth ? ' · do ' + f.endMonth : ''}${f.recurrence === 'annual' ? ' · godišnje' : ''}`;
    card.append(isEditing('fixed', f.id) ? fixedForm(f) : editRow(label, 'fixed', f.id));
  }
  card.append(isEditing('fixed', null) ? fixedForm(null) : el('button', { class: 'ghost', onclick: () => startEdit('fixed', null) }, '+ Dodaj fiksni trošak'));
  return card;
}
function fixedForm(f) {
  const name = el('input', { type: 'text', value: f?.name ?? '', placeholder: 'Naziv' });
  const amount = el('input', { type: 'text', inputmode: 'decimal', value: f ? eurPlain(f.amount) : '', placeholder: '0,00' });
  const day = el('input', { type: 'number', min: 1, max: 31, value: f?.day ?? 1 });
  const startMonth = el('input', { type: 'text', value: f?.startMonth ?? '', placeholder: 'YYYY-MM (prazno = odmah)' });
  const endMonth = el('input', { type: 'text', value: f?.endMonth ?? '', placeholder: 'YYYY-MM (prazno = bez kraja)' });
  const annual = el('input', { type: 'checkbox' }); annual.checked = f?.recurrence === 'annual';
  const save = () => {
    const n = name.value.trim(), a = parseEur(amount.value), d = Math.min(31, Math.max(1, Number(day.value) || 1));
    const sm = startMonth.value.trim() || null, em = endMonth.value.trim() || null;
    if (!n || !a) return alert('Naziv i iznos su obavezni.');
    if (annual.checked && !sm) return alert('Godišnji trošak treba početni mjesec (mjesec/godina prvog dospijeća).');
    if (f) {
      f.name = n; f.amount = a; f.day = d; f.startMonth = sm; f.endMonth = em;
      if (annual.checked) f.recurrence = 'annual'; else delete f.recurrence;
    } else {
      const obj = { id: 'fx-' + uid(), name: n, amount: a, day: d, startMonth: sm, endMonth: em };
      if (annual.checked) obj.recurrence = 'annual';
      state.fixedCosts.push(obj);
    }
    persist(); cancelEdit();
  };
  return formCard(
    field('Naziv', name), field('Iznos (€)', amount), field('Dan u mjesecu', day),
    field('Početni mjesec', startMonth), field('Završni mjesec', endMonth),
    el('label', { class: 'checkline' }, annual, el('span', { class: 'label' }, 'Godišnji trošak (ponavlja se jednom godišnje, ne svaki mjesec)')),
    formActions(save));
}

/* --- Varijabilne kategorije --- */
function renderVariableSettings() {
  const card = el('div', { class: 'card' }, el('h2', {}, 'Varijabilne kategorije'));
  for (const c of state.variableCategories) {
    card.append(isEditing('variable', c.id) ? variableForm(c) : editRow(`${c.name} · plan ${eur(c.plan)}${c.analyze ? ' · analizira se' : ''}`, 'variable', c.id));
  }
  card.append(isEditing('variable', null) ? variableForm(null) : el('button', { class: 'ghost', onclick: () => startEdit('variable', null) }, '+ Dodaj kategoriju'));
  return card;
}
function variableForm(c) {
  const name = el('input', { type: 'text', value: c?.name ?? '', placeholder: 'Naziv' });
  const plan = el('input', { type: 'text', inputmode: 'decimal', value: c ? eurPlain(c.plan) : '', placeholder: '0,00' });
  const analyze = el('input', { type: 'checkbox' }); analyze.checked = !!c?.analyze;
  const save = () => {
    const n = name.value.trim(), p = parseEur(plan.value);
    if (!n) return alert('Naziv je obavezan.');
    if (c) { c.name = n; c.plan = p; if (analyze.checked) c.analyze = true; else delete c.analyze; }
    else { const obj = { id: 'var-' + uid(), name: n, plan: p }; if (analyze.checked) obj.analyze = true; state.variableCategories.push(obj); }
    persist(); cancelEdit();
  };
  return formCard(field('Naziv', name), field('Plan (€/mj)', plan),
    el('label', { class: 'checkline' }, analyze, el('span', { class: 'label' }, 'Prikaži u "Prosjek po kategoriji" u Analizi')),
    formActions(save));
}

/* --- Lonci --- */
function renderPotsSettings() {
  const card = el('div', { class: 'card' }, el('h2', {}, 'Lonci'));
  for (const p of state.pots) {
    card.append(isEditing('pots', p.id) ? potForm(p) : editRow(`${p.name} · ${eur(p.monthly)}/mj · ${p.type}${p.nextDue ? ' · dospijeće ' + monthName(p.nextDue) : ''}`, 'pots', p.id));
  }
  card.append(isEditing('pots', null) ? potForm(null) : el('button', { class: 'ghost', onclick: () => startEdit('pots', null) }, '+ Dodaj lonac'));
  return card;
}
function potForm(p) {
  const name = el('input', { type: 'text', value: p?.name ?? '', placeholder: 'Naziv' });
  const type = el('select', {}, el('option', { value: 'sinking' }, 'sinking (godišnji račun)'), el('option', { value: 'savings' }, 'savings (ulaganje, raste zauvijek)'));
  type.value = p?.type ?? 'sinking';
  const monthly = el('input', { type: 'text', inputmode: 'decimal', value: p ? eurPlain(p.monthly) : '', placeholder: '0,00' });
  const target = el('input', { type: 'text', inputmode: 'decimal', value: p?.targetAmount ? eurPlain(p.targetAmount) : '', placeholder: '0,00' });
  const nextDue = el('input', { type: 'text', value: p?.nextDue ?? '', placeholder: 'YYYY-MM' });
  const startMonth = el('input', { type: 'text', value: p?.startMonth ?? '', placeholder: 'YYYY-MM' });
  const save = () => {
    const n = name.value.trim(), m = parseEur(monthly.value), sm = startMonth.value.trim(), t = type.value;
    if (!n || !sm) return alert('Naziv i početni mjesec su obavezni.');
    if (p) {
      p.name = n; p.type = t; p.monthly = m; p.startMonth = sm;
      if (t === 'sinking') {
        const tgt = parseEur(target.value), nd = nextDue.value.trim();
        if (!tgt || !nd) return alert('Sinking lonac treba cilj i dospijeće (YYYY-MM).');
        p.targetAmount = tgt; p.nextDue = nd;
      } else { delete p.targetAmount; delete p.nextDue; }
    } else {
      const obj = { id: 'pot-' + uid(), name: n, type: t, monthly: m, startMonth: sm };
      if (t === 'sinking') {
        const tgt = parseEur(target.value), nd = nextDue.value.trim();
        if (!tgt || !nd) return alert('Sinking lonac treba cilj i dospijeće (YYYY-MM).');
        obj.targetAmount = tgt; obj.nextDue = nd;
      }
      state.pots.push(obj);
    }
    persist(); cancelEdit();
  };
  return formCard(field('Naziv', name), field('Tip', type), field('Mjesečna rata (€)', monthly),
    field('Cilj (€, samo za sinking)', target), field('Dospijeće (samo za sinking)', nextDue),
    field('Početni mjesec', startMonth), formActions(save));
}
function driveStatusNotice() {
  if (Drive.status === 'signed-in') return el('p', { class: 'notice' }, `Povezano. Zadnja sinkronizacija: ${Drive.fileModifiedTime ? new Date(Drive.fileModifiedTime).toLocaleString('hr-HR') : '—'}`);
  if (Drive.status === 'syncing') return el('p', { class: 'notice' }, 'Spajanje na Drive…');
  if (Drive.status === 'error') return el('p', { class: 'notice' }, 'Greška pri spajanju na Drive: ' + (Drive.error || '?'));
  return el('p', { class: 'notice' }, 'Nije povezano. Podaci se čuvaju samo lokalno, u ovom pregledniku.');
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
        if (inv > 0) {
          const ulaganja = M.variable.find(v => v.catId === 'var-ulaganja');
          ulaganja.entries.push({ id: uid(), amount: inv, note: 'honorar', date: new Date().toISOString() });
        }
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

/* Google Identity Services skripta se učitava async — pričekaj da bude spremna. */
(function waitForGoogle(tries) {
  if (window.google && google.accounts && google.accounts.oauth2) { Drive.init(); return; }
  if (tries <= 0) return;
  setTimeout(() => waitForGoogle(tries - 1), 100);
})(50);
