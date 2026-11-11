import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { callDeepSeek, parseNarrate } from './src/llm/narrator';

// Local stand-in for the Cloudflare Worker (worker/) on `npm run dev` and `npm run preview`: same
// request checks, same DeepSeek call, with the key from .env so it never reaches the browser. No rate limits.
function narrator(apiKey: string): Plugin {
  const use = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use('/narrate', async (req, res) => {
      const send = (status: number, body: string) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
      };
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* falls through to the 400 below */
      }
      const r = parseNarrate(parsed);
      if (req.method !== 'POST' || !r) return send(400, '{"error":"bad request"}');
      if (!apiKey) return send(500, '{"error":"DEEPSEEK_API_KEY missing from .env"}');
      const up = await callDeepSeek(r, apiKey);
      send(up.status, await up.text());
    });
  };
  return { name: 'narrator', configureServer: use, configurePreviewServer: use };
}

// /llm -> local llama.cpp server (npm run llm), an optional offline narrator for development.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './', // relative asset paths: the same build runs on GitHub Pages and inside itch.io's iframe
    plugins: [react(), narrator(env.DEEPSEEK_API_KEY ?? '')],
    server: {
      proxy: {
        '/llm': {
          target: 'http://127.0.0.1:8080',
          rewrite: (p) => p.replace(/^\/llm/, ''),
        },
      },
    },
  };
});
