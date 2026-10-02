const STORAGE_KEY = "zyklus-app-data-v1";

function defaultData() {
  return {
    entries: {},
    settings: {
      avgCycleLengthOverride: null,
      lutealPhaseLength: 14,
      themeOverride: null,
      lastExportAt: null,
      backupReminderEnabled: true,
      backupReminderSnoozedAt: null,
    },
  };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    const base = defaultData();
    const entries = parsed.entries || {};
    for (const entry of Object.values(entries)) {
      if (entry.spotting) {
        entry.period = false;
        entry.flow = "spotting";
      } else if (entry.period && entry.flow === "spotting") {
        // migrate the brief period-true/flow-spotting representation to the current model
        entry.period = false;
      }
      delete entry.spotting;
    }
    const settings = { ...base.settings, ...(parsed.settings || {}) };
    delete settings.pinHash;
    delete settings.pinLength;
    return { entries, settings };
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
