import { requireAdmin, unauthorized } from './_auth.js';
import { config } from '../_config.js';
import { validDate, slotsFor, scheduleFor, paris } from '../_schedule.js';

export async function onRequestPost({ request, env }) {
  if (!await requireAdmin(request, env)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || !validDate(body.date) || !Number.isInteger(body.duration) ||
      body.duration < 30 || body.duration > 720 || body.duration % 30 || !Number.isInteger(body.revision)) {
    return Response.json({ error: 'bad duration' }, { status: 400 });
  }
  const c = await config(request, env);
  const current = await scheduleFor(env, body.date);
  if (body.revision !== current.revision) return Response.json({ error: 'schedule changed' }, { status: 409 });
  const before = slotsFor(c, body.date, current.durations);
  const target = before.find(s => s.base === body.time);
  const now = paris();
  if (!target || body.date < now.date || (body.date === now.date && target.t <= now.time)) {
    return Response.json({ error: 'past slot' }, { status: 400 });
  }
  const durations = { ...current.durations, [body.time]: body.duration };
  const after = slotsFor(c, body.date, durations);
  if (after.some(s => s.t < '06:00' || s.end > 1440)) {
    return Response.json({ error: 'day overflow' }, { status: 400 });
  }
  const result = await env.DB.prepare(
    'INSERT INTO day_schedule(date,revision,durations) VALUES (?1,1,?2) ' +
    'ON CONFLICT(date) DO UPDATE SET durations = excluded.durations, revision = day_schedule.revision + 1 ' +
    'WHERE day_schedule.revision = ?3'
  ).bind(body.date, JSON.stringify(durations), body.revision).run();
  if (!result.meta.changes) return Response.json({ error: 'schedule changed' }, { status: 409 });
  return Response.json({ revision: current.revision + 1 }, { headers: { 'Cache-Control': 'no-store' } });
}
