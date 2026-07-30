export async function onRequestGet({ request, env }) {
  const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)qs_client=([^;]+)/);
  if (!cookie) return Response.json({ bookings: [] }, { headers: { "Cache-Control": "no-store" } });

  const r = await env.DB.prepare(
    "SELECT id, date AS d, time AS t, service AS k, status FROM booking " +
    "WHERE client_token = ?1 ORDER BY date, time"
  ).bind(cookie[1]).all();

  return Response.json({ bookings: r.results }, { headers: { "Cache-Control": "no-store" } });
}
