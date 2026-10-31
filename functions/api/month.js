import { config } from './_config.js';
import { bookingTimes } from './_schedule.js';

export async function onRequestGet({ request, env }) {
  const m = new URL(request.url).searchParams.get('m') || '';
  if (!/^\d{4}-\d{2}$/.test(m)) return Response.json({ error: 'bad month' }, { status: 400 });
  const [bookings, exceptions, schedules] = await env.DB.batch([
    env.DB.prepare("SELECT id,date AS d,time AS t,service AS k,status FROM booking WHERE substr(date,1,7) = ? AND status IN ('pending','confirmed')").bind(m),
    env.DB.prepare('SELECT date AS d,time AS t,reason FROM slot_exception WHERE substr(date,1,7) = ?').bind(m),
    env.DB.prepare('SELECT date AS d,revision,durations FROM day_schedule WHERE substr(date,1,7) = ?').bind(m)
  ]);
  const c = await config(request, env);
  return Response.json({
    bookings: await bookingTimes(env, c, bookings.results), exceptions: exceptions.results,
    schedules: schedules.results.map(s => ({ ...s, durations: JSON.parse(s.durations) }))
  }, { headers: { 'Cache-Control': 'no-store' } });
}
