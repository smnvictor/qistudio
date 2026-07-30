const enc = new TextEncoder();

export function cookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

export async function adminToken(env) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.ADMIN_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("qistudio-admin"));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function requireAdmin(request, env) {
  const got = cookie(request, "qs_admin");
  if (!got || !env.ADMIN_PASSWORD) return false;
  return got === await adminToken(env);
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
