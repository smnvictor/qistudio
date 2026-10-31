import { requireAdmin, unauthorized } from './_auth.js';
import { config } from '../_config.js';
import { validDate, slotsFor, scheduleFor, isClosed, paris } from '../_schedule.js';

export async function onRequestPost({ request, env }) {
  if (!await requireAdmin(request, env)) return unauthorized();
  const body = await request.json().catch(() => null);
  const date = body ? String(body.date || '') : '';
  const time = body?.time ? String(body.time) : null;
  if (!validDate(date) || date < paris().date) return Response.json({ error: 'bad date' }, { status: 400 });
  const c = await config(request, env);
  const schedule = await scheduleFor(env, date);
  const slots = slotsFor(c, date, schedule.durations);
  if (time && !slots.some(s => s.base === time)) return Response.json({ error: 'bad time' }, { status: 400 });
  const exceptions = await env.DB.prepare('SELECT date AS d,time AS t,reason FROM slot_exception WHERE date = ?')
    .bind(date).all();
  const day = exceptions.results.find(e => e.t === null);
  if (time && day && day.reason !== 'open') return Response.json({ error: 'day closed' }, { status: 409 });
  const closed = time ? isClosed(c, date, time, exceptions.results)
    : day ? day.reason !== 'open' : (c.closedDays || []).includes(new Date(date + 'T00:00:00Z').getUTCDay());
  if (!closed) {
    const busy = await env.DB.prepare(
      "SELECT 1 FROM booking WHERE date = ?1 AND (?2 IS NULL OR time = ?2) AND status IN ('pending','confirmed')"
    ).bind(date, time).first();
    if (busy) return Response.json({ error: 'busy' }, { status: 409 });
  }
  const where = 'date = ?1 AND time IS ?2';
  await env.DB.batch([
    env.DB.prepare('DELETE FROM slot_exception WHERE ' + where).bind(date, time),
    env.DB.prepare('INSERT INTO slot_exception(date,time,reason) VALUES (?,?,?)').bind(date, time, closed ? 'open' : 'closed')
  ]);
  return Response.json({ closed: !closed }, { headers: { 'Cache-Control': 'no-store' } });
}
