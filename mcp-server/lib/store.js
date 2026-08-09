"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "tracker-state.json");

function uid() {
  return Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
}

function seedState() {
  return {
    categories: [
      { id: uid(), name: "PeakFlow", revenue: true, order: 0 },
      { id: uid(), name: "Ranch", revenue: false, order: 1 },
      { id: uid(), name: "Build", revenue: false, order: 2 },
      { id: uid(), name: "Admin", revenue: false, order: 3 }
    ],
    running: null,
    sessions: [],
    calls: [],
    income: []
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.categories)) {
      return seedState();
    }
    parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    parsed.calls = Array.isArray(parsed.calls) ? parsed.calls : [];
    parsed.income = Array.isArray(parsed.income) ? parsed.income : [];
    parsed.running = parsed.running && typeof parsed.running === "object" ? parsed.running : null;
    return parsed;
  } catch (e) {
    return seedState();
  }
}

let _state = loadState();

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(_state, null, 2));
}

// Persist immediately so a fresh install has a file on disk right away,
// same fix applied to the browser app's boot path.
persist();

function getState() {
  return _state;
}

function mutate(fn) {
  const result = fn(_state);
  persist();
  return result;
}

// ---------- Date helpers (local time, mirrors tracker.html) ----------
function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function todayKey() {
  return dayKey(Date.now());
}

function addDays(key, delta) {
  const parts = key.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + delta);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// ---------- Derived data (mirrors tracker.html's totalsFor) ----------
function categoryById(id) {
  return getState().categories.find((c) => c.id === id) || null;
}

function sortedCategories() {
  return getState().categories.slice().sort((a, b) => a.order - b.order);
}

function sessionsForDay(key) {
  const st = getState();
  const list = st.sessions.filter((s) => dayKey(s.start) === key);
  if (st.running && dayKey(st.running.startedAt) === key) {
    const now = Date.now();
    list.push({
      id: "__running__",
      catId: st.running.catId,
      start: st.running.startedAt,
      minutes: (now - st.running.startedAt) / 60000,
      note: "",
      running: true
    });
  }
  return list;
}

function callsForDay(key) {
  return getState().calls.filter((c) => dayKey(c.ts) === key);
}

function incomeForDay(key) {
  return getState().income.filter((i) => dayKey(i.ts) === key);
}

function totalsFor(key) {
  const sessions = sessionsForDay(key);
  let totalMin = 0;
  let revMin = 0;
  const perCat = {};
  sessions.forEach((s) => {
    const cat = categoryById(s.catId);
    const isRev = cat ? !!cat.revenue : false;
    totalMin += s.minutes;
    if (isRev) revMin += s.minutes;
    perCat[s.catId] = (perCat[s.catId] || 0) + s.minutes;
  });
  const pct = totalMin > 0 ? (revMin / totalMin) * 100 : 0;
  const calls = callsForDay(key);
  const income = incomeForDay(key);
  const incomeTotal = income.reduce((sum, r) => sum + r.amount, 0);
  return {
    date: key,
    totalMinutes: totalMin,
    revenueMinutes: revMin,
    revenuePct: pct,
    minutesByCategory: perCat,
    callsCount: calls.length,
    incomeTotal
  };
}

function rolling7DayPct(fromKey) {
  const start = fromKey || todayKey();
  let totalMin = 0;
  let revMin = 0;
  for (let i = 0; i < 7; i++) {
    const t = totalsFor(addDays(start, -i));
    totalMin += t.totalMinutes;
    revMin += t.revenueMinutes;
  }
  return totalMin > 0 ? (revMin / totalMin) * 100 : 0;
}

function allTimeIncome() {
  return getState().income.reduce((sum, r) => sum + r.amount, 0);
}

function historyForDay(key) {
  const sessions = sessionsForDay(key).filter((s) => !s.running);
  const calls = callsForDay(key);
  const income = incomeForDay(key);
  const items = [];
  sessions.forEach((s) => {
    const cat = categoryById(s.catId);
    items.push({
      type: "session",
      ts: s.start,
      id: s.id,
      category: cat ? cat.name : "(deleted)",
      revenue: cat ? !!cat.revenue : false,
      minutes: s.minutes,
      note: s.note || ""
    });
  });
  calls.forEach((c) => {
    items.push({ type: "call", ts: c.ts, id: c.id, note: c.note || "" });
  });
  income.forEach((i) => {
    items.push({ type: "income", ts: i.ts, id: i.id, amount: i.amount, note: i.note || "" });
  });
  items.sort((a, b) => b.ts - a.ts);
  return items;
}

module.exports = {
  DATA_FILE,
  uid,
  getState,
  mutate,
  dayKey,
  todayKey,
  addDays,
  categoryById,
  sortedCategories,
  totalsFor,
  rolling7DayPct,
  allTimeIncome,
  historyForDay
};
