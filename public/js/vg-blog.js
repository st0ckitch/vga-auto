/* VG Auto Export - blog listing, rendered from public/data/blog.json */
(function () {
  'use strict';
  var box = document.querySelector('[data-blog-list]');
  var slider = document.querySelector('[data-blog-slider]');
  if (!box && !slider) return;
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

  function fillSlider(data) {
    if (!slider) return;
    var track = slider.querySelector('.bslider__track');
    if (!track) return;
    var lg = slider.getAttribute('data-lang') || 'ka';
    var base = slider.getAttribute('data-base') || (SITE + 'blog/');
    var posts = (data.posts || []).filter(function (p) {
      return p.published !== false && p[lg] && p[lg].title;
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 5);
    if (!posts.length) return;
    var html = posts.map(function (p) {
      return '<a class="bcard" href="' + esc(base + p.slug + '/') + '">' +
        '<img src="' + esc(imgUrl(p.cover || '')) + '" alt="' + esc(p[lg].title) + '" loading="lazy" width="640" height="400">' +
        '<div class="bcard__body"><h3>' + esc(p[lg].title) + '</h3><span class="bcard__meta">' + esc(fmtDate(p.date)) + '</span></div></a>';
    }).join('');
    var live = Array.prototype.map.call(track.children, function (el) { return el.href; }).join('|');
    var want = posts.map(function (p) { return base + p.slug + '/'; }).join('|');
    if (live !== want) track.innerHTML = html;
  }

  fetch(SITE + 'public/data/blog.json?t=' + Date.now())
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (data) {
      fillSlider(data);
      if (!box) return;
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
    .catch(function () {
      /* keep the statically baked cards; only message if the grid is truly empty */
      if (box && !box.children.length) box.innerHTML = '<p class="cars-empty">' + esc(T.empty || '') + '</p>';
    });
})();
