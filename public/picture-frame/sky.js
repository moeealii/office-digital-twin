// Still sky overlay, drawn once into a canvas over the CSS sky gradient (css/sky.css). Kept quiet, in
// the spirit of Apple Weather: a soft bloom of light where the sun really is (between today's sunrise
// and sunset, warmer when it's low), faint fine stars and the moon with tonight's real phase at night,
// gentle haze banks for cloud and fog, sparse soft flakes for snow. No animation (the A33 can't keep
// up); redrawn only when the sky or weather changes, or every 10 minutes as the sun and moon move.
(function () {
  'use strict';
  var D = window.DATA, W = 1280, H = 800, cv = null, last = '', seed = 1;

  // Deterministic randomness: the stars and haze stay put between redraws (new layout each day)
  function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function rnd(a, b) { return a + rand() * (b - a); }
  function glow(g, x, y, r, stops) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }

  function sunBloom(g, x, y, low, k) {
    var c = low ? '255,196,140' : '255,246,224';
    glow(g, x, y, 420, [[0, 'rgba(' + c + ',' + (.55 * k) + ')'], [.18, 'rgba(' + c + ',' + (.3 * k) + ')'], [.5, 'rgba(' + c + ',' + (.08 * k) + ')'], [1, 'rgba(' + c + ',0)']]);
    glow(g, x, y, 60, [[0, 'rgba(255,255,250,' + (.85 * k) + ')'], [.35, 'rgba(255,252,240,' + (.4 * k) + ')'], [1, 'rgba(255,250,235,0)']]);
  }
  // Night sky with character: a faint Milky Way band, a dense field of fine stars, and a few bright
  // ones with soft halos, some warm, some blue. Cloud dims them (k) but never removes them.
  var TINTS = ['255,255,255', '255,244,226', '226,236,255', '255,232,214', '214,228,255'];
  function star(g, x, y, r, a, tint) {
    if (r > 1) glow(g, x, y, r * 7, [[0, 'rgba(' + tint + ',' + (a * .35).toFixed(3) + ')'], [1, 'rgba(' + tint + ',0)']]);
    g.fillStyle = 'rgba(' + tint + ',' + a.toFixed(3) + ')';
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  function stars(g, k) {
    // Milky Way: a soft diagonal glow, then extra-dense dust stars along it
    g.save(); g.translate(760, 120); g.rotate(-.32); g.scale(1, .2);
    glow(g, 0, 0, 760, [[0, 'rgba(196,206,255,' + (.24 * k).toFixed(3) + ')'], [.45, 'rgba(176,186,245,' + (.1 * k).toFixed(3) + ')'], [1, 'rgba(176,186,245,0)']]);
    g.restore();
    for (var j = 0; j < 420; j++) {
      var u = rnd(-1, 1), v = (rand() + rand() + rand() - 1.5) * .22;
      var bx = 760 + u * 700, by = 120 + v * 300 - u * 230;
      if (by < -10 || by > 520) continue;
      star(g, bx, by, rnd(.3, .7), rnd(.2, .55) * k, '230,235,255');
    }
    for (var i = 0; i < 280; i++) {
      var x = rnd(80, W), y = Math.pow(rand(), 1.3) * 560, roll = rand();
      var r = roll < .05 ? rnd(1.3, 1.9) : roll < .2 ? rnd(.8, 1.2) : rnd(.35, .75);
      star(g, x, y, r, (r > 1.2 ? rnd(.75, 1) : rnd(.25, .7)) * k, TINTS[Math.floor(rand() * TINTS.length)]);
    }
  }
  function moon(g, x, y, phase, k) { // phase 0 = new, .5 = full
    var r = 17, waxing = phase < .5, c = Math.cos(phase * 2 * Math.PI);
    var lit = (1 - c) / 2;                      // illuminated fraction
    glow(g, x, y, 220, [[0, 'rgba(205,218,255,' + (.28 * k * (.35 + lit)) + ')'], [.35, 'rgba(205,218,255,' + (.1 * k * (.35 + lit)) + ')'], [1, 'rgba(205,218,255,0)']]);
    g.globalAlpha = k;
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(250,248,240,.95)';
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
    g.ellipse(x, y, Math.abs(c) * r, r, 0, Math.PI / 2, -Math.PI / 2, (c > 0) === waxing);
    g.fill();
    g.globalAlpha = 1;
  }
  function haze(g, n, y0, y1, rgb, a) { // wide, flat, soft banks: cloud decks and fog
    for (var i = 0; i < n; i++) {
      var x = rnd(-100, W + 100), y = rnd(y0, y1), rx = rnd(260, 520);
      g.save(); g.translate(x, y); g.scale(1, rnd(.16, .3));
      glow(g, 0, 0, rx, [[0, 'rgba(' + rgb + ',' + (a * rnd(.6, 1)).toFixed(3) + ')'], [1, 'rgba(' + rgb + ',0)']]);
      g.restore();
    }
  }
  // A cumulus: overlapping puffs on a flat base, each lit from above (highlight -> body -> soft edge),
  // the lower ones in the base tone, so it reads as a volume rather than a flat blob.
  function cumulus(g, x, y, w, t, a) {
    var n = Math.round(14 + w / 40), puffs = [];
    for (var i = 0; i < n; i++) {
      var u = rand(), px = x + u * w, hump = Math.sin(u * Math.PI);           // taller in the middle
      var r = w * rnd(.09, .17) * (.55 + hump * .7);
      puffs.push([px, y - hump * w * rnd(.08, .16) - rnd(0, r * .4), r]);
    }
    puffs.sort(function (p, q) { return q[1] - p[1]; });                      // low puffs first
    puffs.forEach(function (p) {
      var low = p[1] > y - w * .05;
      var gr = g.createRadialGradient(p[0] - p[2] * .25, p[1] - p[2] * .4, p[2] * .1, p[0], p[1], p[2]);
      gr.addColorStop(0, 'rgba(' + (low ? t.body : t.hi) + ',' + a + ')');
      gr.addColorStop(.55, 'rgba(' + (low ? t.base : t.body) + ',' + (a * .85).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + t.base + ',0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], p[2], 0, 6.283); g.fill();
    });
  }
  var TONES = {
    day:   { hi: '255,255,255', body: '232,237,245', base: '196,206,222' },
    rain:  { hi: '214,222,234', body: '168,180,198', base: '128,140,160' },
    storm: { hi: '150,158,176', body: '104,112,132', base: '66,72,90' },
    night: { hi: '150,162,198', body: '82,94,128',   base: '46,54,84' },
    nightStorm: { hi: '132,112,180', body: '64,52,104', base: '30,24,56' },
    dusk:  { hi: '255,226,214', body: '214,180,196', base: '150,128,168' }
  };
  // [count, size range, alpha] per condition
  var CLOUDS = { partly: [3, 170, 300, .5], cloudy: [5, 260, 420, .46], rain: [6, 260, 420, .5], storm: [6, 280, 460, .6], snow: [5, 240, 400, .44] };
  function clouds(g, wx, sky) {
    var c = CLOUDS[wx];
    if (!c) return;
    var tone = sky === 'night' ? (wx === 'storm' ? TONES.nightStorm : TONES.night) : wx === 'storm' ? TONES.storm : wx === 'rain' ? TONES.rain
             : (sky === 'dusk' || sky === 'dawn') && wx === 'partly' ? TONES.dusk : TONES.day;
    var slot = (W + 200) / c[0];
    for (var i = 0; i < c[0]; i++) {
      var w = rnd(c[1], c[2]);
      cumulus(g, -120 + i * slot + rnd(0, slot - w * .6), rnd(60, 190), w, tone, (c[3] * (sky === 'night' ? 1.1 : 1)).toFixed(3));
    }
  }

  function flakes(g) {
    for (var i = 0; i < 90; i++) {
      var x = rnd(0, W), y = rnd(0, H), r = rand() < .15 ? rnd(2, 3) : rnd(.8, 1.6);
      glow(g, x, y, r * 2, [[0, 'rgba(255,255,255,.7)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    }
  }

  // Position along an arc across the stage: progress 0..1 between two times, or null outside them
  function arc(now, a, b) {
    var p = (now - a) / (b - a);
    if (p < 0 || p > 1) return null;
    return { p: p, x: 110 + p * (W - 240), y: 250 - Math.sin(p * Math.PI) * 215 };
  }

  // How much each condition dims the sun/moon/stars, and its haze: [banks, alpha, colour]
  var DIM = { clear: 1, partly: .75, cloudy: .25, fog: .3, rain: .15, snow: .3, storm: .08 };
  var HAZE = { partly: [4, .14, '255,255,255'], cloudy: [7, .16, '220,228,238'], fog: [9, .2, '235,238,242'],
               rain: [6, .12, '170,186,204'], snow: [6, .16, '235,242,250'], storm: [6, .14, '120,130,150'] };

  function paint() {
    if (!cv) return;
    var root = document.documentElement, sky = root.getAttribute('data-sky') || 'day', wx = root.getAttribute('data-wx') || 'clear';
    var now = App.now(), t = now.getTime(), Wx = D.weather;
    var key = sky + '/' + wx + '/' + Math.floor(t / 6e5);
    if (key === last) return;
    last = key;
    var g = cv.getContext('2d'), night = sky === 'night', k = DIM[wx] == null ? 1 : DIM[wx];
    g.clearRect(0, 0, W, H);
    seed = 11 + now.getDate();

    var rise = Wx.sunrise && Wx.sunrise[0], set = Wx.sunset && Wx.sunset[0];
    if (!rise || !set) { rise = new Date(now); rise.setHours(7, 0, 0, 0); set = new Date(now); set.setHours(19, 0, 0, 0); }
    if (night) {
      stars(g, Math.max(k, .45));
      var next = (Wx.sunrise && Wx.sunrise[1]) || new Date(rise.getTime() + 864e5);
      var pos = t > set.getTime() ? arc(t, set.getTime(), next.getTime()) : arc(t, set.getTime() - 864e5, rise.getTime());
      var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
      var ph = (((t - ref) / 864e5) % syn + syn) % syn / syn;
      if (pos) moon(g, pos.x, pos.y, ph, Math.max(k, .2));
    } else {
      var sp = arc(t, rise.getTime() - 45 * 6e4, set.getTime() + 45 * 6e4);
      if (sp) sunBloom(g, sp.x, sp.y, Math.sin(sp.p * Math.PI) < .35, Math.max(k, .12));
    }
    var h = HAZE[wx];
    if (h) haze(g, h[0], -20, wx === 'fog' ? 520 : 260, night ? '150,165,200' : h[2], night ? h[1] * (wx === 'fog' ? .8 : .35) : h[1]);
    if (wx === 'storm') {
      var lx = rnd(700, 1100), ly = rnd(80, 140), lc = night ? '190,160,255' : '220,215,255';
      glow(g, lx, ly, 260, [[0, 'rgba(' + lc + ',' + (night ? .32 : .22) + ')'], [.4, 'rgba(' + lc + ',.08)'], [1, 'rgba(' + lc + ',0)']]);
    }
    clouds(g, wx, sky);
    if (wx === 'snow') flakes(g);
  }

  App.on('ready', function () {
    cv = document.createElement('canvas');
    cv.className = 'sky';
    cv.width = W; cv.height = H;
    cv.setAttribute('aria-hidden', 'true');
    var stage = document.querySelector('.stage');
    stage.insertBefore(cv, stage.firstChild);
    paint();
    new MutationObserver(function () { paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sky', 'data-wx'] });
  });
  App.on('minute', paint);
  App.on('weather', function () { last = ''; paint(); });
})();
