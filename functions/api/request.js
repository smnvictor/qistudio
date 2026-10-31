import { config } from './_config.js';
import { notify } from './_telegram.js';
import { validDate, paris, slotsFor, scheduleFor, isClosed } from './_schedule.js';

const bad = error => Response.json({ error }, { status: 400 });

export async function onRequestPost(context) {
  const { request, env } = context;
  const now = paris();
  if (now.time < '06:00') return Response.json({ error: 'night booking' }, { status: 403 });
  const c = await config(request, env);
  const body = await request.json().catch(() => null);
  if (!body) return bad('bad body');
  const date = String(body.date || '');
  const time = String(body.time || '');
  const name = String(body.name || '').trim();
  const wechat = String(body.wechat || '').trim();
  const note = String(body.note || '').trim();
  if (!validDate(date)) return bad('bad date');
  if (!name || !wechat) return bad('missing fields');
  if (name.length > 60 || wechat.length > 60 || note.length > 500) return bad('too long');
  const last = new Date(now.date + 'T00:00:00Z');
  last.setUTCDate(last.getUTCDate() + c.daysAhead);
  if (date < now.date) return bad('past date');
  if (date > last.toISOString().slice(0, 10)) return bad('out of window');
  const schedule = await scheduleFor(env, date);
  if (body.revision !== schedule.revision) return Response.json({ error: 'schedule changed' }, { status: 409 });
  const slot = slotsFor(c, date, schedule.durations).find(s => s.base === time);
  if (!slot) return bad('bad slot');
  if (date === now.date && slot.t <= now.time) return bad('past slot');
  const exceptions = await env.DB.prepare('SELECT date AS d,time AS t,reason FROM slot_exception WHERE date = ?')
    .bind(date).all();
  if (isClosed(c, date, time, exceptions.results)) return Response.json({ error: 'closed' }, { status: 409 });
  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)qs_client=([^;]+)/);
  const token = cookie ? cookie[1] : crypto.randomUUID();
  const id = crypto.randomUUID();
  let result;
  try {
    result = await env.DB.prepare(
      'INSERT INTO booking (id,date,time,service,client_name,wechat_id,note,status,client_token,created_at) ' +
      "SELECT ?1,?2,?3,?4,?5,?6,?7,'pending',?8,?9 " +
      'WHERE COALESCE((SELECT revision FROM day_schedule WHERE date = ?2),0) = ?10'
    ).bind(id, date, time, slot.k, name, wechat, note || null, token, new Date().toISOString(), schedule.revision).run();
  } catch (e) {
    if (!String(e).includes('UNIQUE constraint')) throw e;
    return Response.json({ error: 'taken' }, { status: 409 });
  }
  if (!result.meta.changes) return Response.json({ error: 'schedule changed' }, { status: 409 });
  context.waitUntil(notify(env, c, { id, d: date, t: slot.t, name, wx: wechat, note, k: slot.k, h: slot.duration / 60 })
    .catch(() => console.error('New booking Telegram notification failed')));
  const headers = { 'Cache-Control': 'no-store' };
  if (!cookie) headers['Set-Cookie'] =
    'qs_client=' + token + '; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax';
  return Response.json({ id, status: 'pending' }, { headers });
}
