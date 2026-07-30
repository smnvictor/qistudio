let cfg = null;

export async function config(request, env) {
  if (!cfg) {
    const html = await (await env.ASSETS.fetch(new URL("/", request.url))).text();
    cfg = JSON.parse(html.match(/<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/)[1]);
  }
  return cfg;
}
