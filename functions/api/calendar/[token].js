import { config } from "../_config.js";

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const esc = s => String(s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function fold(line) {
  const b = new TextEncoder().encode(line);
  if (b.length <= 75) return line;
  const out = [];
  const dec = new TextDecoder();
  for (let start = 0; start < b.length; ) {
    let len = Math.min(start === 0 ? 75 : 74, b.length - start);
    while (len > 1 && (b[start + len] & 0xC0) === 0x80) len--;
    out.push(dec.decode(b.slice(start, start + len)));
    start += len;
  }
  return out.join("\r\n ");
}

const floating = d => d.toISOString().slice(0, 19).replace(/[-:]/g, "");

export async function onRequestGet({ request, env, params }) {
  const token = String(params.token || "");
  if (!token.endsWith(".ics") || !timingSafeEqual(token.slice(0, -4), env.ICS_TOKEN || "")) {
    return new Response("Not found", { status: 404 });
  }

  const c = await config(request, env);
  const rows = await env.DB.prepare(
    "SELECT id, date AS d, time AS t, service AS k, client_name AS name, wechat_id AS wx, note " +
    "FROM booking WHERE status = 'confirmed' ORDER BY date, time"
  ).all();

  const stamp = floating(new Date()) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Qistudio Paris//Booking//CN",
    "CALSCALE:GREGORIAN"
  ];

  for (const r of rows.results) {
    const info = c.kind[r.k];
    const start = new Date(r.d + "T" + r.t + ":00Z");
    const end = new Date(start.getTime() + info.h * 3600000);
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + r.id + "@qistudio",
      "DTSTAMP:" + stamp,
      "DTSTART:" + floating(start),
      "DTEND:" + floating(end),
      fold("SUMMARY:" + esc("美甲 · " + r.name + "（" + info.label + "）")),
      fold("LOCATION:" + esc(c.addr)),
      fold("DESCRIPTION:" + esc("微信 " + r.wx + "\n" + info.label + " 约" + info.h + "小时" +
        (r.note ? "\n备注 " + r.note : ""))),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}
