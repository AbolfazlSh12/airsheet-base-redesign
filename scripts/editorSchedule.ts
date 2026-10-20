// The only (cronType, cron) pairs the automation editor (cloud-front ScheduleTrigger.vue / schedule.js) writes.
// Anything else is shown raw in «نوع بازه زمانی», and switching the type there overwrites the cron.
//   hourly         M */N * * *   or   M A-B/N * * *     (every N hours, optional «از ساعت / تا ساعت» window)
//   weekly         M H * * D     D = * («هر روز») or 0–6 — this is also how «daily» is written
//   jalaliMonthly  M H d * *     d = Jalali day 1–31
// Times the editor cannot express directly: a list of hours in steps (7,13 → hourly 7-13/6), a daily run (weekly, D = *).
const INT = /^\d+$/;
const inRange = (s: string, lo: number, hi: number) => INT.test(s) && +s >= lo && +s <= hi;
const HOUR = /^(?:\*|(\d+)-(\d+))\/(\d+)$/;
const DOW = new Set(["*", "0", "1", "2", "3", "4", "5", "6"]);

export function editorScheduleError(cronType: string | null | undefined, cron: string | null | undefined): string | null {
  if (!cronType && !cron) return null; // not scheduled
  const p = String(cron ?? "").split(" ");
  if (p.length !== 5) return `cron "${cron}" must have 5 fields`;
  const [m, h, dom, mon, dow] = p;
  if (!inRange(m, 0, 59) || mon !== "*") return `cron "${cron}": the editor sets one minute 0–59 and month *`;
  if (cronType === "hourly") {
    const x = h.match(HOUR);
    const ok = x && dom === "*" && dow === "*" && inRange(x[3], 1, 24) && (x[1] === undefined || +x[1] <= +x[2] && +x[2] <= 23);
    return ok ? null : `hourly cron "${cron}" must be "M */N * * *" or "M A-B/N * * *"`;
  }
  if (cronType === "weekly") {
    return inRange(h, 0, 23) && dom === "*" && DOW.has(dow) ? null : `weekly cron "${cron}" must be "M H * * D" (D = * or 0–6)`;
  }
  if (cronType === "jalaliMonthly") {
    return inRange(h, 0, 23) && inRange(dom, 1, 31) && dow === "*" ? null : `jalaliMonthly cron "${cron}" must be "M H d * *"`;
  }
  return `cronType "${cronType}" is not offered by the editor (hourly, weekly, jalaliMonthly)`;
}

if (require.main === module) {
  const ok: Array<[string, string]> = [["hourly", "1 */1 * * *"], ["hourly", "30 7-13/6 * * *"], ["weekly", "0 9 * * *"], ["weekly", "5 8 * * 6"], ["jalaliMonthly", "0 8 1 * *"], ["", ""]];
  const bad: Array<[string, string]> = [["custom", "0 9 * * *"], ["daily", "0 9 * * *"], ["hourly", "0 * * * *"], ["hourly", "*/30 * * * *"], ["hourly", "30 7,13 * * *"], ["weekly", "0 8 * * 6,0"], ["monthly", "0 8 1 * *"], ["minutely", "*/5 * * * *"]];
  for (const [t, c] of ok) if (editorScheduleError(t, c)) throw new Error(`should pass: ${t} ${c}`);
  for (const [t, c] of bad) if (!editorScheduleError(t, c)) throw new Error(`should fail: ${t} ${c}`);
  console.log("editorSchedule ok");
}
