/* VG Auto Export - admin API proxy (Cloudflare Worker, deployed with the site).
 *
 * The admin panel (/admin/) saves changes by writing to the GitHub repository.
 * This Worker lets it do that with a simple admin password: the repository
 * token never leaves Cloudflare.
 *
 * Secrets (Cloudflare dashboard -> Workers & Pages -> vga-auto -> Settings -> Variables and Secrets):
 *   ADMIN_PASSWORD  the password printed in the client manual
 *   GITHUB_TOKEN    fine-grained token: repo st0ckitch/vga-auto, Contents: Read and write
 *
 * Routes:
 *   GET /api/admin/ping                 -> { ok } (200 when both secrets are set, else 503)
 *   *   /api/admin/github/repos/<repo>/… -> forwarded to api.github.com with the token,
 *                                           only after the X-Admin-Password header matches
 * Everything else is served from the static site.
 */
const REPO = 'st0ckitch/vga-auto';
const API_PREFIX = '/api/admin/github';
const ALLOWED_PATH = new RegExp('^/repos/' + REPO + '(/|$)');
const ALLOWED_METHODS = ['GET', 'PUT', 'DELETE'];

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/* constant-time comparison of two secrets (compares SHA-256 digests, so length never leaks) */
async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const configured = Boolean(env.ADMIN_PASSWORD && env.GITHUB_TOKEN);

    if (url.pathname === '/api/admin/ping') {
      return json(configured ? 200 : 503, { ok: configured });
    }

    if (url.pathname.startsWith(API_PREFIX + '/')) {
      if (!configured) return json(503, { message: 'admin proxy not configured' });

      const given = request.headers.get('x-admin-password') || '';
      if (!given || !(await sameSecret(given, env.ADMIN_PASSWORD))) {
        await new Promise((r) => setTimeout(r, 1000)); /* slows down password guessing */
        return json(401, { message: 'wrong password' });
      }

      const path = url.pathname.slice(API_PREFIX.length);
      if (!ALLOWED_PATH.test(path) || !ALLOWED_METHODS.includes(request.method)) {
        return json(403, { message: 'not allowed' });
      }

      const headers = {
        'authorization': 'Bearer ' + env.GITHUB_TOKEN,
        'accept': 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'vga-auto-admin-proxy',
      };
      const init = { method: request.method, headers };
      if (request.method !== 'GET') {
        init.body = await request.text();
        headers['content-type'] = 'application/json';
      }
      const upstream = await fetch('https://api.github.com' + path + url.search, init);
      /* a 401 here means GitHub rejected the stored token (expired or revoked), not the admin password */
      if (upstream.status === 401) return json(502, { message: 'repository token rejected by GitHub - renew GITHUB_TOKEN' });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      });
    }

    if (url.pathname.startsWith('/api/')) return json(404, { message: 'not found' });
    return env.ASSETS.fetch(request);
  },
};
