let cfg = null;

async function config(request, env) {
  if (!cfg) {
    const html = await (await env.ASSETS.fetch(new URL("/", request.url))).text();
    cfg = JSON.parse(html.match(/<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/)[1]);
  }
  return cfg;
}

const bad = (error) => Response.json({ error }, { status: 400 });
const paris = (opts) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", ...opts }).format(new Date());

function maxMonth(today, ahead) {
  const m = +today.slice(5, 7) - 1 + ahead;
  return (+today.slice(0, 4) + Math.floor(m / 12)) + "-" + String((m % 12) + 1).padStart(2, "0");
}

export async function onRequestPost({ request, env }) {
  const c = await config(request, env);
  const body = await request.json().catch(() => null);
  if (!body) return bad("bad body");

  const date = String(body.date || "");
  const time = String(body.time || "");
  const name = String(body.name || "").trim();
  const wechat = String(body.wechat || "").trim();
  const note = String(body.note || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("bad date");
  if (!name || !wechat) return bad("missing fields");
  if (name.length > 60 || wechat.length > 60 || note.length > 500) return bad("too long");

  const today = paris({ year: "numeric", month: "2-digit", day: "2-digit" });
  if (date < today) return bad("past date");
  if (date.slice(0, 7) > maxMonth(today, c.monthsAhead)) return bad("out of window");

  const slot = (c.rules[String(new Date(date + "T00:00:00Z").getUTCDay())] || []).find(s => s.t === time);
  if (!slot) return bad("bad slot");
  if (date === today && time <= paris({ hour: "2-digit", minute: "2-digit", hour12: false })) return bad("past slot");

  const closed = await env.DB.prepare(
    "SELECT 1 FROM slot_exception WHERE date = ?1 AND (time IS NULL OR time = ?2)"
  ).bind(date, time).first();
  if (closed) return Response.json({ error: "closed" }, { status: 409 });

  const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)qs_client=([^;]+)/);
  const token = cookie ? cookie[1] : crypto.randomUUID();
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      "INSERT INTO booking (id,date,time,service,client_name,wechat_id,note,status,client_token,created_at) " +
      "VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8,?9)"
    ).bind(id, date, time, slot.k, name, wechat, note || null, token, new Date().toISOString()).run();
  } catch (e) {
    return Response.json({ error: "taken" }, { status: 409 });
  }

  const headers = { "Cache-Control": "no-store" };
  if (!cookie) headers["Set-Cookie"] =
    "qs_client=" + token + "; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax";
  return Response.json({ id, status: "pending" }, { headers });
}
