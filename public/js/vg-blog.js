/* VG Auto Export — blog listing, rendered from public/data/blog.json */
(function () {
  'use strict';
  var box = document.querySelector('[data-blog-list]');
  if (!box) return;
  var T = window.VG_BLOG_T || {};
  var lang = T.lang || 'ka';
  var SITE = 'https://st0ckitch.github.io/vga-auto/';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function imgUrl(p) { return /^https?:/.test(p) ? p : SITE + p; }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : (iso || '');
  }

  fetch(SITE + 'public/data/blog.json?t=' + Date.now())
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (data) {
      var posts = (data.posts || []).filter(function (p) {
        return p.published !== false && p[lang] && p[lang].title;
      }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      if (!posts.length) {
        box.innerHTML = '<p class="cars-empty">' + esc(T.empty || 'No articles') + '</p>';
        return;
      }
      box.innerHTML = posts.map(function (p) {
        var L = p[lang];
        var url = (T.blogBase || SITE + 'blog/') + p.slug + '/';
        return '<article class="card card--hover">' +
          '<a href="' + esc(url) + '">' +
          '<div class="card__media"><img src="' + esc(imgUrl(p.cover || '')) + '" alt="' + esc(L.title) + '" loading="lazy"></div>' +
          '<div class="card__body">' +
          '<time class="muted" datetime="' + esc(p.date || '') + '" style="font-size:0.82rem;">' + esc(fmtDate(p.date)) + '</time>' +
          '<h2 class="card__title" style="font-size:1.05rem; margin-top:6px;">' + esc(L.title) + '</h2>' +
          '<p style="font-size:0.9rem; margin:0;">' + esc(L.excerpt || '') + '</p>' +
          '</div></a></article>';
      }).join('');
    })
    .catch(function () { /* baked fallback removed; leave empty grid hidden */
      box.innerHTML = '<p class="cars-empty">' + esc(T.empty || '') + '</p>';
    });
})();
