import { requireAdmin, unauthorized } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return unauthorized();

  const m = new URL(request.url).searchParams.get("m") || "";
  if (!/^\d{4}-\d{2}$/.test(m)) return Response.json({ error: "bad month" }, { status: 400 });

  const r = await env.DB.prepare(
    "SELECT id, date AS d, time AS t, service AS k, client_name AS name, wechat_id AS wx, note, status " +
    "FROM booking WHERE substr(date,1,7) = ?1 AND status IN ('pending','confirmed') " +
    "ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, date, time"
  ).bind(m).all();

  return Response.json({ bookings: r.results }, { headers: { "Cache-Control": "no-store" } });
}
