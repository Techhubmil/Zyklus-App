const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function diffDays(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

const MAX_GAP_DAYS = 3; // a forgotten day inside one period must not split it into two

/** Groups logged (non-spotting) period days into runs: { start: Date, end: Date }. */
function getPeriodRuns(entries) {
  const keys = Object.keys(entries)
    .filter((k) => entries[k].period && entries[k].flow !== "spotting")
    .sort();
  const runs = [];
  for (const key of keys) {
    const date = fromDateKey(key);
    const last = runs[runs.length - 1];
    if (last && diffDays(last.end, date) <= MAX_GAP_DAYS) {
      last.end = date;
    } else {
      runs.push({ start: date, end: date });
    }
  }
  return runs;
}

/** Sorted ascending array of Date objects marking the first day of each logged period. */
export function getPeriodStarts(entries) {
  return getPeriodRuns(entries).map((r) => r.start);
}

/** Length in days of each logged period (first to last logged day, same order as the starts). */
export function getPeriodLengths(entries) {
  return getPeriodRuns(entries).map((r) => diffDays(r.start, r.end) + 1);
}

export function getCycleLengths(periodStarts) {
  const lengths = [];
  for (let i = 1; i < periodStarts.length; i++) {
    lengths.push(diffDays(periodStarts[i - 1], periodStarts[i]));
  }
  return lengths;
}

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function averageCycleLength(cycleLengths, override) {
  if (override) return override;
  // gaps from untracked months (very long "cycles") would distort the prediction
  const plausible = cycleLengths.filter((l) => l >= 15 && l <= 90);
  const avg = average(plausible.slice(-6));
  return avg ? Math.round(avg) : 28;
}

export function averagePeriodLength(periodLengths) {
  const lastSix = periodLengths.slice(-6);
  const avg = average(lastSix);
  return avg ? Math.round(avg) : 5;
}

/**
 * Computes the full prediction picture from raw entries + settings.
 * Returns null fields when there isn't enough history to predict from.
 */
export function computePrediction(entries, settings) {
  const periodStarts = getPeriodStarts(entries);
  const cycleLengths = getCycleLengths(periodStarts);
  const periodLengths = getPeriodLengths(entries);
  const avgCycle = averageCycleLength(
    cycleLengths,
    settings.avgCycleLengthOverride
  );
  const today = new Date();
  // a period that is still being logged is incomplete and must not shorten the average
  const runs = getPeriodRuns(entries);
  const lastRun = runs[runs.length - 1];
  const stillOngoing = lastRun && diffDays(lastRun.end, today) <= MAX_GAP_DAYS && runs.length > 1;
  const avgPeriod = averagePeriodLength(stillOngoing ? periodLengths.slice(0, -1) : periodLengths);
  const startsNotInFuture = periodStarts.filter((d) => diffDays(d, today) >= 0);
  const lastStart = startsNotInFuture[startsNotInFuture.length - 1] || null;

  let nextPeriodStart = null;
  let fertileStart = null;
  let fertileEnd = null;
  let ovulationDay = null;
  let currentCycleDay = null;
  const futureCycles = [];

  if (lastStart) {
    const CYCLES_AHEAD = 12;
    for (let i = 1; i <= CYCLES_AHEAD; i++) {
      const periodStart = addDays(lastStart, avgCycle * i);
      const periodEnd = addDays(periodStart, avgPeriod);
      const cycleOvulation = addDays(periodStart, -settings.lutealPhaseLength);
      futureCycles.push({
        periodStart,
        periodEnd,
        ovulationDay: cycleOvulation,
        fertileStart: addDays(cycleOvulation, -5),
        fertileEnd: addDays(cycleOvulation, 1),
      });
    }
    nextPeriodStart = futureCycles[0].periodStart;
    ovulationDay = futureCycles[0].ovulationDay;
    fertileStart = futureCycles[0].fertileStart;
    fertileEnd = futureCycles[0].fertileEnd;
    currentCycleDay = diffDays(lastStart, today) + 1;
  }

  return {
    periodStarts,
    cycleLengths,
    periodLengths,
    avgCycle,
    avgPeriod,
    lastStart,
    nextPeriodStart,
    fertileStart,
    fertileEnd,
    ovulationDay,
    currentCycleDay,
    futureCycles,
  };
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isDateInRange(date, start, end) {
  if (!start || !end) return false;
  return diffDays(start, date) >= 0 && diffDays(date, end) >= 0;
}
