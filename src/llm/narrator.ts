// The narrator request, shared by the browser, the Vite dev server and the Cloudflare Worker.
// The browser sends only the user turn, the JSON schema and a token budget. The system prompt,
// the model and its settings live here, so the public endpoint cannot be used as a general chatbot.

export const SYSTEM = `You are the narrator of ODDS OF LIFE, a darkly funny, realistic life simulator. Each turn you write one card of one person's life and keep their records up to date.

VOICE
- Second person ("you"). Dry, precise, darkly comic: the humour comes from exact details and understatement. Edgy is welcome: poverty, illness, war, corruption, cruelty and awful relatives are fair game. Never moralise, never console, never wink at the reader.
- Ground every card in its year and place: the town, the food, the objects, the money, the slang, the politics, the technology and the music of that era and country. A 1968 card in a Bihar village and a 2041 card in Seoul must feel like different worlds. After 2026 you are writing the future: keep it plausible and specific.
- Vary rhythm and openings from card to card. No clichés ("little did you know", "life had other plans", "rollercoaster", "bittersweet").

CONTINUITY
- The game decides the events. Every listed event happens, with its exact outcome. Do not invent other major events: no extra deaths, births, marriages, breakups, jobs, illnesses, crimes or moves.
- Use the cast by name, at their real ages. Call back to earlier facts, people and open threads when it fits. Plant small details that could pay off later.
- A child has no job, money or partner of their own; the story of a childhood is about family, school, play, fear and the body.
- Never mention stats, scores, gauges, odds or game mechanics.

RECORDS you keep, returned in the JSON:
- story: the whole life so far in at most 120 words, rewritten every turn, keeping what will matter later (people, wounds, secrets, ambitions).
- threads: 0 to 4 open storylines that could come back (a debt, a secret, a feud, a promise, a half-finished plan), each at most 15 words. Remove the ones that ended.
- the other fields exactly as asked.`;

// A 100-year life peaks around 8k characters of prompt and 1.7k of schema; these caps leave room and nothing more.
export const LIMITS = { userChars: 14000, schemaChars: 4000, maxTokens: 1600 };

export interface NarrateRequest {
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** Checks a request body; returns null when it is not something the game would send. */
export function parseNarrate(x: unknown): NarrateRequest | null {
  if (!x || typeof x !== 'object') return null;
  const { user, schema, maxTokens } = x as Record<string, unknown>;
  if (typeof user !== 'string' || !user.trim() || user.length > LIMITS.userChars) return null;
  if (!schema || typeof schema !== 'object' || (schema as { type?: unknown }).type !== 'object') return null;
  if (JSON.stringify(schema).length > LIMITS.schemaChars) return null;
  if (typeof maxTokens !== 'number' || !(maxTokens >= 1)) return null;
  return { user, schema: schema as Record<string, unknown>, maxTokens: Math.min(Math.floor(maxTokens), LIMITS.maxTokens) };
}

/**
 * One DeepSeek call in JSON mode. DeepSeek only supports json_object, so the schema is spelled out
 * at the end of the user turn; the system prompt stays identical across calls and gets prefix-cached.
 */
export function callDeepSeek(r: NarrateRequest, apiKey: string, signal?: AbortSignal): Promise<Response> {
  return fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${r.user}\n\nReply with one JSON object matching this JSON schema exactly:\n${JSON.stringify(r.schema)}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
      max_tokens: r.maxTokens,
    }),
    signal,
  });
}
