export async function onRequestGet({ request, env }) {
  const m = new URL(request.url).searchParams.get("m") || "";
  if (!/^\d{4}-\d{2}$/.test(m)) return Response.json({ error: "bad month" }, { status: 400 });

  const bookings = await env.DB.prepare(
    "SELECT id, date AS d, time AS t, service AS k, status FROM booking " +
    "WHERE substr(date,1,7) = ?1 AND status IN ('pending','confirmed')"
  ).bind(m).all();

  const exceptions = await env.DB.prepare(
    "SELECT date AS d, time AS t FROM slot_exception WHERE substr(date,1,7) = ?1"
  ).bind(m).all();

  return Response.json(
    { bookings: bookings.results, exceptions: exceptions.results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
