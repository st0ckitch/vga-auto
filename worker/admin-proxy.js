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
 * Old-site addresses (vgae.com.ge/vg/Controller/action, index.php?…) are redirected
 * permanently to the matching new page, or to the home page. Everything else is
 * served from the static site.
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

function jsonCacheable(status, body, seconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + seconds },
  });
}

/* ----- VIN JSON (docs/vin-api/README.md): keep only what the page understands ----- */
const VIN_CAR_FIELDS = ['make', 'model', 'year', 'lot', 'auction', 'status', 'stage', 'location', 'container', 'eta', 'updated_at'];
function cleanText(v, max) {
  if (v === null || v === undefined || typeof v === 'object') return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanPhotoUrl(v) {
  const s = cleanText(v, 2000);
  if (!/^https?:\/\//i.test(s)) return '';
  try { const u = new URL(s); u.protocol = 'https:'; return u.href; } /* the site is https: http photos would be blocked */
  catch (e) { return ''; }
}
/* a photo is {url, thumb} or a plain URL string; thumb (grid) falls back to url (lightbox) */
function cleanPhoto(v) {
  const o = v && typeof v === 'object' ? v : { url: v };
  const url = cleanPhotoUrl(o.url);
  if (!url) return null;
  return { url, thumb: cleanPhotoUrl(o.thumb) || url };
}
/* free-form rows [{label, value}] added by the dealer system (label may be "ka|en|ru") */
function cleanInfo(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list.slice(0, 30) : []) {
    if (!r || typeof r !== 'object') continue;
    const label = cleanText(r.label, 120);
    const value = cleanText(r.value, 300);
    if (label && value) out.push({ label, value });
  }
  return out;
}
function cleanVinResult(data, vin) {
  const car = {};
  const src = data.car && typeof data.car === 'object' ? data.car : {};
  for (const k of VIN_CAR_FIELDS) {
    const v = cleanText(src[k], 200);
    if (!v) continue;
    if (k === 'year' || k === 'stage') { const n = parseInt(v, 10); if (n > 0) car[k] = n; }
    else car[k] = v;
  }
  const stages = [];
  for (const s of Array.isArray(data.stages) ? data.stages.slice(0, 8) : []) {
    if (!s || typeof s !== 'object') continue;
    const photos = (Array.isArray(s.photos) ? s.photos : []).map(cleanPhoto).filter(Boolean).slice(0, 80);
    const id = parseInt(s.id, 10);
    stages.push({ id: id > 0 ? id : stages.length + 1, name: cleanText(s.name, 80), date: cleanText(s.date, 40) || null, info: cleanInfo(s.info), photos });
  }
  return { ok: true, vin: cleanText(data.vin, 17).toUpperCase() || vin, car, info: cleanInfo(data.info), stages };
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

/* ---- redirects for the old PHP site's addresses (incl. the old /dlr/ cabinet path) ---- */
const NEW_PAGES = ['about', 'blog', 'calculator', 'cars', 'contact', 'export', 'faq', 'import', 'partners', 'parts', 'search', 'service', 'transport', 'video'];
const SYNONYMS = { car: 'cars', auto: 'cars', autos: 'cars', catalog: 'cars', news: 'blog', article: 'blog', articles: 'blog', post: 'blog',
  contacts: 'contact', services: 'service', calc: 'calculator', calculation: 'calculator', partner: 'partners', videos: 'video',
  documents: 'export', documentation: 'export', faqs: 'faq', shipping: 'transport', delivery: 'transport', tracking: 'search' };

function legacyRedirect(url) {
  let path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
  let lang = '';
  const prefixed = /^\/(en|ru)(?=\/|$)/i.exec(path);
  if (prefixed) { lang = prefixed[1].toLowerCase(); path = path.slice(prefixed[0].length); }
  const q = (url.searchParams.get('lang') || '').toLowerCase();
  if (q === 'en' || q === 'ru') lang = q;
  /* the dealer cabinet moved to its own subdomain: keep any deeper path and query */
  const dlr = /^\/dlr(\/.*)?$/i.exec(path);
  if (dlr) return Response.redirect('https://account.vgae.com.ge/dlr' + (dlr[1] || '/') + url.search, 301);
  const isLegacy = /^\/vg(?=\/|$)/i.test(path) || /^\/index\.php$/i.test(path);
  if (!isLegacy) return null;
  let target = '/';
  const segs = path.split('/').filter(Boolean).slice(1).map((x) => x.toLowerCase().replace(/\.(php|html?)$/, ''));
  for (const seg of segs.reverse()) {
    const name = SYNONYMS[seg] || seg;
    if (NEW_PAGES.includes(name)) { target = '/' + name + '/'; break; }
  }
  return Response.redirect(url.origin + (lang ? '/' + lang : '') + target, 301);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const legacy = legacyRedirect(url);
    if (legacy) return legacy;
    const configured = Boolean(env.ADMIN_PASSWORD && env.GITHUB_TOKEN);

    /* VIN lookup for the search page. Sources, in this order:
       1. VIN_API_URL (+ secret VIN_API_KEY): the JSON service docs/vin-api/vin-api.php installed on the
          dealer system, e.g. https://account.vgae.com.ge/dlr/vin-api.php. Its answer is cleaned and
          handed to the page as JSON; the page renders the car and its photo stages itself.
       2. VIN_SOURCE_URL: an HTML fragment address with {vin}, e.g.
          https://account.vgae.com.ge/dlr/index.php?class=Action&method=az_car&vin={vin}
       Neither set: 404, and the page falls back to framing the dealer system's own VIN page. */
    if (url.pathname === '/api/vin') {
      if (request.method !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });
      const vin = (url.searchParams.get('vin') || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{5,17}$/.test(vin)) return json(400, { ok: false, error: 'bad_vin' });
      const api = env.VIN_API_URL || '';
      const tpl = env.VIN_SOURCE_URL || '';
      if (!api && tpl.indexOf('{vin}') < 0) return json(404, { ok: false, error: 'not_configured' });
      const cacheKey = new Request(url.origin + '/api/vin?vin=' + vin);
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
      const cached = async (res) => { await caches.default.put(cacheKey, res.clone()); return res; };

      if (api) {
        const src = api.indexOf('{vin}') > -1
          ? api.replace('{vin}', encodeURIComponent(vin))
          : api + (api.indexOf('?') > -1 ? '&' : '?') + 'vin=' + encodeURIComponent(vin);
        let up;
        let data = null;
        try { up = await fetch(src, { headers: { 'x-api-key': env.VIN_API_KEY || '', 'accept': 'application/json', 'user-agent': 'vga-auto-site' }, redirect: 'follow' }); }
        catch (e) { return json(502, { ok: false, error: 'upstream_unreachable' }); }
        try { data = await up.json(); } catch (e) { data = null; }
        if (up.status === 404 && data && data.error === 'not_found') {
          return cached(jsonCacheable(404, { ok: false, error: 'not_found', vin }, 60));
        }
        if (!up.ok || !data || data.ok !== true) return json(502, { ok: false, error: 'upstream_error', status: up.status });
        return cached(jsonCacheable(200, cleanVinResult(data, vin), 120));
      }

      const src = tpl.replace('{vin}', encodeURIComponent(vin));
      let up;
      try { up = await fetch(src, { headers: { 'user-agent': 'vga-auto-site', 'accept': 'text/html,*/*' }, redirect: 'follow' }); }
      catch (e) { return json(502, { ok: false, message: 'upstream unreachable' }); }
      if (!up.ok) return json(502, { ok: false, status: up.status });
      const origin = new URL(src).origin;
      let html = await up.text();
      html = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')                 /* never run their scripts in our page */
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
        .replace(/(src|href)=("|')\/(?!\/)/gi, '$1=$2' + origin + '/') /* their relative links and photos */
        .trim();
      if (!html) return json(502, { ok: false, message: 'empty' });
      return cached(new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } }));
    }

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
