// Home / Today: the glanceable overview. Never scrolls.
(function () {
  'use strict';
  var D = window.DATA, V = {};

  function clock() {
    var n = App.now();
    return '<div class="h-time num">' + App.fmt.time(n, false) + '<span class="h-ampm">' + App.fmt.ampm(n) + '</span></div>' +
      '<div class="h-date"><b>' + App.fmt.day(n) + '</b> ' + App.fmt.month(n) + ' ' + n.getDate() + '</div>';
  }

  function privateContent(icon, title, message) {
    return '<div class="public-placeholder">' + App.icon(icon, 48) + '<b>' + title + '</b><span>' + message + '</span></div>';
  }

  function weather() {
    if (App.publicPreview) return '<div class="h-wx-top">' + App.icon('cloud', 60) +
      '<span class="h-wx-meta"><b>Weather unavailable</b><span>Not connected in public preview</span></span></div>' +
      '<div class="h-wx-say">No location or forecast is shared.</div>';
    var w = App.weatherNow();
    var hours = App.hourly(7);
    var tmin = Math.min.apply(null, hours.map(function (h) { return h.t; }));
    var tmax = Math.max.apply(null, hours.map(function (h) { return h.t; }));
    return '<div class="h-wx-top">' +
      '<span class="h-wx-icon">' + App.icon(w.cond, 60) + '</span>' +
      '<span class="h-wx-temp num">' + w.temp + '°</span>' +
      '<span class="h-wx-meta"><b>' + w.label + '</b><span>H ' + w.hi + '°  L ' + w.lo + '°</span></span>' +
      '</div>' +
      '<div class="h-wx-say"><b>' + w.summary + '.</b> ' + w.advice + '.</div>' +
      '<div class="h-wx-hours">' + hours.map(function (h) {
        var lift = tmax === tmin ? 0 : Math.round((h.t - tmin) / (tmax - tmin) * 6);   // .h-hr-i has 6px headroom
        return '<div class="h-hr' + (h.p >= 50 ? ' is-wet' : '') + '"><span class="h-hr-l">' + h.label + '</span>' +
          '<span class="h-hr-i" style="transform:translateY(' + -lift + 'px)">' + App.icon(h.c, 22) + '</span><b>' + h.t + '°</b></div>';
      }).join('') + '</div>';
  }

  function camStatus() {
    if (App.publicPreview && !App.publicDemo) return '<div class="label">Cameras · private</div>' +
      '<div class="h-cs-row"><small>No status or images shared</small></div>';
    var C = App.Cams;
    if (!C.ready) return '<div class="label">Cameras</div><div class="h-cs-row"><span>Connecting…</span></div>';
    var shown = C.list.slice(0, 4), more = C.list.length - shown.length;
    return '<div class="label">Cameras' + (C.demo ? ' · demo' : '') + '</div>' + shown.map(function (c) {
      return '<div class="h-cs-row' + (C.isUp(c) ? '' : ' is-down') + '"><i></i><b>' + App.esc(c.name) + '</b><small>' + C.stateLabel(c) + '</small></div>';
    }).join('') + (more > 0 ? '<div class="h-cs-row"><small>+' + more + ' more</small></div>' : '');
  }

  function shopping() {
    if (App.publicPreview && !App.publicDemo) return '<div class="label">Shopping · private</div>' +
      privateContent('lock', 'Household lists stay private', 'No shopping contents or counts are shared.');
    var open = D.groceries.filter(function (g) { return !g.done; });
    var recent = open.slice(-6).reverse();
    return '<div class="label">Shopping' + (App.publicDemo ? ' · demo' : '') + '</div>' +
      '<div class="h-stat"><span class="num">' + open.length + '</span><small>' + (open.length === 1 ? 'item' : 'items') + ' to get</small></div>' +
      '<ul class="h-recent">' + recent.map(function (g) {
        return '<li><i></i>' + App.esc(g.name) + '</li>';
      }).join('') + '</ul>';
  }


  function paint() {
    var el = V.el;
    el.querySelector('.h-clock').innerHTML = clock();
    el.querySelector('.h-weather').innerHTML = weather();
    el.querySelector('.h-camstat').innerHTML = camStatus();
    el.querySelector('.h-shop').innerHTML = shopping();
  }

  function photoCaption(s) {
    var m = App.photoMeta(s.photos[0]);
    V.el.querySelector('.h-photo-cap').innerHTML = '<b>' + (m.onThisDay ? 'On this day · ' : '') + m.kicker + '</b><span>' + App.esc(m.place || App.namesLine(m.people)) + '</span>';
  }

  App.register('home', {
    show: function (el) {
      V.el = el;
      if (!el.firstChild) {
        var readOnly = App.publicPreview && !App.publicDemo;
        var tag = readOnly ? 'div' : 'button';
        function route(name) { return readOnly ? '' : ' data-go="' + name + '"'; }
        el.innerHTML = '<div class="home">' +
          '<div class="h-clock"></div>' +
          '<div class="h-weather"></div>' +
          '<' + tag + ' class="h-camstat"' + route('cameras') + '></' + tag + '>' +
          // Camera tiles and the shopping card share one grid (the cam grid is display:contents),
          // so shopping fills the slot after the last camera instead of leaving a hole.
          '<div class="h-camwrap"><div class="h-cams cam-grid"></div>' +
          '  <' + tag + ' class="h-shop card"' + route('shopping') + '></' + tag + '></div>' +
          '<' + tag + ' class="h-photo"' + route('photos') + '><div class="h-photo-stage"></div><div class="h-photo-cap"></div></' + tag + '>' +
          '</div>';
        if (!readOnly) el.addEventListener('click', function (e) {
          var cam = e.target.closest('[data-cam]');
          if (cam) { App.Cams.live(App.Cams.find(cam.dataset.cam)); return; }
          var cur = e.target.closest('.h-photo') && V.slides.current;   // open this photo in Photos
          if (cur && cur.photos[0]) { App.openPhoto(cur.photos[0]); return; }
          var g = e.target.closest('[data-go]');
          if (g) App.go(g.dataset.go);
        });
        if (readOnly) {
          el.querySelector('.h-cams').innerHTML = '<div class="cam-tile">' +
            privateContent('lock', 'Cameras · private', 'No camera images or feeds are shared.') + '</div>';
          el.querySelector('.h-photo-stage').innerHTML = privateContent('photo', 'Personal photos · private', 'No family photos are shared.');
          el.querySelector('.h-photo-cap').innerHTML = '<b>Photos · private</b><span>Not shared</span>';
        } else {
          V.slides = new App.Slideshow(el.querySelector('.h-photo-stage'), { layout: 'cover', captions: false, onChange: photoCaption });
          V.cams = new App.Cams.Grid(el.querySelector('.h-cams'), { max: 6, interval: 30000 });
        }
      }
      paint();
      if (App.publicPreview && !App.publicDemo) return;
      V.cams.render();
      V.slides.start();
      if (App.current === 'home') V.cams.start(); // not during background prebuild
    },
    resume: function () { if (!App.publicPreview || App.publicDemo) { V.slides.start(); V.cams.start(); } },
    hide: function () { if (V.slides) V.slides.stop(); if (V.cams) V.cams.stop(); }
  });
  // Every minute: just the clock (cheap, even while hidden). Weather on the hour.
  App.on('minute', function (n) {
    if (!V.el || !V.el.firstChild) return;
    V.el.querySelector('.h-clock').innerHTML = clock();
    if (n.getMinutes() === 0) V.el.querySelector('.h-weather').innerHTML = weather();
  });
  App.on('cams', function () { if (V.el && V.el.firstChild) V.el.querySelector('.h-camstat').innerHTML = camStatus(); });
  App.on('data', function () { if (App.current === 'home') paint(); });
})();
