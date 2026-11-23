/* Folia Dental Studio, Beranda.
   Port vanilla JS dari tiga resource Velox (OrbitalCards, ArjunaButton,
   WaveCarousel) ke HTML/CSS/JS biasa, plus glue situs (menu, FAQ, fallback
   gambar). Tanpa framework, tanpa dependensi eksternal. */

(function () {
  "use strict";
  var host = window;

  /* ---------- fallback gambar: blok pink berlabel kalau file belum ada ---------- */
  function initImageFallbacks() {
    var imgs = document.querySelectorAll("img[data-img-fallback]");
    imgs.forEach(function (img) {
      var mark = function () {
        var box = img.closest("[data-media]");
        if (box) box.classList.add("is-missing");
      };
      img.addEventListener("error", mark);
      if (img.complete && img.naturalWidth === 0) mark();
    });
  }

  /* ---------- OrbitalCards (port dari initOrbitalCards.js) ---------- */
  var FRONT_ANGLE = 80;
  var STAGGER = 0.2;
  var START_SCALE = 0.25;
  var CATCH_UP = 0.15;
  var LERP = 0.12;
  var TRIGGER = 0.25;
  var DEPTH = 0.6;
  var FOCUS_BOOST = 0.1;
  var EXIT_SCALE = 0.85;
  var EXIT_STAGGER = 0.4;
  var NARROW = 560;
  var NARROW_X = 0.94;
  var NARROW_Y = 0.54;
  var NARROW_FRONT = 90;
  var RAD = Math.PI / 180;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { return 1 + 2.25 * Math.pow(t - 1, 3) + 1.25 * Math.pow(t - 1, 2); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function initOrbitalCards(root, options) {
    var reducedMotion = root.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)");
    var cleanup = function () {};
    var remount = function () {
      cleanup();
      cleanup = function () {};
      cleanup = mountOrbitalMode(root, options, reducedMotion.matches);
    };
    reducedMotion.addEventListener("change", remount);
    try { remount(); } catch (error) {
      reducedMotion.removeEventListener("change", remount);
      throw error;
    }
    return function () {
      reducedMotion.removeEventListener("change", remount);
      cleanup();
    };
  }

  function mountOrbitalMode(root, opts, reduced) {
    var radiusXcqw = opts.radiusX, radiusYcqw = opts.radiusY, steps = opts.steps,
        entry = opts.entry, exitStart = opts.exitStart, scatter = opts.scatter,
        farBlur = opts.farBlur, farFade = opts.farFade;
    var win = root.ownerDocument.defaultView;
    var stage = root.querySelector(".velox-orbital-cards__stage");
    var center = root.querySelector(".velox-orbital-cards__center");
    var cards = Array.prototype.slice.call(root.querySelectorAll(".velox-orbital-cards__card"));
    var count = cards.length;
    var step = 360 / count;
    var rotAtExit = -steps * step;
    var abort = new AbortController();
    var signal = abort.signal;
    var observers = [];
    var raf = 0;
    var dispose = function () {
      abort.abort();
      observers.forEach(function (o) { o.disconnect(); });
      win.cancelAnimationFrame(raf);
      raf = 0;
      cards.forEach(function (c) { c.removeAttribute("style"); });
      center.removeAttribute("style");
    };

    var radiusX = 0, radiusY = 0, cardHalfHeight = 0;
    var depthRange = DEPTH, focusBoost = FOCUS_BOOST, frontAngle = FRONT_ANGLE;
    var measure = function () {
      var width = root.clientWidth || 1;
      var ring = stage.clientWidth || width;
      var narrow = width < NARROW;
      radiusX = ring * (narrow ? NARROW_X : radiusXcqw / 100);
      radiusY = ring * (narrow ? NARROW_Y : radiusYcqw / 100);
      depthRange = narrow ? 0 : DEPTH;
      focusBoost = narrow ? 0 : FOCUS_BOOST;
      frontAngle = narrow ? NARROW_FRONT : FRONT_ANGLE;
      cardHalfHeight = (cards[0] ? cards[0].offsetHeight : 0) / 2;
    };

    var target = 0, current = 0, intro = 0;
    var onScreen = false, introActive = false, fullyOut = true, last = 0;
    var readScroll = function () {
      var rect = root.getBoundingClientRect();
      var viewport = win.innerHeight || 1;
      introActive = rect.top <= viewport * TRIGGER && rect.bottom > 0;
      fullyOut = rect.bottom <= 0 || rect.top >= viewport;
      var travel = root.offsetHeight - viewport;
      target = travel <= 0 ? 0 : clamp(-rect.top / travel, 0, 1);
    };

    var paint = function (p, it, seat) {
      var seats = seat !== undefined ? seat : (p / exitStart) * steps;
      var ringRot = -seats * step;
      var exit = seat === undefined ? clamp((p - exitStart) / (1 - exitStart), 0, 1) : 0;
      for (var i = 0; i < count; i++) {
        var t = clamp((it - (i / (count - 1)) * STAGGER) / (1 - STAGGER), 0, 1);
        var spread = easeOutBack(t);
        var appear = easeOutCubic(clamp(t * 1.7, 0, 1));
        var angle = (frontAngle + i * step + ringRot) * RAD;
        var order = ((((i * step + rotAtExit) % 360) + 360) % 360) / step;
        var et = clamp((exit - (order / (count - 1)) * EXIT_STAGGER) / (1 - EXIT_STAGGER), 0, 1);
        var exitT = et * et * et;
        var exitMul = 1 + (scatter - 1) * exitT;
        var x = Math.cos(angle) * radiusX * spread * exitMul;
        var y = Math.sin(angle) * radiusY * spread * exitMul;
        var depth = (Math.sin(angle) + 1) / 2;
        var focus = Math.pow(depth, 8);
        var ringScale = (1 - depthRange / 2) + depthRange * depth + focusBoost * focus;
        var scale = mix(START_SCALE, ringScale, clamp(spread, 0, 1)) * mix(1, EXIT_SCALE, exitT);
        var blur = farBlur * (1 - depth) * (1 - focus) * appear;
        var opacity = appear * (1 - farFade * (1 - depth) * (1 - focus)) * (1 - exitT);
        var card = cards[i];
        card.style.transform = "translate3d(" + x.toFixed(2) + "px, " + (y - cardHalfHeight).toFixed(2) + "px, 0) scale(" + scale.toFixed(3) + ")";
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.05 ? "blur(" + blur.toFixed(2) + "px)" : "";
        card.style.zIndex = String(Math.round(depth * 100));
      }
      var headIn = easeInOutCubic(clamp(it * 1.2, 0, 1));
      var headOut = easeInOutCubic(exit);
      center.style.transform = "translate(-50%, -50%) scale(" + (mix(0.92, 1, headIn) * mix(1, 0.96, headOut)).toFixed(3) + ")";
      center.style.opacity = (mix(0.35, 1, headIn) * (1 - headOut)).toFixed(3);
    };

    var frame = function (now) {
      raf = 0;
      if (signal.aborted) return;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (fullyOut) intro = 0;
      else intro = clamp(intro + (introActive ? 1 : -1) * dt / entry, 0, 1);
      current += (target - current) * LERP;
      if (Math.abs(target - current) < 0.0002) current = target;
      paint(current, Math.max(intro, clamp(current / CATCH_UP, 0, 1)));
      if (onScreen) raf = win.requestAnimationFrame(frame);
    };

    try {
      if (reduced) {
        var still = function () {
          readScroll();
          paint(0, 1, Math.round(target * (count - 1)));
        };
        var resizeReduced = function () { measure(); still(); };
        win.addEventListener("scroll", still, { passive: true, signal: signal });
        win.addEventListener("resize", resizeReduced, { signal: signal });
        var ro = new ResizeObserver(resizeReduced);
        observers.push(ro);
        ro.observe(root);
        cards.forEach(function (c) { ro.observe(c); });
        resizeReduced();
        return dispose;
      }
      var resize = function () { measure(); readScroll(); };
      win.addEventListener("scroll", readScroll, { passive: true, signal: signal });
      win.addEventListener("resize", resize, { signal: signal });
      var ro2 = new ResizeObserver(resize);
      observers.push(ro2);
      ro2.observe(root);
      ro2.observe(stage);
      cards.forEach(function (c) { ro2.observe(c); });
      var observer = new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (!onScreen || raf || signal.aborted) return;
        readScroll();
        last = performance.now();
        raf = win.requestAnimationFrame(frame);
      });
      observers.push(observer);
      observer.observe(root);
      resize();
      paint(0, 0);
    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
  }

  /* ---------- ArjunaButton (port vanilla, Web Animations API) ----------
     Koreografi asli dipertahankan: tahap 1 langsung saat hover/fokus (label
     naik, pill membesar 1.05x, avatar dan YOU berputar masuk), tahap 2
     setelah 500ms (lingkaran bergeser ke kiri, kata "Yuk, Chat!" masuk
     kata per kata). Spring Motion diganti cubic-bezier overshoot. */
  function initArjunaButton(button) {
    var win = button.ownerDocument.defaultView;
    var find = function (name) { return button.querySelector(".arjuna-button__" + name); };
    var bg = find("bg"), label = find("label"), avatar = find("avatar"),
        you = find("you"), plus = find("plus"), hoverLabel = find("hover-label");
    var words = Array.prototype.slice.call(hoverLabel.children);
    var reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    var wordsDelay = 500;
    var springEase = "cubic-bezier(0.34, 1.56, 0.64, 1)";
    var anims = new Map();
    var timer = 0, active = false, disposed = false;
    var hovered = button.matches(":hover");
    var focused = button.matches(":focus-visible");
    var abort = new AbortController();
    var signal = abort.signal;

    function move(el, keyframes, options, channel) {
      channel = channel || "main";
      var channels = anims.get(el);
      if (!channels) { channels = new Map(); anims.set(el, channels); }
      var prev = channels.get(channel);
      if (prev) prev.cancel();
      var opts = reduced.matches ? { duration: 0, fill: "forwards" } : options;
      opts.fill = "forwards";
      var anim = el.animate(keyframes, opts);
      channels.set(channel, anim);
      return anim;
    }

    function circles(left, right, visible, animateBlur) {
      move(avatar, [{ transform: "translateX(" + left + "px) rotate(" + (visible ? 0 : -180) + "deg)", opacity: visible ? 1 : 0 }],
        { duration: 700, easing: springEase }, "position");
      move(you, [{ transform: "translateX(" + right + "px) rotate(" + (visible ? 0 : 180) + "deg)", opacity: visible ? 1 : 0 }],
        { duration: 700, easing: springEase }, "position");
      if (animateBlur === false) return;
      var opts = { duration: visible ? 300 : 220, easing: "cubic-bezier(0.2, 0, 0, 1)" };
      move(avatar, [{ filter: "blur(" + (visible ? 0 : 5) + "px)" }], opts, "filter");
      move(you, [{ filter: "blur(" + (visible ? 0 : 5) + "px)" }], opts, "filter");
    }

    function groupLeft() {
      return -(74 + 8 + hoverLabel.getBoundingClientRect().width) / 2;
    }

    function end() {
      if (!active || disposed) return;
      var left = groupLeft();
      move(avatar, [{ filter: "blur(0px)" }], { duration: 0 }, "filter");
      move(you, [{ filter: "blur(0px)" }], { duration: 0 }, "filter");
      circles(left + 25, left + 49, true, false);
      move(plus, [{ opacity: 0, transform: "translate(-50%, -50%) translate(" + (left + 37) + "px, 0px)" }],
        { duration: 700, easing: springEase });
      hoverLabel.style.transform = "translate(" + (left + 82) + "px, -50%)";
      hoverLabel.style.visibility = "visible";
      words.forEach(function (word, index) {
        move(word, [
          { opacity: 0, transform: "translateX(-20px)", filter: "blur(2px)" },
          { opacity: 1, transform: "translateX(0)", filter: "blur(0px)" }
        ], { duration: 500, delay: 100 + index * 100, easing: "cubic-bezier(0, 0, 0, 1)" }, "word" + index);
      });
    }

    function update() {
      var next = (hovered || focused) && !button.disabled;
      if (next === active) return;
      active = next;
      win.clearTimeout(timer);
      hoverLabel.style.visibility = "hidden";
      words.forEach(function (word, index) {
        var ch = anims.get(word);
        if (ch) { ch.forEach(function (a) { a.cancel(); }); anims.delete(word); }
      });
      move(bg, [{ transform: "scale(" + (active ? 1.05 : 1) + ")" }], { duration: 700, easing: springEase });
      move(label, [{ transform: "translateY(" + (active ? -60 : 0) + "px)" }], { duration: 700, easing: springEase });
      if (active) {
        circles(-39.9, 39.9, true);
        move(plus, [{ opacity: 1, transform: "translate(-50%, -50%) translate(0px, 0px)" }],
          { duration: 700, easing: springEase });
        if (reduced.matches) end();
        else timer = win.setTimeout(end, wordsDelay);
      } else {
        circles(-98, 98, false);
        move(plus, [{ opacity: 0, transform: "translate(-50%, -50%) translate(0px, 16.2px)" }],
          { duration: 700, easing: springEase });
      }
    }

    function dispose() {
      disposed = true;
      win.clearTimeout(timer);
      abort.abort();
      anims.forEach(function (channels) { channels.forEach(function (a) { a.cancel(); }); });
      anims.clear();
    }

    try {
      move(avatar, [{ transform: "translateX(-98px) rotate(-180deg)", opacity: 0, filter: "blur(5px)" }], { duration: 0 });
      move(you, [{ transform: "translateX(98px) rotate(180deg)", opacity: 0, filter: "blur(5px)" }], { duration: 0 });
      button.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        hovered = true; update();
      }, { signal: signal });
      var leave = function () { hovered = false; update(); };
      button.addEventListener("pointerleave", leave, { signal: signal });
      button.addEventListener("pointercancel", leave, { signal: signal });
      button.addEventListener("focus", function () {
        focused = button.matches(":focus-visible"); update();
      }, { signal: signal });
      button.addEventListener("blur", function () { focused = false; update(); }, { signal: signal });
      reduced.addEventListener("change", function () {
        win.clearTimeout(timer);
        if (!reduced.matches) {
          if (!active) return;
          active = false; update();
          return;
        }
        if (active && hoverLabel.style.visibility !== "visible") end();
        anims.forEach(function (channels) { channels.forEach(function (a) { a.finish(); }); });
      }, { signal: signal });
      button.ownerDocument.fonts.ready.then(function () {
        if (disposed || !active || hoverLabel.style.visibility !== "visible") return;
        var left = groupLeft();
        circles(left + 25, left + 49, true, false);
        hoverLabel.style.transform = "translate(" + (left + 82) + "px, -50%)";
      });
      update();
    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
  }

  /* ---------- WaveCarousel (port dari initWaveCarousel.js, suara mati) ---------- */
  var TICK_MIN = 9, TICK_MAX = 26, TICK_SIGMA = 2.1, MARK_EXTRA = 7, TICK_BOX = 33;
  var TICKS_PER_SLIDE = 7, FADE_FROM = 2.4, FADE_SPAN = 1.2, FLICK_MS = 160;
  var bump = function (distance, sigma) { return Math.exp(-(distance * distance) / (2 * sigma * sigma)); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - t, 4); };

  function initWaveCarousel(root, opts) {
    var gap = opts.gap, falloff = opts.falloff, smallest = opts.smallest, snap = opts.snap;
    var owner = root.ownerDocument;
    var win = owner.defaultView;
    var abort = new AbortController();
    var signal = abort.signal;
    var slides = Array.prototype.slice.call(root.querySelectorAll(".velox-wave-carousel__slide"));
    var cards = slides.map(function (s) { return s.querySelector(".velox-wave-carousel__card"); });
    var ticks = Array.prototype.slice.call(root.querySelectorAll(".velox-wave-carousel__tick"));
    var label = root.querySelector(".velox-wave-carousel__label");
    var name = root.querySelector(".velox-wave-carousel__name");
    var stage = root.querySelector(".velox-wave-carousel__stage");
    var count = slides.length;
    var authoredName = name.textContent;
    var startIndex = Math.max(0, cards.findIndex(function (c) { return c.getAttribute("aria-current") === "true"; }));
    var names = cards.map(function (c) { return c.querySelector(".velox-wave-carousel__title").textContent; });
    var scaleAt = function (d) { return smallest + (1 - smallest) * bump(d, falloff); };
    var reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
    var lastTick = startIndex * TICKS_PER_SLIDE;
    var p = startIndex, target = p, current = startIndex, tween = null, raf = 0;

    var dispose = function () {
      abort.abort();
      win.cancelAnimationFrame(raf);
      root.removeAttribute("data-dragging");
      slides.concat(ticks, [label]).forEach(function (el) { el.removeAttribute("style"); });
      name.textContent = authoredName;
      cards.forEach(function (card, i) {
        if (i === startIndex) card.setAttribute("aria-current", "true");
        else card.removeAttribute("aria-current");
      });
    };

    var paint = function () {
      var widths = slides.map(function (_, i) { return scaleAt(i - p); });
      var offsets = [0];
      for (var i = 1; i < count; i++) offsets[i] = offsets[i - 1] + (widths[i - 1] + widths[i]) / 2 + gap;
      var i0 = clamp(Math.floor(p), 0, count - 2);
      var anchor = offsets[i0] + (p - i0) * (offsets[i0 + 1] - offsets[i0]);
      slides.forEach(function (slide, i) {
        var distance = Math.abs(i - p);
        var opacity = 1 - clamp((distance - FADE_FROM) / FADE_SPAN, 0, 1);
        slide.style.transform = "translateX(" + ((offsets[i] - anchor) * 100).toFixed(2) + "%) scale(" + widths[i].toFixed(4) + ")";
        slide.style.opacity = opacity.toFixed(3);
        slide.style.zIndex = String(100 - Math.round(distance * 10));
        slide.style.visibility = opacity < 0.01 ? "hidden" : "";
      });
      var crest = p * TICKS_PER_SLIDE;
      ticks.forEach(function (tick, j) {
        var mark = j % TICKS_PER_SLIDE === 0;
        var height = TICK_MIN + (TICK_MAX - TICK_MIN) * bump(j - crest, TICK_SIGMA) + (mark ? MARK_EXTRA : 0);
        tick.style.transform = "scaleY(" + (height / TICK_BOX).toFixed(4) + ")";
        if (mark) tick.style.setProperty("--active", clamp(1 - Math.abs(j / TICKS_PER_SLIDE - p), 0, 1).toFixed(3));
      });
      label.style.setProperty("--x", (1 + crest * 8).toFixed(2) + "px");
      var tickIndex = Math.round(crest);
      if (tickIndex !== lastTick) lastTick = tickIndex;
      var index = clamp(Math.round(p), 0, count - 1);
      if (index !== current) {
        current = index;
        name.textContent = names[index];
        cards.forEach(function (card, i) {
          if (i === index) card.setAttribute("aria-current", "true");
          else card.removeAttribute("aria-current");
        });
      }
    };

    var frame = function (now) {
      raf = 0;
      if (signal.aborted) return;
      if (tween) {
        var t = clamp((now - tween.start) / snap, 0, 1);
        p = tween.from + (tween.to - tween.from) * easeOutQuart(t);
        if (t >= 1) tween = null;
      }
      paint();
      if (tween) raf = win.requestAnimationFrame(frame);
    };
    var schedule = function () {
      if (!raf && !signal.aborted) raf = win.requestAnimationFrame(frame);
    };
    var go = function (index) {
      target = clamp(index, 0, count - 1);
      if (reducedMotion.matches) { tween = null; p = target; paint(); return; }
      tween = { from: p, to: target, start: performance.now() };
      schedule();
    };

    try {
      var down = false, moved = false, startX = 0, startP = 0, lastX = 0, lastT = 0, velocity = 0, pitch = 1;
      stage.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        down = true; moved = false; tween = null;
        startX = lastX = event.clientX;
        lastT = event.timeStamp;
        velocity = 0; startP = p;
        pitch = slides[0].offsetWidth * ((1 + scaleAt(1)) / 2 + gap) || 1;
      }, { signal: signal });
      win.addEventListener("pointermove", function (event) {
        if (!down) return;
        var dx = event.clientX - startX;
        if (!moved && Math.abs(dx) > 4) { moved = true; root.setAttribute("data-dragging", ""); }
        var dt = event.timeStamp - lastT;
        if (dt > 0) velocity = (event.clientX - lastX) / dt;
        lastX = event.clientX; lastT = event.timeStamp;
        if (moved) { p = target = clamp(startP - dx / pitch, 0, count - 1); schedule(); }
      }, { signal: signal });
      var release = function () {
        if (!down) return;
        down = false;
        root.removeAttribute("data-dragging");
        if (moved) go(Math.round(p - (velocity / pitch) * FLICK_MS));
        else if (p !== Math.round(p)) go(Math.round(p));
      };
      win.addEventListener("pointerup", release, { signal: signal });
      win.addEventListener("pointercancel", release, { signal: signal });

      cards.forEach(function (card, i) {
        card.addEventListener("focus", function () {
          if (card.matches(":focus-visible") && i !== Math.round(target)) go(i);
        }, { signal: signal });
        card.addEventListener("click", function (event) {
          if (event.detail === 0 || !moved) go(i);
        }, { signal: signal });
      });

      var focusRun = 0;
      root.addEventListener("keydown", function (event) {
        var map = { ArrowRight: Math.round(target) + 1, ArrowLeft: Math.round(target) - 1, Home: 0, End: count - 1 };
        var index = map[event.key];
        if (index === undefined) return;
        event.preventDefault();
        go(index);
        var card = cards[clamp(index, 0, count - 1)];
        var run = ++focusRun, tries = 0;
        var focusCard = function () {
          var activeEl = owner.activeElement;
          var outside = activeEl && activeEl !== owner.body && !root.contains(activeEl);
          if (signal.aborted || run !== focusRun || outside) return;
          card.focus({ preventScroll: true });
          if (owner.activeElement !== card && ++tries < 90) win.requestAnimationFrame(focusCard);
        };
        focusCard();
      }, { signal: signal });

      reducedMotion.addEventListener("change", function () {
        if (!reducedMotion.matches || !tween) return;
        tween = null; p = target; paint();
      }, { signal: signal });

      paint();
    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
  }

  /* ---------- carousel testimoni: autoplay ke kanan, jeda saat disentuh ---------- */
  function initTestiCarousel(root) {
    var win = root.ownerDocument.defaultView;
    var track = root.querySelector(".testi-track");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".testi-slide"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".testi-dots button"));
    var prev = root.querySelector('[data-dir="-1"]');
    var next = root.querySelector('[data-dir="1"]');
    var count = slides.length;
    if (!track || count < 2) return function () {};
    var reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    var index = 0, timer = 0, paused = false;
    var go = function (i) {
      index = ((i % count) + count) % count;
      track.style.transform = "translateX(-" + slides[index].offsetLeft + "px)";
      slides.forEach(function (s, j) {
        if (j === index) s.setAttribute("aria-current", "true");
        else s.removeAttribute("aria-current");
      });
      dots.forEach(function (d, j) {
        if (j === index) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    };
    var stop = function () { if (timer) { win.clearInterval(timer); timer = 0; } };
    var start = function () {
      stop();
      if (reduced.matches || paused) return;
      timer = win.setInterval(function () { go(index + 1); }, 4500);
    };
    root.addEventListener("pointerenter", function () { paused = true; stop(); });
    root.addEventListener("pointerleave", function () { paused = false; start(); });
    root.addEventListener("focusin", function () { paused = true; stop(); });
    root.addEventListener("focusout", function () { paused = false; start(); });
    if (prev) prev.addEventListener("click", function () { go(index - 1); start(); });
    if (next) next.addEventListener("click", function () { go(index + 1); start(); });
    dots.forEach(function (d, j) {
      d.addEventListener("click", function () { go(j); start(); });
    });
    root.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); start(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); start(); }
    });
    win.addEventListener("resize", function () { go(index); });
    reduced.addEventListener("change", start);
    go(0);
    start();
    return function () { stop(); };
  }

  /* ---------- glue situs ---------- */
  function initNav() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    if (!header || !toggle) return;
    toggle.addEventListener("click", function () {
      var open = header.getAttribute("data-nav-open") === "true";
      header.setAttribute("data-nav-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });
    header.querySelectorAll(".site-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.setAttribute("data-nav-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var btn = item.querySelector(".faq-question");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var open = item.getAttribute("data-open") === "true";
        item.setAttribute("data-open", String(!open));
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
  }

  function initLayananAccordion() {
    document.querySelectorAll(".layanan-accordion").forEach(function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll(".layanan-acc"));
      function setOpen(item, open) {
        item.setAttribute("data-open", String(open));
        var b = item.querySelector(".layanan-acc__row");
        if (b) b.setAttribute("aria-expanded", String(open));
      }
      items.forEach(function (item) {
        var btn = item.querySelector(".layanan-acc__row");
        if (!btn) return;
        btn.addEventListener("click", function () {
          var open = item.getAttribute("data-open") === "true";
          items.forEach(function (other) { setOpen(other, false); });
          setOpen(item, !open);
        });
      });
      var hash = window.location.hash.slice(1);
      if (hash) {
        var target = document.getElementById(hash);
        if (target && target.classList.contains("layanan-acc")) {
          items.forEach(function (other) { setOpen(other, false); });
          setOpen(target, true);
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initImageFallbacks();
    initNav();
    initFaq();
    initLayananAccordion();
    var orbital = document.querySelector(".velox-orbital-cards");
    if (orbital) {
      try {
        initOrbitalCards(orbital, { radiusX: 34, radiusY: 17, steps: 5, entry: 1.55, exitStart: 0.8, scatter: 2.4, farBlur: 10, farFade: 0.8 });
      } catch (e) {
        orbital.classList.add("orbital-fallback");
      }
    }
    document.querySelectorAll(".arjuna-button").forEach(function (btn) {
      try { initArjunaButton(btn); } catch (e) { /* tombol tetap berfungsi sebagai link */ }
    });
    var wave = document.querySelector(".velox-wave-carousel");
    if (wave) {
      try {
        initWaveCarousel(wave, { gap: 0.028, falloff: 0.76, smallest: 0.55, snap: 500 });
      } catch (e) { /* kartu tengah tetap terlihat lewat CSS first-paint */ }
    }
    document.querySelectorAll(".testi-carousel").forEach(function (c) {
      try { initTestiCarousel(c); } catch (e) { /* kartu pertama tetap terlihat */ }
    });
  });
})();
