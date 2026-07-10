/**
 * Fullscreen flash + random image from /images/
 * Preloads and decodes photos before display to avoid lag/jitter.
 */
(function () {
  if (window.__snapshotInitialized) return;
  window.__snapshotInitialized = true;

  function resolveImagesBase() {
    var script = document.currentScript;
    if (script && script.src) {
      try {
        return new URL('images/', script.src).href;
      } catch (e) {}
    }
    return 'images/';
  }

  var IMG = resolveImagesBase();
  var DEFAULT_NAMES = [
    '01.jpg',
    '02.jpg',
    '03.jpg',
    '04.jpg',
    '05.jpg',
    '06.jpg',
    '07.jpg',
    '08.jpg'
  ];

  var PHOTO_URLS = DEFAULT_NAMES.map(function (name) {
    return IMG + name;
  });
  var READY = [];
  var lastShown = -1;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isWritingLink(target) {
    if (!target) return false;
    var el = target.nodeType === 1 ? target : target.parentElement;
    if (!el || !el.closest) return false;
    var a = el.closest('a');
    if (!a) return false;
    if (a.classList.contains('no-snapshot')) return true;
    var href = (a.getAttribute('href') || '').split('#')[0].split('?')[0];
    return href === 'writing.html' || href.endsWith('/writing.html');
  }

  function normalizeManifestEntry(name) {
    if (!name || typeof name !== 'string') return null;
    name = name.replace(/^\s+|\s+$/g, '');
    if (!name) return null;
    if (/^https?:\/\//i.test(name)) return name;
    if (name.indexOf('images/') === 0) return name;
    if (name.indexOf('/') === 0) return IMG.replace(/\/?$/, '/') + name.replace(/^\//, '');
    return IMG + name;
  }

  function applyManifest(data) {
    var raw = Array.isArray(data) ? data : data && (data.files || data.images);
    if (!raw || !raw.length) return;
    var resolved = [];
    var seen = Object.create(null);
    var i;
    for (i = 0; i < raw.length; i++) {
      var path = normalizeManifestEntry(raw[i]);
      if (path && !seen[path]) {
        seen[path] = true;
        resolved.push(path);
      }
    }
    if (resolved.length) PHOTO_URLS = resolved;
  }

  function loadManifest(done) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      done();
      return;
    }
    fetch(IMG + 'manifest.json', { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('no manifest');
        return r.json();
      })
      .then(applyManifest)
      .catch(function () {})
      .then(done);
  }

  function preloadOne(url) {
    return new Promise(function (resolve) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        var finish = function () {
          READY.push(url);
          resolve(url);
        };
        if (typeof im.decode === 'function') {
          im.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      };
      im.onerror = function () {
        resolve(null);
      };
      im.src = url;
    });
  }

  function preloadAll() {
    return Promise.all(PHOTO_URLS.map(preloadOne));
  }

  function pickReadyUrl() {
    if (!READY.length) return null;
    if (READY.length === 1) return READY[0];
    var idx;
    do {
      idx = Math.floor(Math.random() * READY.length);
    } while (idx === lastShown);
    lastShown = idx;
    return READY[idx];
  }

  function injectRoot() {
    var root = document.createElement('div');
    root.id = 'snapshot-root';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="snapshot-flash"></div>' +
      '<div class="snapshot-frame"><img alt="" decoding="sync" /></div>';
    document.body.appendChild(root);
    return {
      root: root,
      flash: root.querySelector('.snapshot-flash'),
      frame: root.querySelector('.snapshot-frame'),
      img: root.querySelector('img')
    };
  }

  var els;
  var busy = false;
  var hideTimer = 0;
  var FRAME_MS = prefersReducedMotion() ? 220 : 720;
  var FLASH_MS = prefersReducedMotion() ? 100 : 280;

  function setOpacity(el, value) {
    el.style.opacity = String(value);
  }

  function animateOpacity(el, keyframes, duration) {
    if (typeof el.animate === 'function') {
      return el.animate(keyframes, {
        duration: duration,
        easing: 'linear',
        fill: 'forwards'
      });
    }
    setOpacity(el, keyframes[keyframes.length - 1].opacity);
    return null;
  }

  function play(url) {
    if (busy) return;
    busy = true;

    window.clearTimeout(hideTimer);
    setOpacity(els.flash, 0);
    setOpacity(els.frame, 0);

    // Set the image first while overlays are hidden, then animate in.
    els.img.src = url;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        animateOpacity(
          els.flash,
          [{ opacity: 0 }, { opacity: 0.9, offset: 0.18 }, { opacity: 0 }],
          FLASH_MS
        );
        animateOpacity(
          els.frame,
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.08 },
            { opacity: 1, offset: 0.78 },
            { opacity: 0 }
          ],
          FRAME_MS
        );

        hideTimer = window.setTimeout(function () {
          setOpacity(els.frame, 0);
          setOpacity(els.flash, 0);
          busy = false;
        }, FRAME_MS + 40);
      });
    });
  }

  function onClick(e) {
    if (isWritingLink(e.target)) return;
    // Allow mailto/tel without triggering snapshot.
    var el = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
    if (el && el.closest) {
      var a = el.closest('a');
      if (a) {
        var href = (a.getAttribute('href') || '').toLowerCase();
        if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
      }
    }

    var url = pickReadyUrl();
    if (!url) return;
    play(url);
  }

  function start() {
    if (!document.body) return;
    var existing = document.getElementById('snapshot-root');
    if (existing) {
      els = {
        root: existing,
        flash: existing.querySelector('.snapshot-flash'),
        frame: existing.querySelector('.snapshot-frame'),
        img: existing.querySelector('img')
      };
    } else {
      els = injectRoot();
    }

    preloadAll().then(function () {
      document.addEventListener('click', onClick, true);
    });
  }

  function init() {
    loadManifest(start);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
