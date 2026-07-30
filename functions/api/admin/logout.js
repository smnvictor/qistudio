export async function onRequestPost() {
  return Response.json({ admin: false }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": "qs_admin=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict"
    }
  });
}
