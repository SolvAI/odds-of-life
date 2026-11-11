import type { Prompt } from './prompts';
import { callDeepSeek } from './narrator';

export type Backend = 'local' | 'deepseek';

export interface LlmConfig {
  backend: Backend;
  baseUrl: string; // '/llm' (Vite proxy) or the narrator endpoint ('/narrate' in dev, the Worker URL in production)
  apiKey?: string; // scripts only: they call DeepSeek directly; the browser goes through the narrator endpoint
  timeoutMs: number;
  temperature: number;
}

export interface LlmResult<T> {
  data: T;
  ms: number;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * One narrator call returning parsed JSON.
 * Local llama.cpp gets a strict JSON schema (grammar constrained). DeepSeek requests go through
 * the narrator endpoint (see narrator.ts), which owns the system prompt and the model settings.
 */
export async function completeJson<T>(cfg: LlmConfig, p: Prompt, signal?: AbortSignal): Promise<LlmResult<T>> {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
  signal?.addEventListener('abort', () => ctl.abort());
  const local = cfg.backend === 'local';
  try {
    let res: Response;
    if (local) {
      res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
          temperature: cfg.temperature,
          max_tokens: p.maxTokens,
          response_format: { type: 'json_schema', json_schema: { name: 'card', strict: true, schema: p.schema } },
          chat_template_kwargs: { enable_thinking: false },
          top_k: 50,
          repeat_penalty: 1.1,
        }),
        signal: ctl.signal,
      });
    } else {
      const req = { user: p.user, schema: p.schema, maxTokens: p.maxTokens };
      res = cfg.apiKey
        ? await callDeepSeek(req, cfg.apiKey, ctl.signal)
        : await fetch(cfg.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal });
    }
    if (!res.ok) throw new Error(`${cfg.backend} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    return {
      data: JSON.parse(content) as T,
      ms: Date.now() - started,
      tokensIn: json.usage?.prompt_tokens,
      tokensOut: json.usage?.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}
