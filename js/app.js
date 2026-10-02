import { loadData, saveData, clearAllData, setEntry, getEntry } from "./storage.js";
import { computePrediction, toDateKey, fromDateKey, diffDays } from "./predict.js";
import { renderCalendar } from "./calendar.js";
import { renderStats } from "./stats.js";

const BACKUP_REMINDER_DAYS = 30;
const BACKUP_SNOOZE_DAYS = 1;

const SYMPTOM_OPTIONS = [
  "Krämpfe",
  "Kopfschmerzen",
  "Rückenschmerzen",
  "Müdigkeit",
  "Blähungen",
  "Übelkeit",
  "Heißhunger",
  "Anxiety",
];
const ACCENT_OPTIONS = [
  { value: "rose", label: "Rosé", color: "#f72d6e" },
  { value: "berry", label: "Beere", color: "#b5179e" },
  { value: "ocean", label: "Ozean", color: "#1d7fe0" },
  { value: "sage", label: "Salbei", color: "#2f9e6b" },
  { value: "sunset", label: "Sonnenuntergang", color: "#ef6c1a" },
  { value: "graphite", label: "Graphit", color: "#3d4852" },
];
const MOOD_OPTIONS = ["😊", "😐", "😣", "😢", "😡", "😴"];
const FLOW_OPTIONS = [
  { value: "none", label: "Keine" },
  { value: "spotting", label: "Schmierblutung" },
  { value: "light", label: "Leicht" },
  { value: "medium", label: "Mittel" },
  { value: "heavy", label: "Stark" },
];

let data = loadData();
let viewDate = new Date();
let activeTab = "calendar";
let selectedDateKey = null;

const app = document.getElementById("app");
const daySheet = document.getElementById("day-sheet");
const daySheetBackdrop = document.getElementById("day-sheet-backdrop");
const modalEl = document.getElementById("modal");
const modalBackdrop = document.getElementById("modal-backdrop");

// iOS hides window.prompt/alert/confirm for "Add to Home Screen" apps, so every
// confirmation/input in this app uses this in-page modal instead of those.
function closeModal() {
  modalBackdrop.classList.remove("visible");
  modalEl.classList.remove("visible");
  setTimeout(() => {
    modalBackdrop.hidden = true;
    modalEl.hidden = true;
    modalEl.innerHTML = "";
  }, 150);
}

function openModal(html) {
  modalEl.innerHTML = html;
  modalBackdrop.hidden = false;
  modalEl.hidden = false;
  requestAnimationFrame(() => {
    modalBackdrop.classList.add("visible");
    modalEl.classList.add("visible");
  });
}

function showMessage(message, title = "") {
  return new Promise((resolve) => {
    openModal(`
      ${title ? `<h3>${title}</h3>` : ""}
      <p>${message}</p>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="modal-ok">OK</button>
      </div>
    `);
    modalEl.querySelector("#modal-ok").addEventListener("click", () => {
      closeModal();
      resolve();
    });
    modalBackdrop.onclick = () => {
      closeModal();
      resolve();
    };
  });
}

function showConfirm(message, { title = "", confirmLabel = "Bestätigen", danger = false } = {}) {
  return new Promise((resolve) => {
    openModal(`
      ${title ? `<h3>${title}</h3>` : ""}
      <p>${message}</p>
      <div class="sheet-actions">
        <button class="btn btn-secondary" id="modal-cancel">Abbrechen</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modal-confirm">${confirmLabel}</button>
      </div>
    `);
    modalEl.querySelector("#modal-cancel").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    modalEl.querySelector("#modal-confirm").addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
    modalBackdrop.onclick = () => {
      closeModal();
      resolve(false);
    };
  });
}

function showTypedConfirm(message, requiredWord, { title = "", confirmLabel = "Löschen" } = {}) {
  return new Promise((resolve) => {
    openModal(`
      ${title ? `<h3>${title}</h3>` : ""}
      <p>${message}</p>
      <input type="text" id="modal-input" class="modal-input" autocapitalize="characters" autocomplete="off" autocorrect="off" />
      <div class="sheet-actions">
        <button class="btn btn-secondary" id="modal-cancel">Abbrechen</button>
        <button class="btn btn-danger" id="modal-confirm">${confirmLabel}</button>
      </div>
    `);
    const input = modalEl.querySelector("#modal-input");
    modalEl.querySelector("#modal-cancel").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    modalEl.querySelector("#modal-confirm").addEventListener("click", () => {
      const ok = input.value.trim().toUpperCase() === requiredWord.toUpperCase();
      closeModal();
      resolve(ok);
    });
  });
}

