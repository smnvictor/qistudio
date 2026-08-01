import { requireAdmin, unauthorized } from "./_auth.js";

const ACTIVE = "status IN ('pending','confirmed')";

export async function onRequestPost({ request, env }) {
  if (!await requireAdmin(request, env)) return unauthorized();

  const body = await request.json().catch(() => null);
  const date = body ? String(body.date || "") : "";
  const time = body && body.time ? String(body.time) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "bad date" }, { status: 400 });
  if (time !== null && !/^\d{2}:\d{2}$/.test(time)) return Response.json({ error: "bad time" }, { status: 400 });

  const where = time ? "date = ?1 AND time = ?2" : "date = ?1 AND time IS NULL";
  const bind = time ? [date, time] : [date];

  const existing = await env.DB.prepare("SELECT 1 FROM slot_exception WHERE " + where).bind(...bind).first();
  if (existing) {
    await env.DB.prepare("DELETE FROM slot_exception WHERE " + where).bind(...bind).run();
    return Response.json({ closed: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const busy = await env.DB.prepare(
    "SELECT 1 FROM booking WHERE date = ?1 " + (time ? "AND time = ?2 " : "") + "AND " + ACTIVE
  ).bind(...bind).first();
  if (busy) return Response.json({ error: "busy" }, { status: 409 });

  await env.DB.prepare("INSERT INTO slot_exception (date,time,reason) VALUES (?1,?2,NULL)")
    .bind(date, time).run();
  return Response.json({ closed: true }, { headers: { "Cache-Control": "no-store" } });
}
