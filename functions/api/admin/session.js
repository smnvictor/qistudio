import { requireAdmin } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  return Response.json({ admin: await requireAdmin(request, env) },
    { headers: { "Cache-Control": "no-store" } });
}
