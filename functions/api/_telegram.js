import { clock, minutes } from './_schedule.js';

export async function notify(env, c, b, expired = false) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    if (expired) throw new Error('Telegram credentials missing');
    return;
  }
  const info = c.kind[b.k];
  const day = new Date(b.d + 'T00:00:00Z');
  const lines = [
    expired ? '⌛ 预约已自动取消 · 超过24小时未确认' : '💅 新预约申请', '',
    '预约编号 · ' + b.id,
    '姓名 · ' + b.name,
    '微信 · ' + b.wx,
    '时间 · ' + b.d + ' 周' + '日一二三四五六'[day.getUTCDay()] +
      ' ' + b.t + ' — ' + clock(minutes(b.t) + b.h * 60),
    '款式 · ' + info.label + '（约' + b.h + '小时）',
    '定金 · ' + info.deposit + ' €'
  ];
  if (b.note) lines.push('备注 · ' + b.note);
  if (expired) {
    const local = value => new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short'
    }).format(new Date(value));
    lines.push('申请时间 · ' + local(b.created_at), '取消时间 · ' + local(b.expired_at),
      '原因 · 申请提交后24小时内未确认，时段已释放');
  }
  lines.push('', expired ? '→ 查看管理页 https://qistudio.pages.dev' : '→ 去管理页确认 https://qistudio.pages.dev');
  const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: lines.join('\n') }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await r.json();
  if (!r.ok || !result.ok) throw new Error('Telegram delivery failed (' + r.status + ')');
}
