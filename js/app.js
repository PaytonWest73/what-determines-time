/* What Determines Time? — boots the almanac and keeps it sized to the screen. */
(function () {
  'use strict';
  var root = document.documentElement;
  var fit = document.getElementById('fit');
  var stage = document.getElementById('stage');
  var PLATE_W = 1280, PLATE_H = 800;
  var scale = 1, flow = false;

  function pickMode() {
    var vw = root.clientWidth, vh = window.innerHeight;
    return vw < 900 || vh < 560 || vw / vh < 1.15;
  }

  function fitFlowHeight() {
    if (!flow) return;
    fit.style.height = Math.ceil(stage.offsetHeight * scale) + 'px';
  }

  function layout() {
    flow = pickMode();
    root.classList.toggle('mode-flow', flow);
    root.classList.toggle('mode-plate', !flow);
    var vw = root.clientWidth, vh = window.innerHeight;
    if (!flow) {
      var cs = getComputedStyle(document.body);
      var w = document.body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var h = document.body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      scale = Math.max(0.1, Math.min(w / PLATE_W, h / PLATE_H));
      stage.style.width = PLATE_W + 'px';
      stage.style.height = PLATE_H + 'px';
      fit.style.width = PLATE_W * scale + 'px';
      fit.style.height = PLATE_H * scale + 'px';
    } else {
      // design width between 420 and 720 px, then scale to the screen
      var W = Math.min(Math.max(vw, 420), 720);
      scale = Math.min(vw / W, vh < 560 ? 1 : 1.2);
      stage.style.width = W + 'px';
      stage.style.height = 'auto';
      fit.style.width = W * scale + 'px';
      root.style.setProperty('--draw', String(Math.min(440, W - 64)));
      root.style.setProperty('--vh-design', (vh / scale) + 'px');
    }
    stage.style.transform = 'scale(' + scale + ')';
    fitFlowHeight();
  }

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  if (window.ResizeObserver) new ResizeObserver(fitFlowHeight).observe(stage);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFlowHeight);

  try { DC.mount(stage, 'Main2', {}); } catch (e) { console.error(e); }
  layout();

  // a change of page in flow mode starts at the top
  var lastFace = null;
  setInterval(function () {
    if (!flow) return;
    var f = stage.querySelector('.wdt-faces > dc-c > div, .wdt-shell > dc-c > div');
    if (f !== lastFace) { if (lastFace) window.scrollTo(0, 0); lastFace = f; }
  }, 250);
})();
