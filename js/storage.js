const STORAGE_KEY = "zyklus-app-data-v1";

function defaultData() {
  return {
    entries: {},
    settings: {
      avgCycleLengthOverride: null,
      lutealPhaseLength: 14,
      themeOverride: null,
      accent: null,
      uiStyle: null,
      lastExportAt: null,
      backupReminderEnabled: true,
      backupReminderSnoozedAt: null,
    },
  };
}

const FLOWS = ["none", "spotting", "light", "medium", "heavy"];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** Brings any stored or imported data (also from older app versions) into the current, safe shape. */
export function normalizeData(parsed) {
  if (!parsed || typeof parsed !== "object" || typeof parsed.entries !== "object" || parsed.entries === null) {
    throw new Error("Ungültiges Format");
  }
  const base = defaultData();
  const entries = {};
  for (const [key, raw] of Object.entries(parsed.entries)) {
    if (!DATE_KEY.test(key) || !raw || typeof raw !== "object") continue;
    let flow = FLOWS.includes(raw.flow) ? raw.flow : "none";
    let period = !!raw.period;
    if (raw.spotting) {
      period = false;
      flow = "spotting";
    }
    if (flow === "spotting") period = false;
    else if (period && flow === "none") flow = "medium";
    else if (!period) flow = "none";
    const moods = Array.isArray(raw.moods) ? raw.moods : raw.mood ? [raw.mood] : [];
    entries[key] = {
      period,
      flow,
      moods: moods.filter((m) => typeof m === "string"),
      symptoms: Array.isArray(raw.symptoms) ? raw.symptoms.filter((x) => typeof x === "string") : [],
      note: typeof raw.note === "string" ? raw.note : "",
    };
  }
  const st = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
  const settings = {
    avgCycleLengthOverride: clampInt(st.avgCycleLengthOverride, 15, 60, null),
    lutealPhaseLength: clampInt(st.lutealPhaseLength, 8, 20, base.settings.lutealPhaseLength),
    themeOverride: st.themeOverride === "light" || st.themeOverride === "dark" ? st.themeOverride : null,
    accent: typeof st.accent === "string" ? st.accent : null,
    uiStyle: typeof st.uiStyle === "string" ? st.uiStyle : null,
    lastExportAt: typeof st.lastExportAt === "string" ? st.lastExportAt : null,
    backupReminderEnabled: st.backupReminderEnabled !== false,
    backupReminderSnoozedAt: typeof st.backupReminderSnoozedAt === "string" ? st.backupReminderSnoozedAt : null,
  };
  return { entries, settings };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return normalizeData(JSON.parse(raw));
  } catch (e) {
    console.error("Konnte Daten nicht laden, starte mit leeren Daten.", e);
    return defaultData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function setEntry(data, dateKey, entry) {
  const isEmpty =
    !entry.period &&
    entry.flow !== "spotting" &&
    (!entry.symptoms || entry.symptoms.length === 0) &&
    (!entry.moods || entry.moods.length === 0) &&
    !entry.note;
  if (isEmpty) {
    delete data.entries[dateKey];
  } else {
    data.entries[dateKey] = entry;
  }
  saveData(data);
  return data;
}

export function getEntry(data, dateKey) {
  return (
    data.entries[dateKey] || {
      period: false,
      flow: "none",
      symptoms: [],
      moods: [],
      note: "",
    }
  );
}