function render() {
  document.querySelectorAll(".tab-bar button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== activeTab;
  });

  const prediction = computePrediction(data.entries, data.settings);
  renderBackupReminder();

  if (activeTab === "calendar") {
    const calEl = document.getElementById("calendar-container");
    selectedDateKey = null;
    renderCalendar(calEl, viewDate, data.entries, prediction, handleDayTap, handleDayLongPress);
    renderSummary(prediction);
    renderQuickTodayButton();
  } else if (activeTab === "stats") {
    renderStats(document.getElementById("stats-container"), prediction);
  } else if (activeTab === "settings") {
    renderSettings();
  }
}

function renderBackupReminder() {
  const el = document.getElementById("backup-reminder");
  const hasData = Object.keys(data.entries).length > 0;
  const { lastExportAt, backupReminderEnabled, backupReminderSnoozedAt } = data.settings;
  const now = new Date();
  const daysSince = lastExportAt ? diffDays(new Date(lastExportAt), now) : null;
  const daysSinceSnooze = backupReminderSnoozedAt ? diffDays(new Date(backupReminderSnoozedAt), now) : null;
  const exportDue = daysSince === null || daysSince >= BACKUP_REMINDER_DAYS;
  const snoozed = daysSinceSnooze !== null && daysSinceSnooze < BACKUP_SNOOZE_DAYS;
  const shouldShow = backupReminderEnabled !== false && hasData && exportDue && !snoozed;

  if (!shouldShow) {
    el.hidden = true;
    return;
  }

  const message = lastExportAt
    ? `Letztes Backup vor ${daysSince} Tagen — jetzt sichern?`
    : "Noch kein Backup deiner Daten erstellt — jetzt sichern?";

  el.innerHTML = `
    <p>💾 ${message}</p>
    <div class="backup-banner-actions">
      <button class="btn btn-primary" id="backup-reminder-export">Jetzt sichern</button>
      <button class="btn btn-secondary" id="backup-reminder-later">Später</button>
      <button class="backup-banner-off" id="backup-reminder-off">Nicht mehr erinnern</button>
    </div>
  `;
  el.hidden = false;

  el.querySelector("#backup-reminder-later").addEventListener("click", () => {
    data.settings.backupReminderSnoozedAt = new Date().toISOString();
    saveData(data);
    renderBackupReminder();
  });
  el.querySelector("#backup-reminder-off").addEventListener("click", () => {
    data.settings.backupReminderEnabled = false;
    saveData(data);
    renderBackupReminder();
  });
  el.querySelector("#backup-reminder-export").addEventListener("click", exportData);
}

function renderSummary(prediction) {
  const el = document.getElementById("cycle-summary");
  if (!prediction.lastStart) {
    el.innerHTML = `<p class="muted">Trage deinen letzten Periodenbeginn im Kalender ein, um Vorhersagen zu sehen.</p>`;
    return;
  }
  const fmt = (d) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const phase = getCurrentPhase(prediction);
  el.innerHTML = `
    <div class="summary-row">
      <div><strong>Zyklustag</strong><div>${prediction.currentCycleDay}</div></div>
      <div><strong>Nächste Periode</strong><div>${fmt(prediction.nextPeriodStart)}</div></div>
      <div><strong>Fruchtbares Fenster</strong><div>${fmt(prediction.fertileStart)}–${fmt(prediction.fertileEnd)}</div></div>
    </div>
    <div class="phase-row">
      <i class="phase-dot" style="background:${phase.color}"></i>
      <strong>${phase.label}</strong>
      <span class="muted">· Tag ${prediction.currentCycleDay}</span>
    </div>
  `;
}

