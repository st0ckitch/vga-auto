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
  var headerActions = document.querySelector('.header-actions') || document.querySelector('.site-header__in');
  if (headerActions) {
    var toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', (window.VG_T||{}).themeToggle||'Toggle theme');
    toggle.innerHTML =
      '<svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
      '<svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    headerActions.insertBefore(toggle, headerActions.querySelector('.burger'));
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

  /* Localised UI strings; each page defines window.VG_T for its language. */
  var T = window.VG_T || {};
  var tr = function (key, fallback) { return T[key] || fallback; };

  /* ---------- Navigation drawer (all breakpoints) ---------- */
  var burger = document.querySelector('.burger');
  var navEl = document.querySelector('.nav');
  if (burger && navEl) {
    /* The header carries backdrop-filter, which makes it the containing block
       for fixed children — the drawer must live at the body root to size
       against the viewport. */
    document.body.appendChild(navEl);

    var scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(scrim, navEl);

    var setNav = function (open) {
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? tr('navClose', 'Close menu') : tr('navOpen', 'Open menu'));
      navEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    };
    setNav(false);

    burger.addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    scrim.addEventListener('click', function () { setNav(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
    });
    /* a link inside the drawer navigates away — close it behind them */
    navEl.addEventListener('click', function (e) {
      if (e.target.closest('a, [data-open]')) setNav(false);
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

  /* ---------- World clocks (.clock[data-clock="<IANA zone>"]) ---------- */
  var clocks = document.querySelectorAll('.clock[data-clock]');
  if (clocks.length) {
    var timeFmt = {};
    var zoneFmt = {};
    var fmtFor = function (zone, store, opts) {
      if (!(zone in store)) {
        try { store[zone] = new Intl.DateTimeFormat(store === zoneFmt ? 'en-US' : 'en-GB', opts(zone)); } catch (e) { store[zone] = null; }
      }
      return store[zone];
    };
    var tickClocks = function () {
      var now = new Date();
      clocks.forEach(function (el) {
        var zone = el.getAttribute('data-clock');
        var out = el.querySelector('.clock__time');
        if (!out) return;
        var tf = fmtFor(zone, timeFmt, function (z) {
          return { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        });
        if (!tf) { out.textContent = '—'; return; }
        var abbr = el.getAttribute('data-clock-abbr');
        if (abbr === null) {
          var zf = fmtFor(zone, zoneFmt, function (z) {
            return { timeZone: z, timeZoneName: 'short', hour: '2-digit' };
          });
          abbr = '';
          if (zf && zf.formatToParts) {
            zf.formatToParts(now).forEach(function (p) { if (p.type === 'timeZoneName') abbr = p.value; });
          }
          el.setAttribute('data-clock-abbr', abbr);
        }
        out.innerHTML = tf.format(now) + (abbr ? ' <small>' + abbr + '</small>' : '');
      });
    };
    tickClocks();
    setInterval(tickClocks, 1000);
    /* DST shifts the abbreviation — re-derive it hourly rather than every tick */
    setInterval(function () {
      clocks.forEach(function (el) { el.removeAttribute('data-clock-abbr'); });
    }, 3600000);
  }

  /* ---------- Full-bleed video band: play while on screen ---------- */
  document.querySelectorAll('[data-video-band]').forEach(function (band) {
    var video = band.querySelector('video');
    if (!video) return;
    var soundBtn = band.querySelector('[data-video-sound]');
    var playBtn = band.querySelector('[data-video-play]');
    var wantsPlay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var syncPlayBtn = function () { if (playBtn) playBtn.classList.toggle('is-active', !video.paused); };
    var tryPlay = function () {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused — the controls stay */ });
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && wantsPlay) tryPlay();
          else video.pause();
          syncPlayBtn();
        });
      }, { threshold: 0.35 }).observe(band);
    } else if (wantsPlay) {
      tryPlay();
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        video.muted = !video.muted;
        soundBtn.classList.toggle('is-active', !video.muted);
        soundBtn.setAttribute('aria-label', video.muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა');
        if (!video.muted) { wantsPlay = true; tryPlay(); }
      });
    }
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (video.paused) { wantsPlay = true; tryPlay(); } else { wantsPlay = false; video.pause(); }
        syncPlayBtn();
      });
    }
    video.addEventListener('play', syncPlayBtn);
    video.addEventListener('pause', syncPlayBtn);
  });

  /* ---------- Call-back request (any form[data-callback-form]) ---------- */
  document.querySelectorAll('form[data-callback-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-msg');
      var nameEl = form.querySelector('[name="name"]');
      var phoneEl = form.querySelector('[name="phone"]');
      var noteEl = form.querySelector('[name="note"]');
      var name = (nameEl.value || '').trim();
      var phone = (phoneEl.value || '').trim();
      if (!name) { nameEl.focus(); return; }
      if (phone.replace(/[^0-9]/g, '').length < 9) {
        if (msg) { msg.className = 'form-msg form-msg--err'; msg.textContent = tr('cbBadPhone', 'Please enter a valid phone number.'); }
        phoneEl.focus();
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      var fallback = function () {
        if (!msg) return;
        msg.className = 'form-msg form-msg--err';
        msg.innerHTML = tr('cbFail', 'Requests are temporarily unavailable — please call: ') +
          '<a href="tel:+995322500504">0322 50 05 04</a>';
      };
      fetch((window.siteUrl || '/') + 'index.php?class=Action&method=callback_request' +
        '&name=' + encodeURIComponent(name) +
        '&phone=' + encodeURIComponent(phone) +
        '&note=' + encodeURIComponent(noteEl ? noteEl.value || '' : ''))
        .then(function (r) { return r.text(); })
        .then(function (t) {
          var ok = false;
          try { ok = JSON.parse(t).error === 0; } catch (err) { ok = false; }
          if (ok) {
            if (msg) { msg.className = 'form-msg form-msg--ok'; msg.textContent = tr('cbOk', 'Thank you! Our manager will call you back shortly.'); }
            form.reset();
          } else {
            fallback();
          }
        })
        .catch(fallback)
        .then(function () { if (btn) btn.disabled = false; });
    });
  });

  /* ---------- Transport price by auction lot number ----------
     Backend contract (docs/lot-price-api.md):
       GET index.php?class=Action&method=lot_price&auction=&lot=&port=&type=
       -> {"error":0,"lot":"","location":"","city":"","state":"",
           "us_transport":0,"ocean":0,"total":0,"currency":"USD"}
     Any other shape counts as "unavailable": the user is sent to the manual
     calculator rather than shown an invented number. */
  document.querySelectorAll('form[data-lot-form]').forEach(function (form) {
    var box = document.querySelector(form.getAttribute('data-lot-result') || '#lot-result');
    var esc = function (s) { return String(s == null ? '' : s).replace(/[<>&"]/g, ''); };
    var money = function (v, cur) {
      var n = parseFloat(v);
      if (!isFinite(n) || n <= 0) return null;
      return (cur === 'GEL' ? '₾' : '$') + Math.round(n).toLocaleString('en-US');
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lotEl = form.querySelector('[name="lot"]');
      var lot = (lotEl.value || '').trim();
      if (!lot) { lotEl.focus(); return; }
      var pick = function (n, d) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value : d; };
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (box) {
        box.classList.add('is-visible');
        box.innerHTML = '<p class="form-note u-mb-0">' + tr('lotSearching', 'Looking up the lot…') + '</p>';
      }
      var unavailable = function () {
        if (!box) return;
        box.classList.add('is-visible');
        box.innerHTML =
          '<p class="form-note u-mb-16">' +
          tr('lotUnavailable', 'Automatic lot lookup is not available yet — please use the calculator or contact us.') +
          '</p>' +
          '<div class="u-flex u-flex-wrap">' +
          '<button class="btn btn--primary btn--sm" type="button" data-open="#dlg-calc">' + tr('lotCalc', 'Calculator') + '</button>' +
          '<a class="btn btn--ghost btn--sm" href="tel:+995322500504">0322 50 05 04</a>' +
          '</div>';
      };
      fetch((window.siteUrl || '/') + 'index.php?class=Action&method=lot_price' +
        '&auction=' + encodeURIComponent(pick('auction', 'Copart')) +
        '&lot=' + encodeURIComponent(lot) +
        '&port=' + encodeURIComponent(pick('port', 'poti')) +
        '&type=' + encodeURIComponent(pick('vehicle', '1')))
        .then(function (r) { return r.text(); })
        .then(function (t) {
          var d = null;
          try { d = JSON.parse(t); } catch (err) { d = null; }
          if (!d || d.error !== 0 || !box) { unavailable(); return; }
          var cur = d.currency || 'USD';
          var rows = '';
          if (money(d.us_transport, cur)) rows += '<div class="lot-result__row"><span>' + tr('lotLand', 'Road transport in the USA') + '</span><b>' + money(d.us_transport, cur) + '</b></div>';
          if (money(d.ocean, cur)) rows += '<div class="lot-result__row"><span>' + tr('lotOcean', 'Ocean freight') + '</span><b>' + money(d.ocean, cur) + '</b></div>';
          box.innerHTML =
            '<div class="card"><div class="card__body">' +
            '<div class="lot-result__head">' +
            '<span class="lot-result__lot">' + tr('lotLot', 'Lot ') + esc(d.lot || lot) + '</span>' +
            '<span class="lot-result__place">' + esc([d.location, d.city, d.state].filter(Boolean).join(', ')) + '</span>' +
            '</div>' +
            '<div class="lot-result__rows">' + rows + '</div>' +
            '<div class="calc-total"><span>' + tr('lotTotal', 'Shipping total') + '</span><b>' + (money(d.total, cur) || '—') + '</b></div>' +
            '</div></div>';
        })
        .catch(unavailable)
        .then(function () { if (btn) btn.disabled = false; });
    });
  });

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

/* ---------- Journey: shipment-tracker timeline ---------- */
(function () {
  var sec = document.querySelector('[data-journey]');
  if (!sec) return;
  var wrap = sec.querySelector('.jtl');
  var fill = sec.querySelector('.jtl__fill');
  var items = Array.prototype.slice.call(sec.querySelectorAll('.jtl li'));
  if (!wrap || !fill || !items.length) return;

  var ticking = false;
  function upd() {
    ticking = false;
    var focus = window.innerHeight * 0.62;
    var wr = wrap.getBoundingClientRect();
    var h = Math.max(0, Math.min(focus - wr.top - 8, wr.height - 16));
    fill.style.height = h + 'px';
    items.forEach(function (li) {
      li.classList.toggle('is-on', li.getBoundingClientRect().top + 12 < focus);
    });
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);
  upd();
})();

/* ---------- Content hydration from the admin-managed site.json ---------- */
(function () {
  if (!window.fetch) return;
  var lang = (document.documentElement.getAttribute('lang') || 'ka').slice(0, 2);

  fetch('https://st0ckitch.github.io/vga-auto/public/data/site.json?t=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (site) {
      if (!site) return;
      var c = site.contacts || {};

      /* contacts, site-wide */
      if (c.phoneIntl) {
        document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
          if (a.hasAttribute('data-cd-tel')) return;
          a.href = 'tel:' + c.phoneIntl;
          if (/\d{4,}/.test(a.textContent.replace(/\s/g, ''))) a.textContent = c.phone || c.phoneIntl;
        });
      }
      if (c.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
          a.href = 'mailto:' + c.email;
          if (a.textContent.indexOf('@') > -1) a.textContent = c.email;
        });
      }
      if (c.dealerUrl) {
        document.querySelectorAll('a.header-dealer').forEach(function (a) { a.href = c.dealerUrl; });
      }

      var L = site[lang];
      if (!L || !document.body.classList.contains('page-home')) return;

      /* hero */
      var h1 = document.querySelector('.hero-v2__title');
      if (h1 && L.heroTitle) {
        h1.innerHTML = L.heroTitle.trim().split(/\s+/).map(function (w, i) {
          var acc = /^\*.*\*$/.test(w);
          if (acc) w = w.slice(1, -1);
          return '<span class="w' + (acc ? ' accent' : '') + '" style="--d:' + (i * 0.08).toFixed(2) + 's;">' +
            w.replace(/[&<>]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]; }) + '</span>';
        }).join(' ');
      }
      var sub = document.querySelector('.hero-v2__sub');
      if (sub && L.heroSub) sub.textContent = L.heroSub;

      /* stats */
      if (L.stats && L.stats.length) {
        var stats = document.querySelectorAll('.hero-v2__stats .stat');
        L.stats.forEach(function (s, i) {
          var el = stats[i];
          if (!el) return;
          var b = el.querySelector('b'), sp = el.querySelector('span');
          if (b && s.v != null) { b.textContent = s.v; b.removeAttribute('data-count'); }
          if (sp && s.label) sp.textContent = s.label;
        });
      }

      /* video band copy */
      var vc = document.querySelector('.video-band__copy');
      if (vc && L.video) {
        var ve = vc.querySelector('.eyebrow'), vt = vc.querySelector('h2'), vp = vc.querySelector('h2 + p');
        if (ve && L.video.eyebrow) ve.textContent = L.video.eyebrow;
        if (vt && L.video.title) vt.textContent = L.video.title;
        if (vp && L.video.text) vp.textContent = L.video.text;
      }

      /* services */
      if (L.services && L.services.length) {
        var feats = document.querySelectorAll('#services .grid .feature');
        L.services.forEach(function (s, i) {
          var f = feats[i];
          if (!f) return;
          var h = f.querySelector('h3'), p = f.querySelector('p');
          if (h && s.title) h.textContent = s.title;
          if (p && s.text) p.textContent = s.text;
        });
      }

      /* journey */
      if (L.journey && L.journey.length) {
        var lis = document.querySelectorAll('.jtl li');
        L.journey.forEach(function (j, i) {
          var li = lis[i];
          if (!li) return;
          var b = li.querySelector('b'), sp = li.querySelector('span');
          if (b && j.t) b.textContent = j.t;
          if (sp && j.s) sp.textContent = j.s;
        });
      }

      /* marquee */
      if (L.marquee && L.marquee.length) {
        var track = document.querySelector('.marquee__track');
        if (track) {
          var spans = L.marquee.concat(L.marquee).map(function (w) {
            return '<span>' + String(w).replace(/[&<>]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]; }) + '</span>';
          }).join('');
          track.innerHTML = spans;
        }
      }
    })
    .catch(function () {});
})();
