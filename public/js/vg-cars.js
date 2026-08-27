/* VG Auto Export — car catalog (listing + detail), data from public/data/cars.json */
(function () {
  'use strict';

  var grid = document.querySelector('[data-cars-grid]');
  var detail = document.querySelector('[data-car-detail]');
  if (!grid && !detail) return;

  var T = window.VG_CARS_T || {};
  var SITE = 'https://st0ckitch.github.io/vga-auto/';
  var CARS_URL = SITE + 'public/data/cars.json';
  var SITE_URL = SITE + 'public/data/site.json';

  function lbl(group, key) {
    var g = T[group] || {};
    return g[key] || key || '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-US').replace(/,/g, ' ');
  }
  function imgUrl(p) {
    if (!p) return '';
    return /^https?:/.test(p) ? p : SITE + p;
  }
  function carName(c) { return (c.make || '') + ' ' + (c.model || ''); }
  function carUrl(c) { return (T.carPage || (SITE + 'car/')) + '?id=' + c.id; }

  function specLine(c) {
    var parts = [];
    if (c.mileage) parts.push(num(c.mileage) + ' km');
    if (c.transmission) parts.push(lbl('transmission', c.transmission));
    if (c.fuel) parts.push(lbl('fuel', c.fuel));
    return parts.join(' · ');
  }

  function priceHtml(c) {
    var gel = c.priceGel ? num(c.priceGel) + ' ₾' : '';
    var usd = c.priceUsd ? '$' + num(c.priceUsd) : '';
    if (!gel && !usd) return '<b>' + esc(T.priceAsk || 'ფასი შეთანხმებით') + '</b>';
    return '<b>' + gel + '</b>' + (usd ? '<span>/ ' + usd + '</span>' : '');
  }

  function fetchJson(url) {
    return fetch(url + '?t=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  /* ---------------- listing ---------------- */
  if (grid) {
    var controls = document.querySelector('[data-cars-filters]');
    var countEl = document.querySelector('[data-cars-count]');
    var all = [];

    var sel = function (id) { return controls ? controls.querySelector('#' + id) : null; };

    function fillSelect(el, values, labelFn, keepAll) {
      if (!el) return;
      var cur = el.value;
      el.innerHTML = '<option value="">' + esc(T.all || 'ყველა') + '</option>' +
        values.map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(labelFn ? labelFn(v) : v) + '</option>';
        }).join('');
      if (keepAll && cur) el.value = cur;
    }

    function currentFilters() {
      return {
        make: sel('f-make') ? sel('f-make').value : '',
        model: sel('f-model') ? sel('f-model').value : '',
        yearFrom: sel('f-year-from') ? +sel('f-year-from').value || 0 : 0,
        yearTo: sel('f-year-to') ? +sel('f-year-to').value || 0 : 0,
        priceTo: sel('f-price-to') ? +sel('f-price-to').value || 0 : 0,
        cat: sel('f-cat') ? sel('f-cat').value : '',
        sort: sel('f-sort') ? sel('f-sort').value : ''
      };
    }

    function apply() {
      var f = currentFilters();
      var list = all.filter(function (c) {
        if (f.make && c.make !== f.make) return false;
        if (f.model && c.model !== f.model) return false;
        if (f.yearFrom && (+c.year || 0) < f.yearFrom) return false;
        if (f.yearTo && (+c.year || 0) > f.yearTo) return false;
        if (f.priceTo && (+c.priceGel || 0) > f.priceTo) return false;
        if (f.cat && c.category !== f.cat) return false;
        return true;
      });
      if (f.sort === 'price-asc') list.sort(function (a, b) { return (a.priceGel || 0) - (b.priceGel || 0); });
      else if (f.sort === 'price-desc') list.sort(function (a, b) { return (b.priceGel || 0) - (a.priceGel || 0); });
      else if (f.sort === 'year') list.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
      else list.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
      list.sort(function (a, b) { return (a.sold ? 1 : 0) - (b.sold ? 1 : 0); });
      render(list);
    }

    function render(list) {
      if (countEl) countEl.textContent = list.length;
      if (!list.length) {
        grid.innerHTML = '<p class="cars-empty">' + esc(T.empty || 'ავტომობილები ვერ მოიძებნა') + '</p>';
        return;
      }
      grid.innerHTML = list.map(function (c) {
        var img = c.images && c.images[0] ? imgUrl(c.images[0]) : '';
        return '<a class="car-card" href="' + carUrl(c) + '">' +
          '<div class="car-card__media">' +
            (img ? '<img src="' + esc(img) + '" alt="' + esc(carName(c)) + '" loading="lazy">' : '') +
            '<span class="car-card__badge">' + esc(c.year || '') + '</span>' +
            (c.sold ? '<span class="car-card__sold">' + esc(T.sold || 'გაყიდულია') + '</span>' : '') +
          '</div>' +
          '<div class="car-card__body">' +
            '<h3>' + esc(carName(c)) + '</h3>' +
            '<p class="car-card__specs">' + esc(specLine(c)) + '</p>' +
            '<div class="car-card__price">' + priceHtml(c) + '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }

    fetchJson(CARS_URL).then(function (data) {
      all = (data.cars || []).slice();

      var makes = all.map(function (c) { return c.make; }).filter(Boolean)
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      fillSelect(sel('f-make'), makes);

      function refreshModels() {
        var mk = sel('f-make') ? sel('f-make').value : '';
        var models = all.filter(function (c) { return !mk || c.make === mk; })
          .map(function (c) { return c.model; }).filter(Boolean)
          .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
        fillSelect(sel('f-model'), models);
      }
      refreshModels();

      var years = all.map(function (c) { return +c.year || 0; }).filter(Boolean);
      var yMin = years.length ? Math.min.apply(null, years) : 2005;
      var yMax = years.length ? Math.max.apply(null, years) : new Date().getFullYear();
      var yRange = [];
      for (var y = yMax; y >= yMin; y--) yRange.push(y);
      fillSelect(sel('f-year-from'), yRange);
      fillSelect(sel('f-year-to'), yRange);

      fillSelect(sel('f-price-to'), [5000, 10000, 15000, 20000, 30000, 40000, 60000, 100000], function (v) { return num(v) + ' ₾'; });

      var cats = all.map(function (c) { return c.category; }).filter(Boolean)
        .filter(function (v, i, a) { return a.indexOf(v) === i; });
      fillSelect(sel('f-cat'), cats, function (v) { return lbl('category', v); });

      /* initial filters from URL (?cat=&make=&sort=) */
      try {
        var q = new URLSearchParams(location.search);
        if (q.get('cat') && sel('f-cat')) sel('f-cat').value = q.get('cat');
        if (q.get('make') && sel('f-make')) { sel('f-make').value = q.get('make'); refreshModels(); }
        if (q.get('sort') && sel('f-sort')) sel('f-sort').value = q.get('sort');
      } catch (e) {}

      if (controls) {
        controls.addEventListener('change', function (e) {
          if (e.target.id === 'f-make') refreshModels();
          apply();
        });
        var reset = controls.querySelector('[data-cars-reset]');
        if (reset) reset.addEventListener('click', function () {
          controls.querySelectorAll('select').forEach(function (s) { s.value = ''; });
          refreshModels();
          apply();
        });
      }
      apply();
    }).catch(function () {
      grid.innerHTML = '<p class="cars-empty">' + esc(T.loadFail || 'კატალოგი დროებით მიუწვდომელია') + '</p>';
    });
  }

  /* ---------------- detail ---------------- */
  if (detail) {
    var id = 0;
    try { id = +new URLSearchParams(location.search).get('id') || 0; } catch (e) {}

    var notFound = detail.querySelector('[data-car-missing]');
    var view = detail.querySelector('[data-car-view]');

    fetchJson(CARS_URL).then(function (data) {
      var c = (data.cars || []).filter(function (x) { return x.id === id; })[0];
      if (!c) { if (notFound) notFound.hidden = false; return; }
      if (view) view.hidden = false;
      if (notFound) notFound.hidden = true;

      document.title = carName(c) + ' ' + (c.year || '') + ' — VG Auto Export';
      var h1 = view.querySelector('[data-cd-title]');
      if (h1) h1.textContent = carName(c) + (c.year ? ' · ' + c.year : '');

      /* gallery */
      var main = view.querySelector('[data-cd-photo]');
      var thumbs = view.querySelector('[data-cd-thumbs]');
      var imgs = (c.images || []).map(imgUrl).filter(Boolean);
      if (main && imgs.length) {
        main.src = imgs[0];
        main.alt = carName(c);
      }
      if (thumbs && imgs.length > 1) {
        thumbs.innerHTML = imgs.map(function (u, i) {
          return '<button type="button" class="cd-thumb' + (i === 0 ? ' is-on' : '') + '" data-src="' + esc(u) + '">' +
            '<img src="' + esc(u) + '" alt="" loading="lazy"></button>';
        }).join('');
        thumbs.addEventListener('click', function (e) {
          var b = e.target.closest('.cd-thumb');
          if (!b || !main) return;
          main.src = b.dataset.src;
          thumbs.querySelectorAll('.cd-thumb').forEach(function (t) { t.classList.toggle('is-on', t === b); });
        });
      }

      /* specs */
      var specs = view.querySelector('[data-cd-specs]');
      if (specs) {
        var rows = [
          ['make', c.make], ['model', c.model], ['year', c.year],
          ['engine', c.engine], ['transmission', c.transmission && lbl('transmission', c.transmission)],
          ['fuel', c.fuel && lbl('fuel', c.fuel)], ['steering', c.steering && lbl('steering', c.steering)],
          ['location', c.location && lbl('location', c.location)],
          ['customs', c.customs && lbl('customs', c.customs)],
          ['category', c.category && lbl('category', c.category)],
          ['mileage', c.mileage && num(c.mileage) + ' km'], ['vin', c.vin]
        ].filter(function (r) { return r[1]; });
        specs.innerHTML = rows.map(function (r) {
          return '<div class="cd-spec"><dt>' + esc(lbl('fields', r[0])) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
        }).join('');
      }

      /* price + sold state */
      var price = view.querySelector('[data-cd-price]');
      if (price) price.innerHTML = priceHtml(c) + (c.sold ? ' <em class="cd-sold">' + esc(T.sold || 'გაყიდულია') + '</em>' : '');

      if (c.note) {
        var note = view.querySelector('[data-cd-note]');
        if (note) { note.hidden = false; note.textContent = c.note; }
      }

      /* phone from site.json */
      fetchJson(SITE_URL).then(function (s) {
        var tel = view.querySelector('[data-cd-tel]');
        if (tel && s.contacts && s.contacts.phoneIntl) {
          tel.href = 'tel:' + s.contacts.phoneIntl;
          tel.querySelector('span').textContent = s.contacts.phone || s.contacts.phoneIntl;
          tel.hidden = false;
        }
      }).catch(function () {});
    }).catch(function () {
      if (notFound) notFound.hidden = false;
    });
  }
})();
