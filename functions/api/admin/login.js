import { adminToken, unauthorized } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!env.ADMIN_PASSWORD || !body || String(body.password || "") !== env.ADMIN_PASSWORD) {
    return unauthorized();
  }

  return Response.json({ admin: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": "qs_admin=" + await adminToken(env) +
        "; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict"
    }
  });
}
