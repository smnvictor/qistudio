import { config } from './_config.js';
import { expireBookings } from './_expiry.js';
import { bookingTimes } from './_schedule.js';
import { notify } from './_telegram.js';

export async function onRequestPost({ request, env }) {
  const expected = env.EXPIRY_TOKEN || '';
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!expected || got.length !== expected.length) return new Response('Unauthorized', { status: 401 });
  let different = 0;
  for (let i = 0; i < got.length; i++) different |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  if (different) return new Response('Unauthorized', { status: 401 });

  const now = new Date();
  await expireBookings(env, now);
  const rows = await env.DB.prepare(
    'SELECT id,date AS d,time AS t,service AS k,client_name AS name,wechat_id AS wx,note,created_at,expired_at ' +
    'FROM booking WHERE expired_at IS NOT NULL AND expiry_notified_at IS NULL ' +
    'AND (expiry_claimed_at IS NULL OR expiry_claimed_at < ?) ORDER BY expired_at LIMIT 3'
  ).bind(new Date(now.getTime() - 600000).toISOString()).all();
  if (!rows.results.length) return Response.json({ notified: 0 });
  const c = await config(request, env);
  let notified = 0;
  let failed = false;
  for (const row of await bookingTimes(env, c, rows.results)) {
    const claim = await env.DB.prepare(
      'UPDATE booking SET expiry_claimed_at = ? WHERE id = ? AND expiry_notified_at IS NULL ' +
      'AND (expiry_claimed_at IS NULL OR expiry_claimed_at < ?)'
    ).bind(now.toISOString(), row.id, new Date(now.getTime() - 600000).toISOString()).run();
    if (!claim.meta.changes) continue;
    try {
      await notify(env, c, row, true);
      await env.DB.prepare('UPDATE booking SET expiry_notified_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), row.id).run();
      notified++;
    } catch {
      await env.DB.prepare('UPDATE booking SET expiry_claimed_at = NULL WHERE id = ?').bind(row.id).run();
      console.error('Expired booking Telegram notification failed', row.id);
      failed = true;
    }
  }
  return Response.json({ notified }, { status: failed ? 502 : 200, headers: { 'Cache-Control': 'no-store' } });
}
