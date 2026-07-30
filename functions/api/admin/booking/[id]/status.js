import { requireAdmin, unauthorized } from "../../_auth.js";

const NEXT = {
  pending: ["approved", "declined"],
  approved: ["confirmed", "cancelled"],
  confirmed: ["cancelled"]
};

export async function onRequestPost({ request, env, params }) {
  if (!await requireAdmin(request, env)) return unauthorized();

  const body = await request.json().catch(() => null);
  const to = body ? String(body.status || "") : "";

  const row = await env.DB.prepare("SELECT status FROM booking WHERE id = ?1").bind(params.id).first();
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (!(NEXT[row.status] || []).includes(to)) return Response.json({ error: "bad transition" }, { status: 400 });

  await env.DB.prepare("UPDATE booking SET status = ?1 WHERE id = ?2").bind(to, params.id).run();
  return Response.json({ id: params.id, status: to }, { headers: { "Cache-Control": "no-store" } });
}