function getCurrentPhase(prediction) {
  const today = new Date();
  const dayOfCycle = prediction.currentCycleDay;

  let loggedPeriodDays = 0;
  for (let i = 0; i < 15; i++) {
    const d = new Date(prediction.lastStart.getFullYear(), prediction.lastStart.getMonth(), prediction.lastStart.getDate() + i);
    if (data.entries[toDateKey(d)]?.period) loggedPeriodDays++;
    else break;
  }
  const todayLogged = data.entries[toDateKey(today)]?.period;

  if (todayLogged || dayOfCycle <= loggedPeriodDays) {
    return { label: "Menstruation", color: "var(--pink)" };
  }
  if (diffDays(today, prediction.nextPeriodStart) <= 0) {
    return { label: "Periode erwartet", color: "var(--pink)" };
  }
  if (diffDays(today, prediction.ovulationDay) === 0) {
    return { label: "Eisprung", color: "var(--purple)" };
  }
  if (diffDays(prediction.fertileStart, today) >= 0 && diffDays(today, prediction.fertileEnd) >= 0) {
    return { label: "Fruchtbares Fenster", color: "var(--purple)" };
  }
  if (diffDays(today, prediction.fertileStart) > 0) {
    return { label: "Follikelphase", color: "var(--text-muted)" };
  }
  return { label: "Lutealphase", color: "color-mix(in srgb, var(--pink) 45%, var(--surface))" };
}

function renderQuickTodayButton() {
  const today = new Date();
  const todayKey = toDateKey(today);
  const todayEntry = getEntry(data, todayKey);
  const btn = document.getElementById("quick-today-btn");
  btn.textContent = todayEntry.period ? "✓ Heute ist ein Periodentag" : "+ Heute eintragen";
  btn.classList.toggle("btn-primary", !todayEntry.period);
  btn.classList.toggle("btn-secondary", todayEntry.period);
  btn.onclick = () => {
    const isOtherMonth =
      viewDate.getFullYear() !== today.getFullYear() || viewDate.getMonth() !== today.getMonth();
    if (isOtherMonth) {
      viewDate = today;
      render();
    }
    openDaySheet(todayKey);
  };
}

function highlightSelectedDay(dateKey) {
  document.querySelectorAll(".cal-day--selected").forEach((el) => el.classList.remove("cal-day--selected"));
  const cell = document.querySelector(`.cal-day[data-date="${dateKey}"]`);
  if (cell) cell.classList.add("cal-day--selected");
}

function handleDayTap(dateKey) {
  if (selectedDateKey === dateKey) {
    openDaySheet(dateKey);
    return;
  }
  selectedDateKey = dateKey;
  highlightSelectedDay(dateKey);
}

function handleDayLongPress(dateKey) {
  openDaySheet(dateKey);
}

