/* Decorative theme adapter only, not weather or observed astronomy.
   Reuses the real weather module's documented 07:00/19:00 fallback boundaries
   without importing that module's fixed-location proxy or forecast data. */
(function () {
  'use strict';
  function theme(now) {
    var rise = new Date(now), set = new Date(now), margin = 45 * 60000;
    rise.setHours(7, 0, 0, 0);
    set.setHours(19, 0, 0, 0);
    var t = now.getTime(), r = rise.getTime(), s = set.getTime();
    var phase = t < r - margin || t > s + margin ? 'night' :
      t < r + margin ? 'dawn' : t > s - margin ? 'dusk' : 'day';
    document.documentElement.setAttribute('data-sky', phase);
    // 'clear' selects the original neutral sky artwork, not a weather reading.
    document.documentElement.setAttribute('data-wx', 'clear');
  }
  App.on('minute', theme);
  App.on('ready', function () { theme(App.now()); });
}());
