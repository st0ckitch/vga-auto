/* VG AUTO EXPORT — modern shared JS (vanilla, no dependencies) */
(function () {
  'use strict';

  /* ---------- Ambient aurora orbs (inject on pages missing the markup) ---------- */
  if (!document.querySelector('.bg-orbs')) {
    var orbs = document.createElement('div');
    orbs.className = 'bg-orbs';
    orbs.setAttribute('aria-hidden', 'true');
    orbs.innerHTML = '<i></i><i></i><i></i>';
    document.body.insertBefore(orbs, document.body.firstChild);
  }

  /* ---------- Theme toggle (dark default, light optional) ---------- */
  var THEME_KEY = 'vg-theme';
  var theme = 'dark';
  try { if (localStorage.getItem(THEME_KEY) === 'light') theme = 'light'; } catch (e) {}
  var applyTheme = function (t) {
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F7F4F0' : '#171314');
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
      btn.setAttribute('title', t === 'light' ? ((window.VG_T||{}).themeDark||'Dark theme') : ((window.VG_T||{}).themeLight||'Light theme'));
    }
  };
  var headerIn = document.querySelector('.site-header__in');
  if (headerIn) {
    var toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', (window.VG_T||{}).themeToggle||'Toggle theme');
    toggle.innerHTML =
      '<svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
      '<svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    headerIn.insertBefore(toggle, headerIn.querySelector('.header-cta'));
    toggle.addEventListener('click', function () {
      theme = theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
      applyTheme(theme);
    });
  }
  applyTheme(theme);

  /* ---------- Sticky header shadow ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile burger ---------- */
  var burger = document.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Nav dropdowns ---------- */
  document.querySelectorAll('.nav__item').forEach(function (item) {
    var toggle = item.querySelector('.nav__toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = item.classList.contains('is-open');
      document.querySelectorAll('.nav__item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
      item.classList.toggle('is-open', !wasOpen);
      toggle.setAttribute('aria-expanded', !wasOpen ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function () {
    document.querySelectorAll('.nav__item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
  });

  /* ---------- Dialog openers: data-open="#dialog-id" ---------- */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open]');
    if (opener) {
      var dlg = document.querySelector(opener.getAttribute('data-open'));
      if (dlg && typeof dlg.showModal === 'function') {
        e.preventDefault();
        document.body.classList.remove('nav-open');
        dlg.showModal();
      }
      return;
    }
    var closer = e.target.closest('[data-close]');
    if (closer) {
      var d = closer.closest('dialog');
      if (d) d.close();
    }
  });
  /* Click on backdrop closes */
  document.querySelectorAll('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });
  });

  /* ---------- Lightbox: any <a data-lightbox href="img"> ---------- */
  var lightbox = document.getElementById('vg-lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    var lbCap = lightbox.querySelector('figcaption');
    var group = [];
    var idx = 0;
    var show = function (i) {
      if (!group.length) return;
      idx = (i + group.length) % group.length;
      var a = group[idx];
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.getAttribute('data-title') || '';
      if (lbCap) lbCap.textContent = a.getAttribute('data-title') || '';
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      var name = a.getAttribute('data-lightbox') || 'default';
      group = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox="' + name + '"]'));
      show(group.indexOf(a));
      lightbox.showModal();
    });
    lightbox.querySelector('.lightbox__nav--prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    lightbox.querySelector('.lightbox__nav--next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- VIN tracking search (any form with data-vin-form) ---------- */
  document.querySelectorAll('form[data-vin-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input:not([type="hidden"])');
      var vin = (input.value || '').trim();
      if (!vin) { input.focus(); return; }
      var base = form.getAttribute('action') || ((window.siteUrl || '/') + 'index.php');
      var sep = base.indexOf('?') >= 0 ? '&' : '?';
      window.location.href = base + sep + 'class=Search&vin=' + encodeURIComponent(vin) + (window.langQ||'');
    });
  });

  /* ---------- Container tracking: open the carrier's own tracker ---------- */
  var CARRIERS = {
    maersk: 'https://www.maersk.com/tracking/{n}',
    msc: 'https://www.msc.com/en/track-a-shipment?agencyPath=mwi&trackingNumber={n}',
    cosco: 'https://elines.coscoshipping.com/ebusiness/cargotracking?number={n}',
    zim: 'https://www.zim.com/tools/track-a-shipment?consnumber={n}',
    hapag: 'https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html?container={n}'
  };
  document.querySelectorAll('form[data-track-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = (form.querySelector('input[name="container"]').value || '').trim();
      var carrier = form.querySelector('select[name="carrier"]').value;
      if (!n || !CARRIERS[carrier]) return;
      window.open(CARRIERS[carrier].replace('{n}', encodeURIComponent(n)), '_blank', 'noopener');
    });
  });

  /* ---------- Newsletter (footer) ---------- */
  var newsForm = document.querySelector('form[data-news-form]');
  if (newsForm) {
    newsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = newsForm.querySelector('input');
      var msg = newsForm.parentElement.querySelector('.form-msg');
      var email = (input.value || '').trim();
      if (!email || email.indexOf('@') < 1) { input.focus(); return; }
      fetch((window.siteUrl || '/') + 'index.php?class=Action&method=submit_email&email=' + encodeURIComponent(email))
        .then(function (r) { return r.text(); })
        .then(function (t) {
          var ok = false;
          try { ok = JSON.parse(t).error === 0; } catch (err) { ok = false; }
          if (msg) {
            msg.className = ok ? 'form-msg form-msg--ok' : 'form-msg form-msg--err';
            msg.textContent = ok ? ((window.VG_T||{}).newsOk||'Subscribed!') : ((window.VG_T||{}).newsErr||'Subscription failed.');
          }
          if (ok) input.value = '';
        })
        .catch(function () {
          if (msg) { msg.className = 'form-msg form-msg--err'; msg.textContent = (window.VG_T||{}).newsErr||'Subscription failed.'; }
        });
    });
  }

  /* ---------- Animated counters: .stat b[data-count] ---------- */
  var animateCount = function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var t0 = null;
    var dur = 1200;
    var tick = function (t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      el.childNodes[0].nodeValue = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------- Reveal on scroll + counters ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll('[data-count]').forEach(animateCount);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Active nav link ---------- */
  var NAV_ALIAS = { PartList: 'Parts', Car: 'Cars', Post: 'Blog' };
  var cls = (window.class_name || 'Home');
  cls = NAV_ALIAS[cls] || cls;
  document.querySelectorAll('.nav__link[data-class]').forEach(function (a) {
    if (a.getAttribute('data-class') === cls) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---------- Scroll progress bar ---------- */
  var progress = document.querySelector('.scroll-progress');
  if (progress) {
    var updateProgress = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ---------- Spotlight + 3D tilt on glass cards ---------- */
  var fine = window.matchMedia('(pointer: fine)').matches;
  var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine) {
    document.querySelectorAll('.feature, .card--hover').forEach(function (el) {
      el.classList.add('spotlight');
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left;
        var y = e.clientY - r.top;
        el.style.setProperty('--mx', x + 'px');
        el.style.setProperty('--my', y + 'px');
        if (!noMotion) {
          var rx = ((y / r.height) - 0.5) * -5; /* max ~2.5deg */
          var ry = ((x / r.width) - 0.5) * 5;
          el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
        }
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  /* ---------- Hero parallax (subtle) ---------- */
  var stack = document.querySelector('.hero-stack');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (stack && !reduced) {
    window.addEventListener('scroll', function () {
      var y = Math.min(window.scrollY, 600);
      stack.style.transform = 'translateY(' + y * 0.06 + 'px)';
      var wm = stack.querySelector('.hero-stack__watermark');
      if (wm) wm.style.transform = 'translateY(' + y * -0.12 + 'px)';
    }, { passive: true });
  }

  /* ---------- Transport-cost calculator ----------
     Wires any [data-calc] container: .js-calc-auction select drives the
     .js-calc-city list via the legacy Action endpoints; when the pricing
     data source is unavailable the result shows an honest note instead. */
  document.querySelectorAll('[data-calc]').forEach(function (box) {
    var auc = box.querySelector('.js-calc-auction');
    var city = box.querySelector('.js-calc-city');
    var out = box.querySelector('.js-calc-result');
    if (!auc || !city || !out) return;
    var unavailable = out.getAttribute('data-msg-unavailable') || 'N/A';
    var showNote = function () { out.textContent = unavailable; out.classList.add('is-note'); };
    var showSum = function (v) { out.textContent = v; out.classList.remove('is-note'); };
    auc.addEventListener('change', function () {
      fetch((window.siteUrl || '/') + 'index.php?class=Action&method=calc_city&auction=' + encodeURIComponent(auc.value))
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var t = (html || '').trim();
          if (t && t.indexOf('<option') === 0) {
            city.innerHTML = t;
            out.textContent = '—'; out.classList.remove('is-note');
          } else {
            showNote();
          }
        })
        .catch(showNote);
    });
    city.addEventListener('change', function () {
      var price = parseFloat(city.options[city.selectedIndex] && city.options[city.selectedIndex].value);
      if (isFinite(price) && price > 0) showSum('$' + Math.round(price)); else showNote();
    });
  });
})();
