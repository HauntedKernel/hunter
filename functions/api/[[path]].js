/**
 * Cloudflare Pages Function — proxies /api/* to the backend.
 *
 * The browser only ever talks to the Pages origin (hunter.living), so:
 *   - no CORS (same-origin),
 *   - the backend URL isn't baked into the JS bundle (it's a Pages env var),
 *   - the frontend uses relative /api paths (VITE_API_BASE stays unset).
 *
 * Set on the Pages project (Settings → Environment variables):
 *   API_ORIGIN = backend public URL, e.g. https://api.hunter.living
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const origin = env.API_ORIGIN;

  if (!origin) {
    return new Response(
      JSON.stringify({ success: false, error: 'API_ORIGIN is not configured on the Pages project' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }

  const segments = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const search = new URL(request.url).search;
  const target = `${origin.replace(/\/$/, '')}/api/${segments}${search}`;

  const init = { method: request.method, headers: request.headers };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const resp = await fetch(target, init);
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
}
