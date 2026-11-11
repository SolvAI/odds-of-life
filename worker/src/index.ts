import { DurableObject } from 'cloudflare:workers';
import { callDeepSeek, parseNarrate } from '../../src/llm/narrator';

/**
 * Counts calls per UTC day, globally and per visitor. Visitors are stored as a hash of
 * IP + day, so no raw IP address is ever kept, and old days are deleted as we go.
 */
export class Quota extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS hits (day TEXT, who TEXT, n INTEGER, PRIMARY KEY (day, who))');
  }

  take(day: string, who: string, dayLimit: number, ipLimit: number): 'ok' | 'day' | 'ip' {
    const sql = this.ctx.storage.sql;
    const count = (w: string) => (sql.exec<{ n: number }>('SELECT n FROM hits WHERE day = ? AND who = ?', day, w).toArray()[0]?.n ?? 0);
    if (count('*') >= dayLimit) return 'day';
    if (count(who) >= ipLimit) return 'ip';
    for (const w of ['*', who]) sql.exec('INSERT INTO hits VALUES (?, ?, 1) ON CONFLICT (day, who) DO UPDATE SET n = n + 1', day, w);
    sql.exec('DELETE FROM hits WHERE day < ?', day);
    return 'ok';
  }
}

const MAX_BODY = 30_000;

function allowedOrigin(origin: string, list: string): boolean {
  return list.split(',').map((s) => s.trim()).some((rule) => {
    if (!rule.includes('*')) return origin === rule;
    const [scheme, host] = rule.split('://*.');
    return origin.startsWith(`${scheme}://`) && origin.endsWith(`.${host}`) && /^[a-z0-9.-]+$/.test(origin.slice(scheme.length + 3));
  });
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') ?? '';
    const ok = origin !== '' && allowedOrigin(origin, env.ALLOWED_ORIGINS);
    const cors: Record<string, string> = ok
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };
    const reply = (status: number, error: string) => Response.json({ error }, { status, headers: cors });

    // Browsers on other sites are refused here. Scripts can fake an Origin header,
    // so everything below still assumes the caller may be hostile.
    if (!ok) return reply(403, 'origin not allowed');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/narrate') return reply(404, 'not found');

    const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (!(await env.BURST.limit({ key: ip })).success) return reply(429, 'burst');

    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(413, 'too large');
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      /* rejected just below */
    }
    const r = parseNarrate(body);
    if (!r) return reply(400, 'bad request');

    const day = new Date().toISOString().slice(0, 10);
    const quota = env.QUOTA.get(env.QUOTA.idFromName('global'));
    const verdict = await quota.take(day, await sha256(`${ip}|${day}`), Number(env.DAILY_LIMIT), Number(env.IP_DAILY_LIMIT));
    if (verdict !== 'ok') return reply(429, verdict === 'day' ? 'daily budget used up' : 'ip daily limit');

    const up = await callDeepSeek(r, env.DEEPSEEK_API_KEY);
    if (!up.ok) return reply(502, `narrator upstream ${up.status}`);
    const data = (await up.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
    // Only the generated text goes back, nothing else from the upstream response.
    return Response.json({ choices: [{ message: { content: data.choices?.[0]?.message?.content ?? '' } }] }, { headers: cors });
  },
} satisfies ExportedHandler<Env>;
