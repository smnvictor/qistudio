export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM booking").first();
  return Response.json({ bookings: row.n });
}
