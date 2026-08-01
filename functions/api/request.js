import { config } from "./_config.js";

const CN = "日一二三四五六";
const pad = n => String(n).padStart(2, "0");

async function notify(env, c, b) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const info = c.kind[b.k];
  const day = new Date(b.date + "T00:00:00Z");
  const end = new Date(new Date(b.date + "T" + b.time + ":00Z").getTime() + info.h * 3600000);
  const lines = [
    "💅 新预约申请",
    "",
    "姓名 · " + b.name,
    "微信 · " + b.wechat,
    "时间 · " + (day.getUTCMonth() + 1) + "月" + day.getUTCDate() + "日 周" + CN[day.getUTCDay()] +
      " " + b.time + " — " + pad(end.getUTCHours()) + ":" + pad(end.getUTCMinutes()),
    "款式 · " + info.label + "（约" + info.h + "小时）",
    "定金 · " + info.deposit + " €"
  ];
  if (b.note) lines.push("备注 · " + b.note);
  lines.push("", "→ 去管理页确认 https://qistudio.pages.dev");

  const r = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: lines.join("\n") })
  });
  if (!r.ok) console.log("telegram " + r.status + " " + await r.text());
}

const bad = (error) => Response.json({ error }, { status: 400 });
const paris = (opts) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", ...opts }).format(new Date());

function maxDate(today, ahead) {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + ahead);
  return d.toISOString().slice(0, 10);
}

export async function onRequestPost({ request, env, waitUntil }) {
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
  if (date > maxDate(today, c.daysAhead)) return bad("out of window");

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

  waitUntil(notify(env, c, { date, time, name, wechat, note, k: slot.k })
    .catch(e => console.log("telegram " + e)));

  const headers = { "Cache-Control": "no-store" };
  if (!cookie) headers["Set-Cookie"] =
    "qs_client=" + token + "; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax";
  return Response.json({ id, status: "pending" }, { headers });
}
