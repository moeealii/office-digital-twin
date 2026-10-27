/* Opt-in public modes only. All demo content is authored synthetic data, kept
   exclusively in this document's memory. No private data/service modules load. */
(function () {
  'use strict';
  window.HOME_HQ_PUBLIC_PREVIEW = true;
  window.HOME_HQ_PUBLIC_DEMO = new URLSearchParams(location.search).get('mode') === 'demo';
  if (!window.HOME_HQ_PUBLIC_DEMO) {
    window.DATA = Object.freeze({ weather: Object.freeze({}) });
    return;
  }
  var serial = 0;
  var D = window.DATA = { weather: Object.freeze({}) };
  function reset() {
    // Keep IDs monotonic within this document so an original view's pending
    // check/undo timer cannot accidentally target a new item after reset.
    D._gid = function () { return 'synthetic-' + (++serial); };
    D.stores = [{ id: 'grocer', name: 'Sample market' }, { id: 'sample', name: 'Sample store' }];
    D.catOrder = { all: ['Produce', 'Pantry', 'Household'], grocer: ['Produce', 'Pantry', 'Household'], sample: ['Produce', 'Pantry', 'Household'] };
    D.catalog = [['Demo apples', 'Produce'], ['Demo carrots', 'Produce'], ['Demo oats', 'Pantry'], ['Demo tea', 'Pantry'], ['Demo soap', 'Household'], ['Demo towels', 'Household']];
    D.usuals = D.catalog.map(function (item) { return item[0]; });
    D.groceries = D.catalog.slice(0, 3).map(function (item, i) {
      return { id: D._gid(), name: item[0], cat: item[1], qty: 1, store: i === 2 ? 'sample' : 'grocer', done: false, note: 'Synthetic demo item' };
    });
    D.demoArt = [
      { id: 'art-sun', title: 'Generated sunrise', o: 'l', fav: false },
      { id: 'art-arches', title: 'Generated arches', o: 'p', fav: false },
      { id: 'art-garden', title: 'Generated garden', o: 'l', fav: false }
    ];
  }
  reset();
  window.resetHomeHQDemoData = reset;
  document.getElementById('stage').classList.add('public-demo');
  document.querySelector('.public-label').textContent = 'Public demo · synthetic content';
  document.querySelector('.public-clock-source').textContent = 'Browser-local clock · decorative sky, not weather · all scenes, art and shopping are synthetic';
  document.title = 'Home HQ · Interactive public demo';
}());
