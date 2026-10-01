import { toDateKey, isSameDay, isDateInRange } from "./predict.js";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_LABELS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

/**
 * Renders a month calendar grid into `container`.
 * `viewDate` is any Date within the month to display.
 * `onDayTap(dateKey)` is called on a normal tap/release (first tap only selects; the
 * caller decides whether a second tap on the same day should open it).
 * `onDayLongPress(dateKey)` is called when a day is pressed and held.
 */
export function renderCalendar(container, viewDate, entries, prediction, onDayTap, onDayLongPress) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const header = `
    <div class="cal-header">
      <button class="cal-nav" data-nav="-1" aria-label="Vorheriger Monat">&#8249;</button>
      <div class="cal-title">${MONTH_LABELS[month]} ${year}</div>
      <button class="cal-nav" data-nav="1" aria-label="Nächster Monat">&#8250;</button>
    </div>
    <div class="cal-weekdays">
      ${WEEKDAY_LABELS.map((d) => `<div class="cal-weekday">${d}</div>`).join("")}
    </div>
  `;

  const dayCells = cells
    .map((date) => {
      const key = toDateKey(date);
      const entry = entries[key];
      const inMonth = date.getMonth() === month;
      const isSpotting = entry && entry.flow === "spotting";
      const hasLoggedBleeding = !!(entry && (entry.period || isSpotting));
      const classes = ["cal-day"];
      if (!inMonth) classes.push("cal-day--muted");
      if (isSameDay(date, today)) classes.push("cal-day--today");
      if (entry && entry.period) classes.push("cal-day--period");
      else if (isSpotting) classes.push("cal-day--spotting");

      const futureCycles = prediction.futureCycles || [];
      const ovulationCycle = futureCycles.find((c) => c.ovulationDay && isSameDay(date, c.ovulationDay));
      if (ovulationCycle) {
        classes.push("cal-day--ovulation");
      } else if (futureCycles.some((c) => isDateInRange(date, c.fertileStart, c.fertileEnd))) {
        classes.push("cal-day--fertile");
      }
      if (!hasLoggedBleeding && futureCycles.some((c) => date >= c.periodStart && date < c.periodEnd)) {
        classes.push("cal-day--predicted");
      }
      const hasNote = entry && ((entry.moods && entry.moods.length) || entry.note || (entry.symptoms && entry.symptoms.length));
      return `
        <button class="${classes.join(" ")}" data-date="${key}">
          <span class="cal-day-num">${date.getDate()}</span>
          ${hasNote ? '<span class="cal-day-dot"></span>' : ""}
        </button>
      `;
    })
    .join("");

  container.innerHTML = `${header}<div class="cal-grid">${dayCells}</div>`;

  container.querySelectorAll(".cal-nav").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.nav);
      const newView = new Date(year, month + delta, 1);
      container.dispatchEvent(new CustomEvent("monthchange", { detail: newView }));
    });
  });

  container.querySelectorAll(".cal-day[data-date]").forEach((btn) => {
    let timer = null;
    let longPressed = false;
    let startX = 0;
    let startY = 0;

    function cancelTimer() {
      clearTimeout(timer);
      timer = null;
    }

    btn.addEventListener("pointerdown", (e) => {
      longPressed = false;
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => {
        longPressed = true;
        onDayLongPress(btn.dataset.date);
      }, LONG_PRESS_MS);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!timer) return;
      if (Math.abs(e.clientX - startX) > MOVE_CANCEL_PX || Math.abs(e.clientY - startY) > MOVE_CANCEL_PX) {
        cancelTimer();
      }
    });
    btn.addEventListener("pointerup", () => {
      const wasLongPress = longPressed;
      cancelTimer();
      if (!wasLongPress) onDayTap(btn.dataset.date);
    });
    btn.addEventListener("pointerleave", cancelTimer);
    btn.addEventListener("pointercancel", cancelTimer);
  });
}