function openDaySheet(dateKey) {
  selectedDateKey = dateKey;
  highlightSelectedDay(dateKey);
  const entry = getEntry(data, dateKey);
  const date = fromDateKey(dateKey);
  const dateLabel = date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const initialFlow = entry.period ? entry.flow : entry.flow === "spotting" ? "spotting" : "none";

  daySheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${dateLabel}</h3>
    <div class="field-group">
      <span class="field-label">Blutungsstärke</span>
      <div class="chip-row" id="flow-chips">
        ${FLOW_OPTIONS.map(
          (f) =>
            `<button type="button" class="chip ${initialFlow === f.value ? "chip--active" : ""}" data-flow="${f.value}">${f.label}</button>`
        ).join("")}
      </div>
    </div>
    <div class="field-group">
      <span class="field-label">Stimmung</span>
      <div class="chip-row" id="mood-chips">
        ${MOOD_OPTIONS.map(
          (m) =>
            `<button type="button" class="chip chip--emoji ${entry.moods.includes(m) ? "chip--active" : ""}" data-mood="${m}">${m}</button>`
        ).join("")}
      </div>
    </div>
    <div class="field-group">
      <span class="field-label">Symptome</span>
      <div class="chip-row" id="symptom-chips">
        ${SYMPTOM_OPTIONS.map(
          (s) =>
            `<button type="button" class="chip ${entry.symptoms.includes(s) ? "chip--active" : ""}" data-symptom="${s}">${s}</button>`
        ).join("")}
      </div>
    </div>
    <div class="field-group">
      <span class="field-label">Notiz</span>
      <textarea id="field-note" rows="3" placeholder="Eigene Notiz...">${entry.note || ""}</textarea>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-secondary" id="sheet-cancel">Abbrechen</button>
      <button class="btn btn-primary" id="sheet-save">Speichern</button>
    </div>
  `;

  const state = {
    flow: initialFlow,
    moods: [...entry.moods],
    symptoms: [...entry.symptoms],
    note: entry.note,
  };

  daySheet.querySelectorAll("#flow-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.flow = chip.dataset.flow;
      daySheet.querySelectorAll("#flow-chips .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
    });
  });
  daySheet.querySelectorAll("#mood-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const m = chip.dataset.mood;
      if (state.moods.includes(m)) {
        state.moods = state.moods.filter((x) => x !== m);
        chip.classList.remove("chip--active");
      } else {
        state.moods.push(m);
        chip.classList.add("chip--active");
      }
    });
  });
  daySheet.querySelectorAll("#symptom-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const s = chip.dataset.symptom;
      if (state.symptoms.includes(s)) {
        state.symptoms = state.symptoms.filter((x) => x !== s);
        chip.classList.remove("chip--active");
      } else {
        state.symptoms.push(s);
        chip.classList.add("chip--active");
      }
    });
  });

  daySheet.querySelector("#sheet-cancel").addEventListener("click", closeDaySheet);
  daySheet.querySelector("#sheet-save").addEventListener("click", () => {
    state.note = daySheet.querySelector("#field-note").value;
    const entryToSave = {
      period: state.flow !== "none" && state.flow !== "spotting",
      flow: state.flow,
      moods: state.moods,
      symptoms: state.symptoms,
      note: state.note,
    };
    setEntry(data, dateKey, entryToSave);
    closeDaySheet();
    render();
  });
  daySheetBackdrop.addEventListener("click", closeDaySheet);
  setupSheetDragToClose();

  daySheet.style.transform = "";
  daySheet.style.transition = "";
  daySheetBackdrop.hidden = false;
  daySheet.hidden = false;
  requestAnimationFrame(() => {
    daySheetBackdrop.classList.add("visible");
    daySheet.classList.add("visible");
  });
}

function setupSheetDragToClose() {
  const handle = daySheet.querySelector(".sheet-handle");
  if (!handle) return;
  const closeThreshold = 110;
  let startY = 0;
  let dy = 0;
  let dragging = false;

  function onMove(e) {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    daySheet.style.transform = `translateY(${dy}px)`;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    daySheet.style.transition = "";
    if (dy > closeThreshold) {
      closeDaySheet();
    } else {
      daySheet.style.transform = "";
    }
    dy = 0;
  }
  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    daySheet.style.transition = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function closeDaySheet() {
  daySheetBackdrop.classList.remove("visible");
  daySheet.classList.remove("visible");
  daySheet.style.transform = "";
  selectedDateKey = null;
  document.querySelectorAll(".cal-day--selected").forEach((el) => el.classList.remove("cal-day--selected"));
  setTimeout(() => {
    daySheetBackdrop.hidden = true;
    daySheet.hidden = true;
  }, 250);
}

function renderSettings() {
  const el = document.getElementById("settings-container");
  const { avgCycleLengthOverride, lutealPhaseLength, themeOverride, backupReminderEnabled, accent } = data.settings;
  const currentAccent = accent || "rose";
  const theme = themeOverride || "system";
  el.innerHTML = `
    <div class="card">
      <h3>Darstellung</h3>
      <div class="field-group">
        <span class="field-label">Erscheinungsbild</span>
        <div class="chip-row" id="theme-chips">
          <button type="button" class="chip ${theme === "system" ? "chip--active" : ""}" data-theme-option="system">System</button>
          <button type="button" class="chip ${theme === "light" ? "chip--active" : ""}" data-theme-option="light">Hell</button>
          <button type="button" class="chip ${theme === "dark" ? "chip--active" : ""}" data-theme-option="dark">Dunkel</button>
        </div>
      </div>
      <div class="field-group">
        <span class="field-label">Farbschema</span>
        <div class="chip-row" id="accent-chips">
          ${ACCENT_OPTIONS.map(
            (a) =>
              `<button type="button" class="chip ${currentAccent === a.value ? "chip--active" : ""}" data-accent-option="${a.value}"><i class="swatch-dot" style="background:${a.color}"></i>${a.label}</button>`
          ).join("")}
        </div>
      </div>
    </div>
    <div class="card">
      <h3>Zyklus-Einstellungen</h3>
      <label class="field-group">
        <span class="field-label">Durchschnittliche Zykluslänge überschreiben (Tage)</span>
        <input type="number" id="setting-avg-cycle" min="15" max="60" placeholder="automatisch berechnet" value="${avgCycleLengthOverride || ""}" />
      </label>
      <label class="field-group">
        <span class="field-label">Lutealphase (Tage, Standard 14)</span>
        <input type="number" id="setting-luteal" min="8" max="20" value="${lutealPhaseLength}" />
      </label>
    </div>
    <div class="card">
      <h3>Daten</h3>
      <p class="muted">Alle Daten bleiben ausschließlich auf diesem Gerät. Nichts wird übertragen.</p>
      <div class="field-group">
        <span class="field-label">Backup-Erinnerung (wenn das letzte Backup über 30 Tage her ist)</span>
        <div class="chip-row" id="backup-reminder-chips">
          <button type="button" class="chip ${backupReminderEnabled !== false ? "chip--active" : ""}" data-backup-reminder="on">An</button>
          <button type="button" class="chip ${backupReminderEnabled === false ? "chip--active" : ""}" data-backup-reminder="off">Aus</button>
        </div>
      </div>
      <div class="settings-actions">
        <button class="btn btn-secondary" id="export-btn">Exportieren (Datei speichern)</button>
        <label class="btn btn-secondary file-btn">
          Importieren
          <input type="file" id="import-input" accept="application/json" hidden />
        </label>
        <button class="btn btn-danger" id="delete-all-btn">Alle Daten löschen</button>
      </div>
    </div>
  `;

  el.querySelectorAll("#accent-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      data.settings.accent = chip.dataset.accentOption === "rose" ? null : chip.dataset.accentOption;
      saveData(data);
      applyTheme();
      el.querySelectorAll("#accent-chips .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
    });
  });

  el.querySelectorAll("#theme-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const choice = chip.dataset.themeOption;
      data.settings.themeOverride = choice === "system" ? null : choice;
      saveData(data);
      applyTheme();
      el.querySelectorAll("#theme-chips .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
    });
  });

  el.querySelector("#setting-avg-cycle").addEventListener("change", (e) => {
    const val = Number(e.target.value);
    data.settings.avgCycleLengthOverride = val > 0 ? val : null;
    saveData(data);
    render();
  });
  el.querySelector("#setting-luteal").addEventListener("change", (e) => {
    const val = Number(e.target.value);
    data.settings.lutealPhaseLength = val > 0 ? val : 14;
    saveData(data);
    render();
  });

  el.querySelectorAll("#backup-reminder-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      data.settings.backupReminderEnabled = chip.dataset.backupReminder === "on";
      saveData(data);
      el.querySelectorAll("#backup-reminder-chips .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      renderBackupReminder();
    });
  });

  el.querySelector("#export-btn").addEventListener("click", exportData);
  el.querySelector("#import-input").addEventListener("change", importData);
  el.querySelector("#delete-all-btn").addEventListener("click", async () => {
    const ok = await showTypedConfirm('Tippe "LÖSCHEN" ein, um fortzufahren.', "LÖSCHEN", {
      title: "Alle Daten unwiderruflich löschen?",
    });
    if (ok) {
      clearAllData();
      data = loadData();
      render();
    }
  });
}

function exportData() {
  data.settings.lastExportAt = new Date().toISOString();
  saveData(data);

  const payload = JSON.stringify(data, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = toDateKey(new Date());
  a.href = url;
  a.download = `zyklus-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  renderBackupReminder();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.entries || !parsed.settings) throw new Error("Ungültiges Format");
      const ok = await showConfirm("Bestehende Daten werden ersetzt.", {
        title: "Importierte Daten übernehmen?",
      });
      if (ok) {
        data = parsed;
        saveData(data);
        render();
        await showMessage("Import erfolgreich.");
      }
    } catch (err) {
      await showMessage("Datei konnte nicht gelesen werden: " + err.message, "Fehler");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function setupTabs() {
  document.querySelectorAll(".tab-bar button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });
}

function setupCalendarNav() {
  const calEl = document.getElementById("calendar-container");
  calEl.addEventListener("monthchange", (e) => {
    viewDate = e.detail;
    render();
  });
}

function applyTheme() {
  const accent = data.settings.accent;
  if (accent && ACCENT_OPTIONS.some((a) => a.value === accent)) {
    document.documentElement.dataset.accent = accent;
  } else {
    delete document.documentElement.dataset.accent;
  }
  const accentColor = (ACCENT_OPTIONS.find((a) => a.value === accent) || ACCENT_OPTIONS[0]).color;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", accentColor);

  const theme = data.settings.themeOverride;
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function setupAutoUpdate() {
  if (!("serviceWorker" in navigator)) return;

  let reloadedAlready = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedAlready) return;
    reloadedAlready = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch((e) => console.error("SW-Registrierung fehlgeschlagen", e));
}

async function init() {
  setupAutoUpdate();
  applyTheme();
  setupTabs();
  setupCalendarNav();
  render();
}

init();
