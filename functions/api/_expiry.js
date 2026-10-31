export async function expireBookings(env, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString();
  await env.DB.prepare(
    "UPDATE booking SET status = 'cancelled', expired_at = ? WHERE status = 'pending' AND julianday(created_at) <= julianday(?)"
  ).bind(now.toISOString(), cutoff).run();
}
