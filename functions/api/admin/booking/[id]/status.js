import { requireAdmin, unauthorized } from "../../_auth.js";

const NEXT = {
  pending: ["confirmed", "declined"],
  confirmed: ["cancelled"]
};

export async function onRequestPost({ request, env, params }) {
  if (!await requireAdmin(request, env)) return unauthorized();

  const body = await request.json().catch(() => null);
  const to = body ? String(body.status || "") : "";

  const row = await env.DB.prepare("SELECT status FROM booking WHERE id = ?1").bind(params.id).first();
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (!(NEXT[row.status] || []).includes(to)) return Response.json({ error: "bad transition" }, { status: 400 });

  const result = await env.DB.prepare(
    "UPDATE booking SET status = ?1 WHERE id = ?2 AND status = ?3 " +
    "AND (status != 'pending' OR julianday(created_at) > julianday(?4))"
  ).bind(to, params.id, row.status, new Date(Date.now() - 86400000).toISOString()).run();
  if (!result.meta.changes) return Response.json({ error: "booking changed" }, { status: 409 });
  return Response.json({ id: params.id, status: to }, { headers: { "Cache-Control": "no-store" } });
}
