export const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const clock = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
export const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
export const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export const paris = (now = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

export function slotsFor(c, date, durations = {}) {
  let shift = 0;
  return (c.rules[weekday(date)] || []).map(s => {
    const duration = durations[s.t] ?? c.kind[s.k].h * 60;
    const start = minutes(s.t) + shift;
    shift += duration - c.kind[s.k].h * 60;
    return { base: s.t, t: clock(start), k: s.k, duration, end: start + duration };
  });
}

export async function scheduleFor(env, date) {
  const row = await env.DB.prepare('SELECT revision, durations FROM day_schedule WHERE date = ?')
    .bind(date).first();
  return { revision: row?.revision || 0, durations: JSON.parse(row?.durations || '{}') };
}

export function isClosed(c, date, time, exceptions) {
  const day = exceptions.find(e => e.d === date && e.t === null);
  const slot = exceptions.find(e => e.d === date && e.t === time);
  if (day && day.reason !== 'open') return true;
  if (slot) return slot.reason !== 'open';
  if (day) return false;
  return (c.closedDays || []).includes(weekday(date)) ||
    (c.rules[weekday(date)] || []).some(s => s.t === time && s.closed === true);
}

export async function bookingTimes(env, c, bookings) {
  if (!bookings.length) return bookings;
  const schedules = await env.DB.prepare('SELECT date, durations FROM day_schedule').all();
  const byDate = new Map(schedules.results.map(r => [r.date, JSON.parse(r.durations)]));
  return bookings.map(b => {
    const durations = byDate.get(b.d) || {};
    const s = slotsFor(c, b.d, durations).find(s => s.base === b.t);
    return { ...b, base: b.t, t: s?.t || b.t,
      h: (durations[b.t] ?? c.kind[b.k].h * 60) / 60 };
  });
}
