/* Safe local adapters for the REAL Today, Shopping and Photos views.
   Not a feed client: no URLs, images, network, persistence or camera services. */
(function () {
  'use strict';
  if (!App.publicDemo) return;
  var D = window.DATA;

  // Original, visibly illustrative SVG scenes, never household photographs.
  function art(p) {
    var shapes = p.id === 'art-sun' ?
      '<path fill="#283b61" d="M0 0h600v400H0z"/><circle cx="390" cy="145" r="76" fill="#f4c792"/><path fill="#647b8f" d="M0 260l170-145 190 190 130-130 110 80v145H0z"/><path fill="#bdad98" d="M0 325l220-110 240 135 140-70v120H0z"/>' :
      p.id === 'art-arches' ?
      '<path fill="#d9c8b3" d="M0 0h600v400H0z"/><path fill="#a47b65" d="M95 400V170a130 130 0 0 1 260 0v230z"/><path fill="#e8dfcf" d="M135 400V175a90 90 0 0 1 180 0v225z"/><path fill="#7c8b8f" d="M320 400V240a90 90 0 0 1 180 0v160z"/><circle cx="461" cy="87" r="42" fill="#f6e6bf"/>' :
      '<path fill="#e2ddce" d="M0 0h600v400H0z"/><circle cx="445" cy="103" r="70" fill="#eecb93"/><path fill="#839782" d="M290 280c-120-15-154-80-123-139 92 6 140 48 123 139zM311 215c-8-92 31-143 100-144 12 83-24 133-100 144zM307 310c32-95 83-118 147-87-29 83-78 104-147 87z"/><path fill="#aa8067" d="M250 270h110l23 130H227z"/>';
    return '<svg class="demo-art" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + App.esc(p.title) + ' · original synthetic illustration">' + shapes + '</svg>';
  }
  function panel(p) { return art(p) + '<span class="demo-art-mark">Generated art · not a photograph</span>'; }
  App.photoMeta = function (p) { return { kicker: 'Generated art · demo', place: p.title, people: [], onThisDay: false }; };
  App.namesLine = function () { return ''; };

  // Implements only the slideshow surface used by the original shared views.
  // No timers/ambient takeover: advance art explicitly with the original controls.
  App.Slideshow = function (el, opts) {
    opts = opts || {};
    var self = this, index = 0, layout = opts.layout || 'auto';
    function render(single) {
      var mode = single ? 'cover' : layout === 'auto' ? ['cover', 'pair', 'collage'][index % 3] : layout;
      var count = mode === 'pair' ? 2 : mode === 'collage' ? 3 : 1;
      var photos = Array.from({ length: count }, function (_, i) { return D.demoArt[(index + i) % D.demoArt.length]; });
      self.current = { photos: photos };
      var body;
      if (mode === 'polaroid') {
        body = '<figure class="polaroid"><div class="polaroid-img">' + panel(photos[0]) + '</div><figcaption><span>' + App.esc(photos[0].title) + '</span><span class="pol-date">Demo art</span></figcaption></figure>';
      } else if (count > 1) {
        body = photos.map(function (p, i) { return '<div class="pane' + (mode === 'collage' && i === 0 ? ' pane--a' : '') + '">' + panel(p) + '</div>'; }).join('');
      } else body = panel(photos[0]);
      if (opts.captions !== false && mode !== 'polaroid') body += '<div class="cap cap--m"><div class="cap-kicker">Public demo · original illustrations</div><div class="cap-date serif">' + App.esc(photos[0].title) + '</div></div>';
      el.innerHTML = '<div class="slide slide--' + mode + '">' + body + '</div>';
      if (opts.onChange) opts.onChange(self.current);
    }
    this.start = function () { render(); };
    this.stop = function () {};
    this.next = function () { index = (index + 1) % D.demoArt.length; render(); };
    this.prev = function () { index = (index + D.demoArt.length - 1) % D.demoArt.length; render(); };
    this.setLayout = function (next) { if (['auto', 'cover', 'pair', 'collage', 'polaroid'].indexOf(next) >= 0) { layout = next; render(); } };
    this.focus = function (p) { var found = D.demoArt.findIndex(function (item) { return item.id === p.id; }); if (found >= 0) { index = found; render(true); } };
  };

  var scenes = [
    { id: 'synthetic-scene-a', name: 'Demo scene A', art: 'art-sun' },
    { id: 'synthetic-scene-b', name: 'Demo scene B', art: 'art-arches' },
    { id: 'synthetic-scene-c', name: 'Demo scene C', art: 'art-garden' }
  ];
  function sceneArt(c) { return D.demoArt.find(function (p) { return p.id === c.art; }); }
  var C = App.Cams = { ready: true, demo: true, list: scenes };
  C.isUp = function () { return true; };
  C.stateLabel = function () { return 'Synthetic'; };
  C.find = function (id) { return scenes.find(function (scene) { return scene.id === id; }); };
  C.Grid = function (el, options) {
    this.render = function () {
      el.innerHTML = scenes.slice(0, options && options.max || scenes.length).map(function (c) {
        return '<button class="cam-tile" data-cam="' + c.id + '" aria-label="Open ' + c.name + ' · synthetic illustration">' + art(sceneArt(c)) + '<span class="cam-age">Synthetic demo</span><span class="cam-name">' + c.name + '</span></button>';
      }).join('');
    };
    this.start = function () {};
    this.stop = function () {};
  };
  C.live = function (c) {
    if (scenes.indexOf(c) < 0) return;
    var current = scenes.indexOf(c);
    App.sheet('<div class="sheet-pad"><div class="label">Synthetic scene demo · not a camera feed</div><h2 class="sheet-h serif">' + App.esc(c.name) + '</h2><div class="demo-scene-stage"></div><p class="demo-scene-note">Original generated artwork only. No real cameras, live video or recordings are connected.</p><div class="sheet-actions"><button class="btn" data-scene-prev>Previous scene</button><button class="btn btn--solid" data-scene-next>Next scene</button></div></div>', {
      onMount: function (sheet) {
        function paint() { sheet.querySelector('.demo-scene-stage').innerHTML = panel(sceneArt(scenes[current])); sheet.querySelector('h2').textContent = scenes[current].name; }
        sheet.querySelector('[data-scene-prev]').addEventListener('click', function () { current = (current + scenes.length - 1) % scenes.length; paint(); });
        sheet.querySelector('[data-scene-next]').addEventListener('click', function () { current = (current + 1) % scenes.length; paint(); });
        paint();
      }
    });
  };
  // Thin synthetic-scene view, using the original camera grid/card styles.
  // The real network-backed camera module and its recording infrastructure never load.
  App.register('cameras', {
    show: function (el) {
      if (!el.firstChild) {
        el.innerHTML = '<div class="cv"><div class="cv-head"><div><div class="label">Public demo · generated scenes, not feeds</div><h1 class="serif cv-title">Synthetic cameras</h1></div></div><div class="cv-grid cam-grid"></div></div>';
        el.addEventListener('click', function (e) { var tile = e.target.closest('[data-cam]'); if (tile) C.live(C.find(tile.dataset.cam)); });
      }
      new C.Grid(el.querySelector('.cv-grid')).render();
    }
  });

  // Preserve actual shell contents, changing only inert rail containers to native
  // buttons for this interactive mode. Read-only mode does not enter this adapter.
  var routes = ['home', 'cameras', 'shopping', 'photos'];
  App.$$('.rail-item').forEach(function (item, i) {
    var button = document.createElement('button');
    button.type = 'button'; button.className = item.className;
    button.innerHTML = item.innerHTML; button.dataset.go = routes[i];
    item.replaceWith(button);
  });
  document.getElementById('rail').removeAttribute('aria-hidden');
  document.querySelector('main').setAttribute('aria-label', 'Home HQ interactive public demo · all content synthetic');

  // Add accessible focus/escape behavior around the ORIGINAL shared sheet.
  var originalSheet = App.sheet;
  App.sheet = function (html, options) {
    var previous = document.activeElement;
    var close = originalSheet(html, options);
    var sheet = document.querySelector('.sheet');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Synthetic Home HQ demo scene');
    sheet.querySelector('[data-close]').focus();
    App.closeSheet = function () { close(); if (previous && previous.isConnected) previous.focus(); };
    return App.closeSheet;
  };
  document.addEventListener('keydown', function (e) {
    var layer = document.getElementById('sheetLayer');
    if (e.key === 'Tab' && layer.classList.contains('is-open')) {
      var buttons = layer.querySelectorAll('button:not([disabled])');
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (layer.classList.contains('is-open')) {
      App.closeSheet();
    } else if (window.parent !== window) {
      window.parent.postMessage({ type: 'home-hq-demo:exit' }, '*');
    }
  });

  var readySent = false;
  function notifyParentReady() {
    if (readySent) return;
    readySent = true;
    if (window.parent !== window) window.parent.postMessage({ type: 'home-hq-demo:ready' }, '*');
  }
  function waitForDemoFonts() {
    // App's ready event follows the real Today DOM render. Font promises work
    // while the parent keeps this iframe hidden; requestAnimationFrame may not.
    var fonts = document.fonts;
    if (!fonts || typeof fonts.load !== 'function') { notifyParentReady(); return; }
    try {
      Promise.allSettled([
        fonts.load('800 150px "Archivo"'),
        fonts.load('400 24px "Instrument Serif"'),
        fonts.load('italic 400 22px "Instrument Serif"')
      ]).then(function () { return fonts.ready; }).then(notifyParentReady, notifyParentReady);
    } catch (_) { notifyParentReady(); }
  }

  App.on('ready', function () {
    // Keep the real original views, augmenting only their demo labels/accessibility.
    ['shopping', 'photos'].forEach(function (name) {
      var view = App.views[name], show = view.show;
      view.show = function (el, options) {
        show(el, options);
        if (name === 'shopping') {
          el.querySelector('.s-head .label').textContent = 'Synthetic demo list · changes stay in this frame';
          var input = el.querySelector('.s-input');
          input.maxLength = 80; input.setAttribute('aria-label', 'Add an item to the synthetic demo list');
        } else {
          el.querySelectorAll('button[data-prev]').forEach(function (button) { button.setAttribute('aria-label', 'Previous generated art'); });
          el.querySelectorAll('button[data-next]').forEach(function (button) { button.setAttribute('aria-label', 'Next generated art'); });
        }
      };
    });
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'public-demo-reset'; reset.textContent = 'Reset demo';
    reset.addEventListener('click', function () {
      App.closeSheet();
      var input = document.querySelector('.s-input');
      if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
      var all = document.querySelector('.s-stores [data-store="all"]');
      if (all) all.click();
      var drawer = document.querySelector('.s-drawer.is-open [data-drawer]');
      if (drawer) drawer.click();
      var auto = document.querySelector('.ph-top [data-layout="auto"]');
      if (auto) auto.click();
      window.resetHomeHQDemoData();
      App.emit('data');
      Object.keys(App.views).forEach(function (name) { App.views[name]._dirty = true; });
      App.go('home', { rerender: true });
      App.toast('Demo reset · all changes were in this frame only', { icon: 'undo', ms: 3000 });
    });
    document.getElementById('stage').appendChild(reset);
    waitForDemoFonts();
  });
}());
