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

export function renderStats(container, prediction) {
  const { cycleLengths, periodLengths, avgCycle, avgPeriod, periodStarts } = prediction;

  const historyRows = periodStarts
    .slice()
    .reverse()
    .slice(0, 12)
    .map((start, idx) => {
      const indexFromStart = periodStarts.length - 1 - idx;
      const length = periodLengths[indexFromStart];
      const cycleLen = cycleLengths[indexFromStart - 1];
      return `
        <li class="history-row">
          <span>${formatDate(start)}</span>
          <span>${length ? length + " Tage" : "–"}</span>
          <span>${cycleLen ? cycleLen + " Tage Zyklus" : "–"}</span>
        </li>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="card">
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-value">${avgCycle}</div>
          <div class="stat-label">⌀ Zykluslänge (Tage)</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${avgPeriod}</div>
          <div class="stat-label">⌀ Periodendauer (Tage)</div>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>Zyklusphasen (⌀)</h3>
      ${phasePieChart(avgCycle, avgPeriod)}
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
}
