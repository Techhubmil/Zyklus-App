import { diffDays, addDays } from "./predict.js";

function formatDate(date) {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const FERTILE_WINDOW_DAYS = 6; // ovulation -5 .. +1

function phasePieChart(avgCycle, avgPeriod) {
  const periodDays = Math.min(avgPeriod, avgCycle);
  const fertileDays = Math.min(FERTILE_WINDOW_DAYS, Math.max(0, avgCycle - periodDays));
  const restDays = Math.max(0, avgCycle - periodDays - fertileDays);

  const segments = [
    { label: "Periode", days: periodDays, color: "var(--pink)" },
    { label: "Fruchtbares Fenster", days: fertileDays, color: "var(--purple)" },
    { label: "Rest", days: restDays, color: "var(--border)" },
  ].filter((s) => s.days > 0);

  const total = segments.reduce((sum, s) => sum + s.days, 0) || 1;
  const cx = 50;
  const cy = 50;
  const radius = 42;
  let angle = -90;

  const paths = segments
    .map((s) => {
      const sweep = (s.days / total) * 360;
      const end = angle + sweep;
      const x1 = cx + radius * Math.cos((angle * Math.PI) / 180);
      const y1 = cy + radius * Math.sin((angle * Math.PI) / 180);
      const x2 = cx + radius * Math.cos((end * Math.PI) / 180);
      const y2 = cy + radius * Math.sin((end * Math.PI) / 180);
      const largeArc = sweep > 180 ? 1 : 0;
      const d =
        total === s.days
          ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
          : `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      angle = end;
      return `<path d="${d}" fill="${s.color}" />`;
    })
    .join("");

  const legend = segments
    .map(
      (s) => `
        <div class="pie-legend-row">
          <span class="pie-legend-dot" style="background:${s.color}"></span>
          <span class="pie-legend-label">${s.label}</span>
          <strong>${s.days} Tage</strong>
        </div>
      `
    )
    .join("");

  return `
    <div class="pie-chart-row">
      <svg viewBox="0 0 100 100" class="pie-svg" role="img" aria-label="Zyklusphasen im Durchschnitt">
        ${paths}
      </svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

const view = { mode: "cycle", index: null };

export function resetStatsView() {
  view.mode = "cycle";
  view.index = null;
}

function mean(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function shortDate(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function renderStats(container, prediction) {
  const { cycleLengths, periodLengths, avgCycle, avgPeriod, periodStarts } = prediction;

  const cycles = periodStarts.map((start, i) => ({
    start,
    periodLen: periodLengths[i] || null,
    cycleLen: cycleLengths[i] || null,
    ongoing: i === periodStarts.length - 1,
  }));

  if (view.index === null || view.index >= cycles.length) view.index = cycles.length - 1;
  if (view.mode === "cycle" && cycles.length === 0) view.mode = "all";

  const rerender = () => renderStats(container, prediction);

  let topHtml;
  let pieHtml;
  let pieTitle;

  if (view.mode === "all") {
    const completed = cycles.filter((c) => c.cycleLen);
    const lens = completed.map((c) => c.cycleLen);
    const pLens = cycles.filter((c) => c.periodLen && !c.ongoing).map((c) => c.periodLen);
    const allCycle = lens.length ? Math.round(mean(lens)) : avgCycle;
    const allPeriod = pLens.length ? Math.round(mean(pLens)) : avgPeriod;
    const details = lens.length
      ? `${lens.length} ${lens.length === 1 ? "Zyklus" : "Zyklen"} ausgewertet · kürzester ${Math.min(...lens)} · längster ${Math.max(...lens)} Tage`
      : "Noch kein vollständiger Zyklus erfasst — angezeigt sind Standardwerte.";
    const note =
      lens.length && avgCycle !== allCycle
        ? `<p class="muted stats-note">Die Vorhersage rechnet mit dem Ø der letzten 6 Zyklen (${avgCycle} Tage).</p>`
        : "";
    topHtml = `
      <div class="stat-row">
        <div class="stat-box"><div class="stat-value">${allCycle}</div><div class="stat-label">⌀ Zykluslänge (Tage)</div></div>
        <div class="stat-box"><div class="stat-value">${allPeriod}</div><div class="stat-label">⌀ Periodendauer (Tage)</div></div>
      </div>
      <p class="muted stats-note">${details}</p>${note}`;
    pieTitle = "Zyklusphasen (⌀ alle Zyklen)";
    pieHtml = phasePieChart(allCycle, allPeriod);
  } else {
    const c = cycles[view.index];
    const days = c.ongoing ? Math.max(1, diffDays(c.start, new Date()) + 1) : c.cycleLen;
    const pieCycle = c.cycleLen || avgCycle;
    const pieMore = c.ongoing ? " · erwartet" : "";
    const range = c.cycleLen
      ? `${shortDate(c.start)} – ${shortDate(addDays(c.start, c.cycleLen - 1))}`
      : `ab ${shortDate(c.start)} (laufend)`;
    topHtml = `
      <div class="cycle-nav">
        <button class="cal-nav" data-dir="-1" aria-label="Älterer Zyklus" ${view.index === 0 ? "disabled" : ""}>&#8249;</button>
        <div class="cycle-nav-title">${range}</div>
        <button class="cal-nav" data-dir="1" aria-label="Neuerer Zyklus" ${view.index === cycles.length - 1 ? "disabled" : ""}>&#8250;</button>
      </div>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-value">${days}</div><div class="stat-label">${c.ongoing ? "Tag im laufenden Zyklus" : "Zykluslänge (Tage)"}</div></div>
        <div class="stat-box"><div class="stat-value">${c.periodLen || "–"}</div><div class="stat-label">Periodendauer (Tage)</div></div>
      </div>`;
    pieTitle = `Zyklusphasen${pieMore}`;
    pieHtml = phasePieChart(pieCycle, c.periodLen || avgPeriod);
  }

  const historyRows = cycles
    .map((c, i) => ({ c, i }))
    .reverse()
    .slice(0, 12)
    .map(
      ({ c, i }) => `
        <li class="history-row history-row--tap ${view.mode === "cycle" && view.index === i ? "history-row--active" : ""}" data-index="${i}">
          <span>${formatDate(c.start)}</span>
          <span>${c.periodLen ? c.periodLen + " Tage" : "–"}</span>
          <span>${c.cycleLen ? c.cycleLen + " Tage Zyklus" : c.ongoing ? "läuft" : "–"}</span>
        </li>`
    )
    .join("");

  container.innerHTML = `
    <div class="chip-row stats-toggle">
      <button type="button" class="chip ${view.mode === "cycle" ? "chip--active" : ""}" data-mode="cycle" ${cycles.length ? "" : "disabled"}>Pro Zyklus</button>
      <button type="button" class="chip ${view.mode === "all" ? "chip--active" : ""}" data-mode="all">Gesamt Ø</button>
    </div>
    <div class="card">${topHtml}</div>
    <div class="card">
      <h3>${pieTitle}</h3>
      ${pieHtml}
    </div>
    <div class="card">
      <h3>Verlauf</h3>
      ${
        historyRows
          ? `<ul class="history-list">${historyRows}</ul>`
          : `<p class="muted">Noch keine Periode erfasst. Trage im Kalender deinen ersten Periodentag ein.</p>`
      }
    </div>
  `;

  container.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      view.mode = btn.dataset.mode;
      rerender();
    });
  });
  container.querySelectorAll(".cycle-nav .cal-nav").forEach((btn) => {
    btn.addEventListener("click", () => {
      view.index = Math.min(cycles.length - 1, Math.max(0, view.index + Number(btn.dataset.dir)));
      rerender();
    });
  });
  container.querySelectorAll(".history-row--tap").forEach((row) => {
    row.addEventListener("click", () => {
      view.mode = "cycle";
      view.index = Number(row.dataset.index);
      rerender();
    });
  });
}
