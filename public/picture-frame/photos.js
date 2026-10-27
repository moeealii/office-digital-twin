// Photos: full-bleed editorial slideshow with layout modes.
(function () {
  'use strict';
  var V = { el: null, show: null, layout: 'auto', loud: false };
  var LAYOUTS = [['auto', 'Auto'], ['cover', 'Cover'], ['pair', 'Pair'], ['collage', 'Collage'], ['polaroid', 'Polaroid']];

  function heart() {
    var s = V.show && V.show.current, on = s && s.photos[0].fav;
    var b = V.el.querySelector('[data-fav]');
    // Favourites only steer the demo photos; the family feed decides its own order
    b.hidden = !!(s && s.photos[0].feed);
    b.classList.toggle('is-on', !!on);
    b.querySelector('span').textContent = on ? 'Favourite' : 'Favourite';
  }

  // Index of the collage/pair pane at a screen point (the tap zones sit above the panes), or -1.
  function paneAt(x, y) {
    var panes = App.$$('.ph-stage .slide:last-child .pane', V.el);
    for (var i = 0; i < panes.length; i++) {
      var r = panes[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return -1;
  }

  // Other views open a photo here (Today's photo card): remember it until the view shows.
  App.openPhoto = function (p) { V.pending = p; App.go('photos'); };

  App.register('photos', {
    show: function (el) {
      if (!V.el) {
        V.el = el;
        el.innerHTML = '<div class="photos">' +
          '<div class="ph-stage"></div>' +
          '<button class="ph-zone ph-zone--l" data-prev aria-label="Previous"></button>' +
          '<button class="ph-zone ph-zone--c" data-loud aria-label="Show details"></button>' +
          '<button class="ph-zone ph-zone--r" data-next aria-label="Next"></button>' +
          '<div class="ph-top"><div class="seg seg--glass">' + LAYOUTS.map(function (l) {
            return '<button data-layout="' + l[0] + '" class="' + (l[0] === V.layout ? 'is-on' : '') + '">' + l[1] + '</button>';
          }).join('') + '</div></div>' +
          '<div class="ph-bottom">' +
          '  <button class="ph-btn" data-prev>' + App.icon('left', 30) + '</button>' +
          '  <button class="ph-btn ph-btn--fav" data-fav>' + App.icon('heart', 30) + '<span>Favourite</span></button>' +
          '  <button class="ph-btn" data-next>' + App.icon('right', 30) + '</button>' +
          '</div></div>';
        V.show = new App.Slideshow(el.querySelector('.ph-stage'), { layout: V.layout, onChange: function () { setTimeout(heart); } });
        el.addEventListener('click', function (e) {
          var t = e.target.closest('button');
          if (!t) return;
          if (t.hasAttribute('data-next')) V.show.next();
          if (t.hasAttribute('data-prev')) V.show.prev();
          if (t.hasAttribute('data-loud')) {
            // On a pair or collage, the middle tap opens the photo under the finger on its own
            var cur = V.show.current, pane = cur && cur.photos.length > 1 && paneAt(e.clientX, e.clientY);
            if (pane >= 0 && cur.photos[pane]) { V.show.focus(cur.photos[pane]); return; }
            V.loud = !V.loud; el.querySelector('.photos').classList.toggle('is-loud', V.loud);
          }
          if (t.dataset.layout) {
            V.layout = t.dataset.layout;
            App.$$('[data-layout]', el).forEach(function (b) { b.classList.toggle('is-on', b === t); });
            V.show.setLayout(V.layout);
          }
          if (t.hasAttribute('data-fav')) {
            var p = V.show.current && V.show.current.photos[0];
            if (!p) return;
            p.fav = !p.fav;
            heart();
            App.toast(p.fav ? 'Added to favourites · it’ll show up more often' : 'Removed from favourites', { icon: 'heart', ms: 2500 });
          }
        });
      }
      if (V.pending) { V.show.focus(V.pending); V.pending = null; }
      else V.show.start();
    },
    resume: function () {
      if (V.pending) { V.show.focus(V.pending); V.pending = null; }
      else V.show.start();
    },
    hide: function () { if (V.show) V.show.stop(); }
  });
})();
