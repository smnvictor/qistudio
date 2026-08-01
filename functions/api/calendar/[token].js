import { config } from "../_config.js";

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const floating = d => d.toISOString().slice(0, 19).replace(/[-:]/g, "");

export async function onRequestGet({ request, env, params }) {
  const token = String(params.token || "");
  if (!token.endsWith(".ics") || !timingSafeEqual(token.slice(0, -4), env.ICS_TOKEN || "")) {
    return new Response("Not found", { status: 404 });
  }

  const c = await config(request, env);
  const rows = await env.DB.prepare(
    "SELECT id, date AS d, time AS t, service AS k " +
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
      "SUMMARY:💅 " + r.t,
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
