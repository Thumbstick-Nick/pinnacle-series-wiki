/**
 * Pinnacle Eagle Chatbot — Cloudflare Worker proxy
 *
 * Holds the Anthropic API key server-side and proxies wiki questions to Claude.
 * Deploy this to Cloudflare Workers and set ANTHROPIC_API_KEY as a secret.
 *
 * Edit ALLOWED_ORIGINS if your wiki lives somewhere else.
 */

const ALLOWED_ORIGINS = [
  "https://thumbstick-nick.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_QUERY_LEN = 500;
const MAX_CONTEXT_LEN = 30000;
const MAX_OUTPUT_TOKENS = 600;

const SYSTEM_PROMPT =
  "You are the Pinnacle Eagle, a friendly internal-wiki assistant for Eagle Point Software's Pinnacle Series. " +
  "Answer the user's question using ONLY the wiki sections provided in the context. " +
  "If the answer isn't in those sections, say so honestly and suggest a keyword they could search instead. " +
  "Keep answers concise: 2-4 sentences usually, longer only if the question genuinely needs detail. " +
  "Use **bold** for key terms, `code` for UI labels and permission names, and plain prose otherwise. Never write HTML. " +
  "ALWAYS cite your sources at the end using markers like [source: section-id], using the exact section IDs from the context. " +
  "Cite at most 2 sources, the ones the answer actually came from.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(allowOrigin) });
    }
    if (request.method !== "POST") {
      return errorResponse("Use POST", 405, allowOrigin);
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return errorResponse("Forbidden origin", 403, allowOrigin);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return errorResponse("Server misconfigured: ANTHROPIC_API_KEY not set", 500, allowOrigin);
    }

    let body;
    try { body = await request.json(); }
    catch { return errorResponse("Invalid JSON body", 400, allowOrigin); }

    const query = (body.query || "").toString();
    const context = (body.context || "").toString();
    if (!query) return errorResponse("Missing 'query'", 400, allowOrigin);
    if (!context) return errorResponse("Missing 'context'", 400, allowOrigin);
    if (query.length > MAX_QUERY_LEN) return errorResponse(`Query exceeds ${MAX_QUERY_LEN} chars`, 400, allowOrigin);
    if (context.length > MAX_CONTEXT_LEN) return errorResponse(`Context exceeds ${MAX_CONTEXT_LEN} chars`, 400, allowOrigin);

    const userPrompt = `<wiki_context>\n${context}\n</wiki_context>\n\nQuestion: ${query}`;

    let claudeResp;
    try {
      claudeResp = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })
      });
    } catch (err) {
      return errorResponse(`Upstream fetch failed: ${err.message}`, 502, allowOrigin);
    }

    if (!claudeResp.ok) {
      const text = await claudeResp.text();
      console.error("Anthropic error:", claudeResp.status, text.slice(0, 500));
      return errorResponse(`Anthropic ${claudeResp.status}`, claudeResp.status, allowOrigin);
    }

    const data = await claudeResp.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "";
    const usage = data.usage || {};

    return new Response(JSON.stringify({ text, usage }), {
      headers: corsHeaders(allowOrigin)
    });
  }
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "content-type": "application/json"
  };
}

function errorResponse(message, status, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders(origin)
  });
}
