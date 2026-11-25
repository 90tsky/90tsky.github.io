// The portfolio's behaviour (index.html; this was the test layout until 25 Nov). The bar is the site's own. Laptops: a column on the
// left lists every problem and decision at once (no dots, no tour), a click grows a picture to fill the picture area with
// its paragraph lit beside it, and About shows a map of every project. Phones keep the original behaviour.
// Portfolio site behaviour. Decisions are numbered as in DESIGN.md.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The projects keep their order from index.html (Kris, 15 Nov: Apps & UI first; the "Show first" buttons are gone).
  const root = document.documentElement;
  root.classList.add('is-loading');  // until the first view has settled (the loading block near the end)
  const list = document.getElementById('projects');
  const intro = document.getElementById('intro');
  const about = document.getElementById('about');

  // ---------- The project bar (Kris's sketch, 15 Nov) ----------
  // Cards in groups: About, then each section's data-group. Built from each section's own head, so a title or
  // description is only ever edited in index.html. Laptops: the bar runs along the bottom and behaves like the
  // recursive grid in Kris's reference video: the current project's card is the widest and shows its whole text, a card
  // the mouse rests on grows a little, its group grows with it, and everything else narrows to make room.
  // Phones: a slim bar of names along the bottom.
  // CFG: the open card's share, a hovered card's share (the others have 1), the wait before a hover counts; and for
  // scrolling through the projects, how far the wheel must turn to move one, and how long it must rest before the next;
  // and picMax, the tallest a row of pictures may be (a share of the height above the button).
  // ?tune in the address opens a panel that changes these live (next-tune.js).
  const CFG = { open: 3, hover: 1.7, hoverDelay: 120, wheelStep: 50, wheelRest: 200, picMax: .8 };
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', 'Projects');
  const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };
  const card = (id, title, desc) => {
    const a = el('a', 'rail-card');
    a.href = '#' + id;
    a.dataset.id = id;
    a.append(el('span', 'rc-title', title), el('span', 'rc-desc', desc));
    return a;
  };
  const groups = [];
  function group(label) {
    const g = el('div', 'rg'), k = el('span', 'rg-k', label), row = el('div', 'rg-row');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    k.setAttribute('aria-hidden', 'true');
    g.append(k, row);
    rail.append(g);
    groups.push(g);
    return row;
  }
  group('About').append(card('about', intro.querySelector('h1').textContent, intro.querySelector('.intro-sub').textContent));
  let row = null, label = null;
  [...list.children].forEach(sec => {
    if (sec.hidden) return;
    if (sec.dataset.group !== label) { label = sec.dataset.group; row = group(label); }
    const h = sec.querySelector('.p-head');
    row.append(card(sec.id, h.querySelector('.p-title').textContent, h.querySelector('.p-desc').textContent));
  });
  intro.after(rail);
  const cards = [...rail.querySelectorAll('.rail-card')];

  const targets = () => [...list.children].filter(s => !s.hidden).concat(about);
  const firstProject = () => list.querySelector('.project:not([hidden])').id;
  const isApp = () => root.classList.contains('is-app');
  let current = null, spyQuietUntil = 0, hovered = null;

  // Laptops: every card's share of the width. A group's share is the sum of its cards', so the sizes nest like the
  // recursive grid's cells. The shares animate in CSS (flex-grow); the text gets its final width at once (--tw).
  // The open card shows its whole text: the narrowest text width at which title and text fit the card's height,
  // found by trying widths (kept until the card height, the window or the font changes).
  const fitCache = new Map();
  function textWidthNeeded(c) {
    const key = c.dataset.id + '|' + c.clientHeight + '|' + innerWidth;
    if (fitCache.has(key)) return fitCache.get(key);
    const t = c.querySelector('.rc-title'), d = c.querySelector('.rc-desc'), cs = getComputedStyle(c);
    const room = c.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (parseFloat(cs.rowGap) || 0);
    const before = c.style.getPropertyValue('--tw');
    const fits = w => { c.style.setProperty('--tw', w + 'px'); return t.offsetHeight + d.scrollHeight <= room + 1; };
    let lo = 40, hi = 1000;
    if (fits(hi)) while (hi - lo > 3) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    c.style.setProperty('--tw', before);
    fitCache.set(key, hi);
    return hi;
  }
  // Every card's width (--cw) and its text's (--tw). The bar's width is shared out: the open card gets CFG.open shares,
  // or more if its text needs it, a hovered card CFG.hover, the rest one each. Groups are as wide as their cards.
  // No card gets narrower than MIN: on a narrow laptop window the bar scrolls sideways instead.
  const MIN = 90;
  let cardLeft = new Map(), barW = 0;
  function sizeBar() {
    if (!isApp()) return;
    const cur = cards.find(c => c.dataset.id === current);
    const hov = hovered !== cur ? hovered : null;
    const cs = getComputedStyle(rail), ccs = getComputedStyle(cards[0]);
    const padX = parseFloat(ccs.paddingLeft) + parseFloat(ccs.paddingRight);
    const groupGap = parseFloat(cs.columnGap) || 0, cardGap = parseFloat(getComputedStyle(groups[0].querySelector('.rg-row')).columnGap) || 0;
    const avail = rail.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      - groupGap * (groups.length - 1) - cardGap * (cards.length - groups.length);
    const rest = cards.length - (cur ? 1 : 0) - (hov ? 1 : 0) + (hov ? CFG.hover : 0);  // shares of the cards that aren't open
    const openW = cur ? Math.max(CFG.open * avail / (rest + CFG.open), textWidthNeeded(cur) + padX) : 0;
    const unit = Math.max(MIN, (avail - openW) / rest);
    const width = c => c === cur ? openW : c === hov ? CFG.hover * unit : unit;
    // Where each card will start once the cards have grown, so the bar can scroll the open one into view.
    let x = parseFloat(cs.paddingLeft);
    cardLeft = new Map();
    groups.forEach(g => {
      g.querySelectorAll('.rail-card').forEach(c => {
        const w = width(c);
        c.style.setProperty('--cw', w.toFixed(1) + 'px');
        c.style.setProperty('--tw', (w - padX).toFixed(1) + 'px');
        cardLeft.set(c, [x, w]);
        x += w + cardGap;
      });
      x += groupGap - cardGap;
    });
    barW = x - groupGap + parseFloat(cs.paddingRight);
  }
  new ResizeObserver(sizeBar).observe(rail);
  if (document.fonts) document.fonts.ready.then(() => { fitCache.clear(); sizeBar(); });

  // The mouse resting on a card (or the keyboard on it) opens it a little. A short wait, so sweeping across the bar
  // doesn't set every card moving. The growing card always stays under the mouse: only the others give way.
  let hoverT = 0, pending = null;
  const hoverTo = (c, wait) => {
    if (c === pending) return;
    clearTimeout(hoverT);
    pending = c;
    hoverT = setTimeout(() => { pending = null; if (hovered !== c) { hovered = c; sizeBar(); } }, wait);
  };
  rail.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || !isApp()) return;
    const c = e.target.closest('.rail-card');
    if (c) hoverTo(c, CFG.hoverDelay);
  });
  rail.addEventListener('pointerleave', () => hoverTo(null, 150));
  rail.addEventListener('focusin', e => { const c = e.target.closest('.rail-card'); if (c && isApp() && c.matches(':focus-visible')) hoverTo(c, 0); });
  rail.addEventListener('focusout', e => { if (!rail.contains(e.relatedTarget)) hoverTo(null, 0); });

  function mark(id) {
    current = id;
    cards.forEach(c => {
      const on = c.dataset.id === id;
      c.classList.toggle('is-current', on);
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    sizeBar();
    // Keep the current card in sight when the bar scrolls (phones, and narrow laptop windows).
    const c = cards.find(c => c.dataset.id === id), behavior = reduceMotion ? 'auto' : 'smooth';
    if (!c || (isApp() && barW <= rail.clientWidth + 1)) return;
    if (isApp()) {
      const [left, w] = cardLeft.get(c) || [c.offsetLeft, c.offsetWidth];
      if (left < rail.scrollLeft + 16 || left + w > rail.scrollLeft + rail.clientWidth - 16) rail.scrollTo({ left: left + w / 2 - rail.clientWidth / 2, behavior });
    } else if (c.offsetLeft < rail.scrollLeft + 16 || c.offsetLeft + c.offsetWidth > rail.scrollLeft + rail.clientWidth - 16) {
      rail.scrollTo({ left: c.offsetLeft - 16, behavior });
    }
  }

  // Switching projects (test layout, Kris 19 Nov: "the frames should go up (instead of left) and right (like they are
  // now) ... make it at a curve"). The pictures ride a curved track instead of being cut off at a line by the column:
  // pick a card further right and the current pictures leave upward, leaning a little left, while the new ones come in
  // from the right, rising a little as they come; further left, the other way round (down and out to the right, in from
  // the top). Each frame rides on its own, so they can go one after another, and tilt, shrink or fade on the way.
  // The column's text doesn't move: it dissolves into the next project's text. MOTION holds every setting, and ?tune
  // opens sliders for them (next-tune.js). A second click part-way through carries on from where every frame is.
  // Kris's values from the sliders (19 Nov): a quick, soft curve; the frames fade to about half on the way, tilt 5°, go
  // one after another 40 ms per frame-width, and the new ones wait 200 ms before they start. travel (20 Nov) is now a
  // share of the way fully out of sight (1.2: out a little before they stop); it used to be a share of the screen (0.9).
  const MOTION = { dur: 470, ease: 'cubic-bezier(.2,.42,.2,1)', curve: .45, travel: 1.2, stagger: 40, wait: 200, fade: .55, tilt: 5, shrink: 1, textOut: 230, textIn: 360 };
  let slides = [];
  let bigPiece = null, bigAt = 0;  // the picture that's open (click to enlarge, further down)
  const clipped = new Set();
  const barIndex = id => cards.findIndex(c => c.dataset.id === id);
  const mover = s => s.querySelector('.collage, .map');                      // what holds the frames
  const frames = s => { const m = mover(s); return m ? [...m.children] : []; };
  const fader = s => s.querySelector('.p-body') || s.querySelector('.in');   // what dissolves
  // Where a frame is on the track: u from -1 (out on the right) through 0 (in place) to 1 (out at the top).
  const ride = new WeakMap();
  const uOf = f => {
    const r = ride.get(f);
    if (!r || r.anim.playState === 'idle') return 0;
    const p = r.anim.effect.getComputedTiming().progress;
    return p == null ? r.b : r.a + (r.b - r.a) * p;
  };
  // The track's shape. dx, dy: how far the right and top ends are. curve 0: straight lines (straight up, straight in
  // from the right); 1: each half turns 45°, so together they make one round sweep.
  function track(u, dx, dy, curve) {
    if (curve < .01) return u >= 0 ? [0, -u * dy] : [-u * dx, 0];
    const phi = curve * Math.PI / 4;
    if (u >= 0) { const R = dy / Math.sin(phi), a = phi * (1 - u); return [R * (Math.cos(phi) - Math.cos(a)), R * (Math.sin(a) - Math.sin(phi))]; }
    const R = dx / Math.sin(phi), b = phi * (1 + u);
    return [R * (Math.sin(phi) - Math.sin(b)), R * (Math.cos(b) - Math.cos(phi))];
  }
  function unclip(s) { const m = mover(s); if (m) { m.style.removeProperty('clip-path'); clipped.delete(m); } }
  function stopSlides() {
    slides.forEach(a => a.cancel());
    slides = [];
    clipped.forEach(m => m.style.removeProperty('clip-path'));
    clipped.clear();
    targets().forEach(s => { s.classList.remove('is-leaving'); s.inert = false; });
  }
  function showInStage(id, animate) {
    const next = document.getElementById(id);
    const prev = targets().find(s => s.classList.contains('is-shown'));
    // Where the visible projects are right now: every frame's place on the track, each project's average, and how
    // visible its text is.
    const at = new Map(), seen = new Map(), pos = new Map();
    targets().forEach(s => {
      if (!s.classList.contains('is-shown') && !s.classList.contains('is-leaving')) return;
      const fs = frames(s);
      let sum = 0;
      fs.forEach(f => { const u = uOf(f); pos.set(f, u); sum += u; });
      at.set(s, fs.length ? sum / fs.length : 0);
      seen.set(s, +getComputedStyle(fader(s)).opacity);
    });
    stopSlides();
    targets().forEach(s => s.classList.toggle('is-shown', s === next));
    if (prev !== next) { const st = next.querySelector('.steps'); if (st) st.scrollTop = 0; }  // a project always opens at the top of its list
    mark(id);
    stripSync(next);
    if (!animate || !prev || prev === next) return settleBig();
    // Reduced motion: nothing moves, the new project just fades in.
    if (reduceMotion) { slides = [next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })]; return settleBig(); }
    const M = MOTION, dir = barIndex(id) > barIndex(prev.id) ? 1 : -1;  // 1: the new project is further right in the bar
    // How far a project's frames go: all the way out of sight, measured from where they are (an enlarged one included;
    // Kris, 20 Nov: big pictures stopped at the edge, still showing), past the top of the screen or its right edge,
    // with room for the shadows and the tilt. travel 1: out just as they stop; more: out sooner, before the easing
    // slows them down at the end.
    const mr = main.getBoundingClientRect();
    const reach = fs => {
      let up = 0, right = 0, big = 0;
      fs.forEach(f => { const r = f.getBoundingClientRect(); up = Math.max(up, r.bottom - mr.top); right = Math.max(right, mr.right - r.left); big = Math.max(big, r.width, r.height); });
      const pad = 60 + big * Math.sin(Math.abs(M.tilt) * Math.PI / 180) / 2, t = Math.max(1, M.travel);
      return [(right + pad) * t, (up + pad) * t];
    };
    // The frames never cross into the text column, nor over the bar: while they move, what holds them is cut off at a
    // line halfway into the gap between the column and the pictures, and at the bottom of the stage.
    const line = main.getBoundingClientRect().left + padX + colW + colGap / 2;
    const move = (s, from, to, delay) => {
      const m = mover(s), fs = frames(s);
      if (!m || !fs.length) return [];
      const r = m.getBoundingClientRect(), sb = s.getBoundingClientRect().bottom;
      m.style.clipPath = `inset(-200vh -200vw ${(r.bottom - sb).toFixed(1)}px ${(line - r.left).toFixed(1)}px)`;
      clipped.add(m);
      const [dx, dy] = reach(fs);
      // One after another as a wave from the front of the train (going right in the bar: from the left; going left:
      // from the right): a frame waits M.stagger for every frame-width it stands behind the front, so pictures in the
      // same column go together and a long row doesn't keep the last ones waiting (Kris, 20 Nov: leaving to the right
      // felt slow at the start).
      const cx = fs.map(f => f.offsetLeft + f.offsetWidth / 2), ws = fs.map(f => f.offsetWidth).sort((p, q) => p - q), unit = ws[ws.length >> 1] || 1;
      const front = dir > 0 ? Math.min(...cx) : Math.max(...cx), lag = cx.map(x => M.stagger * Math.abs(x - front) / unit);
      return fs.map((f, i) => i).sort((i, j) => lag[i] - lag[j]).map(i => {
        const f = fs[i];
        // o0: how visible it is to begin with (the pictures dimmed behind an open one stay dimmed on the way).
        const a = pos.has(f) ? pos.get(f) : from, kf = [], N = 28, o0 = M.fade ? parseFloat(getComputedStyle(f).opacity) : 1;
        for (let k = 0; k <= N; k++) {
          const u = a + (to - a) * k / N, [x, y] = track(u, dx, dy, M.curve), o = { translate: `${x.toFixed(1)}px ${y.toFixed(1)}px` };
          if (M.tilt) o.rotate = (M.tilt * u).toFixed(2) + 'deg';
          if (M.shrink < 1) o.scale = (1 - (1 - M.shrink) * Math.min(1, Math.abs(u))).toFixed(3);
          if (M.fade) o.opacity = (o0 * (1 - M.fade * Math.min(1, Math.abs(u)))).toFixed(3);
          kf.push(o);
        }
        const anim = f.animate(kf, { duration: M.dur, delay: delay + lag[i], easing: M.ease, fill: 'both' });
        ride.set(f, { a, b: to, anim });
        slides.push(anim);
        return anim;
      });
    };
    const p0 = at.get(prev) || 0;
    at.forEach((u, s) => {
      if (s === next) return;
      // Still leaving from an earlier click: rides along, unless the new project comes in on its side (then it goes at once).
      if (s !== prev && Math.sign(u - p0) !== dir) return;
      s.classList.add('is-leaving');
      s.inert = true;
      const out = fader(s).animate([{ opacity: seen.get(s) }, { opacity: 0 }], { duration: M.textOut, easing: 'ease', fill: 'forwards' });
      slides.push(out);
      const anims = move(s, 0, dir, 0), last = anims[anims.length - 1] || out;
      // Once the last frame is gone: hide it and drop its animations (the faded text keeps no leftover opacity).
      last.onfinish = () => { if (!slides.includes(last)) return; s.classList.remove('is-leaving'); s.inert = false; out.cancel(); anims.forEach(a => a.cancel()); unclip(s); settleBig(); };
    });
    const was = seen.has(next) ? seen.get(next) : 0;  // coming back mid-way: carries on from where it is, without waiting
    const anims = move(next, -dir, 0, was > 0 ? 0 : M.wait), last = anims[anims.length - 1];
    if (last) last.onfinish = () => { if (!slides.includes(last)) return; anims.forEach(a => a.cancel()); unclip(next); };
    slides.push(fader(next).animate([{ opacity: was }, { opacity: 1 }], { duration: M.textIn, delay: was > 0 ? 0 : M.textOut, easing: 'ease-out', fill: 'backwards' }));
    settleBig();
  }
  // A picture that was open when its project left: it went out as it was (Kris, 19 Nov: "cant it leave the page
  // directly"), and once its project is out of sight it's put back, unseen.
  function settleBig() { if (bigPiece && !bigPiece.closest('.is-shown, .is-leaving')) shrink(); }
  function go(id, smooth) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isApp()) showInStage(id, smooth);
    else {
      spyQuietUntil = performance.now() + 900; // don't flick through the projects passed on the way
      el.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
      mark(id);
    }
    history.replaceState(null, '', '#' + id);
  }
  rail.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    go(a.hash.slice(1), true);
  });

  // Phones: the project crossing the upper third of the screen is the current one.
  const spy = new IntersectionObserver(entries => {
    if (isApp() || performance.now() < spyQuietUntil) return;
    entries.forEach(e => { if (e.isIntersecting) mark(e.target.id); });
  }, { rootMargin: '-30% 0px -60% 0px' });
  [intro, ...targets()].forEach(s => spy.observe(s));

  // Laptop or phone layout: follows the window, keeping the same project in front.
  const appMQ = matchMedia('(min-width: 900px) and (min-height: 560px)');
  function setMode() {
    root.classList.toggle('is-app', appMQ.matches);
    stopSlides();
    hovered = null;
    document.dispatchEvent(new Event('portfolio:mode'));  // the stories switch between the list (laptops) and one step at a time
    const known = current && targets().some(s => s.id === current);
    if (appMQ.matches) { layoutCol(); showInStage(known ? current : firstProject()); measureStrip(); }
    else if (known) { spyQuietUntil = performance.now() + 300; document.getElementById(current).scrollIntoView(); mark(current); }
  }
  appMQ.addEventListener('change', setMode);

  // ---------- Laptops: the same height for every project's dots and texts (Kris, 15 Nov) ----------
  // Every project gets the room the tallest text needs (--strip), so the dots and texts start at the same height on
  // every project and just dissolve into each other; the pictures take what's left (the same for every project).
  const main = document.querySelector('main');
  // Test layout 2: the column's width and the gaps, worked out here (the same sums as next.css's fallbacks) so the CSS
  // and the slide and enlarge maths agree.
  let padX = 32, colW = 320, colGap = 32;
  function layoutCol() {
    const vw = innerWidth, cl = (a, v, b) => Math.min(b, Math.max(a, v));
    padX = cl(16, vw * .025, 40); colW = cl(280, vw * .24, 380); colGap = cl(24, vw * .03, 56);
    main.style.setProperty('--pad-x', padX + 'px');
    main.style.setProperty('--col-w', colW + 'px');
    main.style.setProperty('--col-gap', colGap + 'px');
  }
  addEventListener('resize', layoutCol);
  function measureStrip() {
    if (!isApp()) return;
    let max = 0;
    list.querySelectorAll('.project:not([hidden])').forEach(s => {
      const off = !s.classList.contains('is-shown') && !s.classList.contains('is-leaving');
      if (off) s.classList.add('is-measure');  // laid out but not seen, just long enough to measure
      const b = s.querySelector('.p-body');
      if (b) max = Math.max(max, b.offsetHeight);
      if (off) s.classList.remove('is-measure');
    });
    main.style.setProperty('--strip', Math.ceil(max) + 'px');
    placeStrip();
  }

  // ---------- Laptops: one row of dots for every project (Kris, 15 Nov) ----------
  // Styled on the dots in Kris's blend prototype: the current step is the biggest dot (red), the others get smaller
  // with distance (12, 9, 7, then 5px), on a light capsule; every dot stays visible, so the number of steps shows.
  // The row holds still (Kris, 18 Nov): it starts at the text's left edge and no dot ever changes place; a step change
  // only swaps which dot is big. When the project changes, the dots both projects share stay where they are, extra
  // ones grow out of nothing at the end and spare ones shrink away there, while the texts dissolve. No progress timer.
  // It stands in for each project's own dots (still in the page, hidden on laptops; phones use those).
  const SIZES = [12, 9, 7, 5], STEP = 18;
  const strip = el('div', 'sdots');
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Decisions');
  list.after(strip);
  let stripSec = null, stripActive = -1;
  const pool = [];
  const srcDots = sec => sec ? [...sec.querySelectorAll('.p-body .dot')] : [];
  function stripSync(sec) {
    stripSec = sec;
    const src = srcDots(sec);
    const active = Math.max(0, src.findIndex(d => d.getAttribute('aria-pressed') === 'true'));
    stripActive = active;
    strip.classList.toggle('is-empty', !src.length);
    // The capsule runs from the first dot to the last, 13px past each.
    if (src.length) strip.style.setProperty('--cw', ((src.length - 1) * STEP + 26) + 'px');
    while (pool.length < src.length) {
      const b = el('button', 'sdot');
      b.type = 'button';
      b.disabled = true;
      b.append(el('i', ''), el('span', 'tip'));
      b.addEventListener('click', () => { const d = srcDots(stripSec)[pool.indexOf(b)]; if (d) d.click(); });
      strip.append(b);
      pool.push(b);
    }
    const place = k => (k * STEP) + 'px';
    // Dots that come out of nothing start right at their place (no sliding in), then grow.
    const appearing = pool.filter((b, k) => b.disabled && k < src.length);
    appearing.forEach(b => { b.classList.add('no-move'); b.style.setProperty('--x', place(pool.indexOf(b))); });
    if (appearing.length) strip.offsetWidth;  // settle those places before anything animates
    appearing.forEach(b => b.classList.remove('no-move'));
    pool.forEach((b, k) => {
      const d = Math.min(Math.abs(k - active), SIZES.length - 1), on = k < src.length;
      b.style.setProperty('--x', place(k));
      b.style.setProperty('--s', on ? SIZES[d] + 'px' : '0px');
      b.classList.toggle('is-active', on && k === active);
      b.disabled = !on;
      if (k < src.length) {
        const name = src[k].dataset.label;
        b.querySelector('.tip').textContent = name;
        b.setAttribute('aria-label', name);
        b.setAttribute('aria-pressed', String(k === active));
      }
    });
  }
  // The row sits on the top row of the text block, its capsule starting at the text's left edge (the same on every project).
  function placeStrip() {
    const b = (stripSec || document.querySelector('.project.is-shown') || list).querySelector('.p-body');
    if (!b || !isApp()) return;
    const r = b.getBoundingClientRect(), m = main.getBoundingClientRect();
    strip.style.setProperty('--sd-top', (r.top - m.top) + 'px');
    strip.style.setProperty('--sd-left', (r.left - m.left + 13) + 'px');
  }
  document.addEventListener('story', e => {
    if (e.target !== stripSec || !isApp()) return;
    if (e.detail.i !== stripActive) stripSync(stripSec);
  });
  new ResizeObserver(measureStrip).observe(main);
  if (document.fonts) document.fonts.ready.then(measureStrip);

  // Retouch's unlock link (#retouch&k=…, see "Retouch: locked"): the key comes out of the address at once, and the link
  // then opens Retouch like #retouch.
  const rtLinkKey = (location.hash.match(/^#retouch&k=([\w-]{43})$/) || [])[1] || '';
  if (rtLinkKey) history.replaceState(null, '', location.pathname + location.search + '#retouch');

  // First view: the project in the link (#stamp), otherwise the first project. The page opens on work, not on About.
  const linked = location.hash.slice(1);
  if (linked && targets().some(s => s.id === linked)) current = linked;
  setMode();

  // ?tune: sliders for the switch, the pictures and the bar (next-tune.js). Not part of the site: it stays on Kris's computer (.gitignore), so online ?tune does nothing.
  if (new URLSearchParams(location.search).has('tune')) {
    const step = d => { const i = barIndex(current), c = cards[(i + d + cards.length) % cards.length]; if (c) go(c.dataset.id, true); };
    window.portfolioTune = { CFG, sizeBar, MOTION, step, tidy };
    const s = document.createElement('script');
    s.src = 'next-tune.js';
    document.body.append(s);
  }

  // Ignore hover that only happens because the page scrolled under a resting mouse.
  let lastScroll = 0;
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });

  document.querySelectorAll('.project[data-story]').forEach(setupStory);

  // ---------- Animated posters: play while at least half on screen ----------
  if (!reduceMotion) {
    const posterIO = new IntersectionObserver(entries => entries.forEach(e => {
      e.target.classList.toggle('is-playing', e.intersectionRatio >= 0.5);
    }), { threshold: [0, 0.5] });
    document.querySelectorAll('.poster-anim').forEach(p => posterIO.observe(p));
  }

  // ---------- Loops in collages (blend, Interaction Stamp): play only while on screen. Reduced motion keeps the poster frame. ----------
  const loops = document.querySelectorAll('.piece video');
  if (loops.length && !reduceMotion) {
    const loopIO = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { const p = e.target.play(); if (p) p.catch(() => {}); } else e.target.pause();
    }), { threshold: 0.25 });
    loops.forEach(v => loopIO.observe(v));
  }

  // ---------- Posters: a click or tap opens the big view ----------
  // The poster is copied into the dialog; layers with data-big switch to their sharper copy once it has loaded.
  const viewer = document.querySelector('.viewer');
  if (viewer) {
    const stage = viewer.querySelector('.viewer-stage');
    let openBtn = null;
    document.querySelectorAll('.poster-btn').forEach(btn => btn.addEventListener('click', () => {
      if (isApp()) return;  // test layout: on laptops a poster grows in the picture area instead, with its text beside it
      const art = btn.firstElementChild.cloneNode(true);
      art.classList.remove('is-playing');
      art.classList.add('viewer-art');
      if (art.tagName === 'IMG') art.style.setProperty('--ar', art.getAttribute('width') + '/' + art.getAttribute('height'));
      [art, ...art.querySelectorAll('img')].forEach(img => {
        img.loading = 'eager';
        const big = img.dataset && img.dataset.big;
        if (!big) return;
        const pre = new Image();
        pre.src = big;
        pre.decode().then(() => { img.src = big; }, () => {});
      });
      stage.replaceChildren(art);
      // No jump behind the backdrop: fill the scrollbar's place while it's hidden, and keep the poster popped.
      document.documentElement.style.setProperty('--sbw', (innerWidth - document.documentElement.clientWidth) + 'px');
      openBtn = btn;
      btn.classList.add('is-open');
      viewer.showModal();
      if (!reduceMotion) art.classList.add('is-playing');
    }));
    viewer.addEventListener('click', () => viewer.close());
    viewer.addEventListener('close', () => {
      stage.replaceChildren();
      document.documentElement.style.removeProperty('--sbw');
      if (openBtn) openBtn.classList.remove('is-open');
      openBtn = null;
    });
  }

  // ---------- Ask for access (Retouch) and Contact me (About) ----------
  // The button opens the ways to write (Gmail, Outlook, the email app, or copying the address); a plain email link did
  // nothing on computers with no email app set up.
  document.querySelectorAll('.ask[aria-controls]').forEach(ask => {
    const ways = document.getElementById(ask.getAttribute('aria-controls'));
    if (!ways) return;
    const msg = ways.querySelector('.ways-msg');
    ask.addEventListener('click', () => { ways.hidden = !ways.hidden; ask.setAttribute('aria-expanded', String(!ways.hidden)); });
    ways.querySelector('[data-copy]')?.addEventListener('click', async ev => {
      const to = ev.currentTarget.dataset.copy;
      try { await navigator.clipboard.writeText(to); if (msg) msg.textContent = 'Copied: ' + to + '. Paste it into a new email.'; }
      catch (err) { if (msg) msg.textContent = 'Write to ' + to + '.'; }
    });
  });

  // ---------- blend at phone size (Kris, 25 Nov: "the mobile version is where it shines") ----------
  // On a laptop (a mouse and a wide screen) Open the live app shows the live app running at phone size in a phone
  // frame, with a link to the laptop layout. Phones, and Ctrl/⌘/Shift-clicks, open the app as a link. The app inside
  // is 430 × 932 (its design size), scaled to fit the frame.
  const pv = document.querySelector('.pv'), blendLink = document.querySelector('#blend .p-body > .p-link');
  if (pv && blendLink) {
    const frame = pv.querySelector('.pv-frame'), screen = pv.querySelector('.pv-screen');
    const laptop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
    const fit = () => { frame.style.transform = `scale(${screen.clientHeight / 932})`; };  // the 932-point screen's scale; the app is 430 x 839 of it
    // No scrollbar strip down the screen's right edge: blend hides its scrollbars (and the room kept for one) when it
    // runs inside another page (its html.is-embedded, 25 Nov). Measuring this page's scrollbar to make the app wider
    // didn't work: in Kris's Chrome it measured 0 while blend still kept the room.
    blendLink.addEventListener('click', e => {
      if (!laptop.matches || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (!frame.getAttribute('src')) frame.src = blendLink.href;
      document.documentElement.style.setProperty('--sbw', (innerWidth - document.documentElement.clientWidth) + 'px');
      pv.showModal();
      fit();
    });
    addEventListener('resize', () => { if (pv.open) fit(); });
    // A click outside the phone and the text, or on ×, closes it; Esc too (the dialog's own).
    pv.addEventListener('click', e => { if (e.target.closest('.pv-x') || !e.target.closest('.pv-phone, .pv-side')) pv.close(); });
    pv.addEventListener('close', () => {
      document.documentElement.style.removeProperty('--sbw');
      blendLink.focus({ preventScroll: true });
    });
  }

  // ---------- Click to enlarge: a piece grows in place (straightened, kept inside its collage) so it's readable ----------
  // Click it again, click anywhere else, press Esc or scroll on to put it back. Posters keep their own big view.
  // A picture whose project is leaving stays open until that project is out of sight (settleBig, above).
  function shrink() {
    if (!bigPiece || bigPiece.closest('.is-leaving')) return;
    const sec = bigPiece.closest('.project') || document;
    bigPiece.classList.remove('is-big');
    ['--tx', '--ty', '--s'].forEach(v => bigPiece.style.removeProperty(v));
    bigPiece.setAttribute('aria-expanded', 'false');
    bigPiece = null;
    sec.querySelectorAll('.step.is-lit').forEach(x => x.classList.remove('is-lit'));
  }
  // Test layout on laptops (Kris, 19 Nov, "fullscreen" with the text on the side): the piece grows to fill the whole
  // picture area (right of the column, top of the screen to the bar), centred, and the others dim. The column scrolls
  // to that piece's paragraph and lights it. Layers with data-big (posters) switch to their sharper copies. Logos stop
  // at about half the area.
  function sharpen(p) {
    p.querySelectorAll('img[data-big]').forEach(img => {
      if (img.src.endsWith(img.dataset.big)) return;
      const pre = new Image();
      pre.src = img.dataset.big;
      pre.decode().then(() => { img.src = img.dataset.big; }, () => {});
    });
  }
  function enlarge(p) {
    const col = p.closest('.collage');
    if (!col) return;
    const cw = col.clientWidth, ch = col.clientHeight, w = p.offsetWidth, h = p.offsetHeight;
    let s, tx, ty;
    if (isApp()) {
      const sec = p.closest('.project'), sr = sec.getBoundingClientRect(), cr = col.getBoundingClientRect(), cs = getComputedStyle(sec);
      const L = sr.left + padX + colW + colGap, R = sr.right - padX;
      const T = sr.top + parseFloat(cs.paddingTop), B = sr.bottom - parseFloat(cs.paddingBottom);
      const fill = p.classList.contains('cutout') ? .5 : .96;
      s = Math.min(fill * (R - L) / w, fill * (B - T) / h, 5);
      if (s < 1.05) return;
      tx = (L + R) / 2 - (cr.left + p.offsetLeft + w / 2);
      ty = (T + B) / 2 - (cr.top + p.offsetTop + h / 2);
      sharpen(p);
      // Its paragraph: lit, and scrolled into view if it isn't (the only time the list moves by itself).
      const box = sec.querySelector('.steps'), st = box && box.querySelectorAll('.step')[Number(p.dataset.step)];
      if (st) {
        box.querySelectorAll('.step').forEach(x => x.classList.toggle('is-lit', x === st));
        const seen = st.offsetTop >= box.scrollTop && st.offsetTop + Math.min(st.offsetHeight, box.clientHeight - 40) <= box.scrollTop + box.clientHeight;
        if (!seen) box.scrollTo({ top: st.offsetTop - 4, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    } else {
      s = Math.min((cw < 600 ? 0.92 : 0.62) * cw / w, 0.94 * ch / h, 3);
      if (s < 1.15) return; // already about as big as it can be
      // Grow around its own centre, nudged inwards so it stays inside the collage.
      const cx = p.offsetLeft + w / 2, cy = p.offsetTop + h / 2, hw = w * s / 2, hh = h * s / 2, m = 6;
      tx = Math.min(Math.max(cx, hw + m), cw - hw - m) - cx;
      ty = Math.min(Math.max(cy, hh + m), ch - hh - m) - cy;
    }
    p.style.setProperty('--tx', tx.toFixed(1) + 'px');
    p.style.setProperty('--ty', ty.toFixed(1) + 'px');
    p.style.setProperty('--s', s.toFixed(3));
    p.classList.add('is-big');
    p.setAttribute('aria-expanded', 'true');
    bigPiece = p; bigAt = scrollY;
  }
  document.addEventListener('click', e => {
    // Phones: posters open their big view instead. Laptops (test layout): posters grow in the picture area too.
    const p = e.target.closest(isApp() ? '.project[data-story] .piece[data-step]' : '.project[data-story] .piece[data-step]:not(.poster-btn)');
    if (p) { const was = p === bigPiece; shrink(); if (!was) enlarge(p); return; }
    shrink();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') shrink(); });
  addEventListener('scroll', () => { if (bigPiece && Math.abs(scrollY - bigAt) > 120) shrink(); }, { passive: true });
  addEventListener('resize', shrink);

  // ---------- Retouch: phones have no hover, so the original shows while a finger rests on a photo ----------
  // A quick tap still enlarges it; a hold (over 200 ms) shows the original until the finger lifts, and the tap that
  // ends a hold doesn't enlarge. Long-press menus are off on these photos (next.css), so the hold isn't interrupted.
  document.querySelectorAll('.project .piece.rt').forEach(p => {
    let timer = 0, held = false;
    const off = () => { clearTimeout(timer); p.classList.remove('is-before'); };
    p.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      held = false;
      timer = setTimeout(() => { held = true; p.classList.add('is-before'); }, 200);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => p.addEventListener(n, off));
    p.addEventListener('click', e => { if (held) { held = false; e.stopPropagation(); } }, true);
    p.addEventListener('contextmenu', e => e.preventDefault());
  });

  // ---------- Retouch: locked (Kris, 22 Nov: "lock the retouch behind a password ... only i be able to show it") ----------
  // Client work, so the site only holds the photos encrypted (img/retouch-locked, made by lock-retouch.mjs in
  // portfolio-site-work). The password (PBKDF2-SHA256, the salt and rounds in manifest.json) or the key in Kris's unlock
  // link opens them here in the browser: each file is a 12-byte IV and its AES-GCM ciphertext. The key is kept for this
  // tab only (sessionStorage), so a reload stays open. Page-size photos first, then the full-size ones for the enlarged
  // view. Needs a secure page (https or localhost) for Web Crypto.
  const rtSec = document.getElementById('retouch');
  if (rtSec && rtSec.querySelector('img[data-lock]')) {
    const form = rtSec.querySelector('.rt-lock'), msg = rtSec.querySelector('.rt-lock-msg'), col = rtSec.querySelector('.collage');
    const dir = 'img/retouch-locked/', subtle = window.crypto && crypto.subtle;
    const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const open = (key, buf) => subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('is-bad', !!bad); };
    let manifest = null;
    const getManifest = () => manifest || (manifest = fetch(dir + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null));
    col.inert = true;
    async function unlock(key) {
      const m = await getManifest();
      if (!m) throw new Error('missing');
      if (new TextDecoder().decode(await open(key, unb64(m.check))) !== 'retouch-ok') throw new Error('bad');
      const imgs = [...document.querySelectorAll('img[data-lock]')], names = [...new Set(imgs.map(i => i.dataset.lock))];
      const file = async name => URL.createObjectURL(new Blob([await open(key, await (await fetch(dir + name + '.bin')).arrayBuffer())], { type: 'image/webp' }));
      const urls = await Promise.all(names.map(file));
      names.forEach((name, k) => imgs.filter(i => i.dataset.lock === name).forEach(i => { i.src = urls[k]; }));
      try { sessionStorage.setItem('rt-key', b64(await subtle.exportKey('raw', key))); } catch (e) {}
      rtSec.classList.remove('is-locked');
      col.inert = false;
      rtSec.dispatchEvent(new Event('rt-unlocked'));
      // The full-size copies, in the background, for the enlarged view (sharpen() swaps them in).
      for (const name of names) {
        try { const u = await file('big/' + name); imgs.filter(i => i.dataset.lock === name).forEach(i => { i.dataset.big = u; }); } catch (e) {}
      }
    }
    const fromRaw = s => subtle.importKey('raw', unb64(s), 'AES-GCM', true, ['decrypt']);
    async function fromPassword(pw) {
      const m = await getManifest();
      if (!m) throw new Error('missing');
      const base = await subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
      return subtle.deriveKey({ name: 'PBKDF2', salt: unb64(m.salt), iterations: m.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!subtle) { say('This page needs a secure address (https) to unlock.', true); return; }
      const pw = form.password.value;
      if (!pw) return;
      say('Unlocking…');
      try { await unlock(await fromPassword(pw)); form.reset(); say(''); }
      catch (err) { say(err.message === 'missing' ? 'Retouch isn’t set up on this copy of the site yet.' : 'That password didn’t work.', true); }
    });
    // The unlock link, or a key this tab already used.
    let saved = '';
    try { saved = sessionStorage.getItem('rt-key') || ''; } catch (e) {}
    const k0 = rtLinkKey || saved;
    if (k0 && subtle) {
      fromRaw(k0).then(unlock).then(() => { if (rtLinkKey && !isApp()) rtSec.scrollIntoView({ block: 'start' }); }, () => {
        try { sessionStorage.removeItem('rt-key'); } catch (e) {}
        if (rtLinkKey) say('This link no longer works. Ask me for a new one.', true);
      });
    }
  }

  // ---------- Retouch: the reveal (Kris, 22 Nov: "keep the hover and add reveal") ----------
  // Most visitors never point at a photo, so the change also plays by itself, in the right direction: a photo starts as
  // the original and dissolves into the retouched one (1.2 s), once. Laptops: every photo, one after another, each time
  // Retouch is shown. Phones: the photos of the dot that comes up, while Retouch is on screen; the one dissolving pops.
  // Hover and the finger hold still work as before. Off with reduced motion: the retouched photos just stay.
  if (rtSec && !reduceMotion) {
    const locked = () => rtSec.classList.contains('is-locked');
    const rtPieces = [...rtSec.querySelectorAll('.collage .piece.rt')];
    let gen = 0, rtStep = 0, rtSeen = false;
    const stop = () => { gen++; rtPieces.forEach(p => p.classList.remove('rt-orig', 'rt-fade')); };
    const ready = ps => Promise.race([Promise.all(ps.flatMap(p => [...p.querySelectorAll('img')]).map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 2500))]);
    function reveal(ps, { wait = 600, gap = 300, pop = false } = {}) {
      stop();
      const g = gen;
      ps.forEach(p => p.classList.add('rt-orig'));
      ready(ps).then(() => ps.forEach((p, k) => setTimeout(() => {
        if (g !== gen) return;
        if (pop) ps.forEach(q => q.classList.toggle('is-on', q === p));
        p.classList.add('rt-fade');
        p.classList.remove('rt-orig');
        setTimeout(() => { if (g === gen) p.classList.remove('rt-fade'); }, 1300);
      }, wait + k * gap)));
    }
    const ofStep = i => rtPieces.filter(p => Number(p.dataset.step) === i);
    // Laptops: when Retouch comes on screen.
    let shown = false;
    const onShown = () => {
      const now = rtSec.classList.contains('is-shown');
      if (now && !shown && isApp() && !locked()) reveal([...rtPieces].sort((a, b) => a.dataset.step - b.dataset.step), { wait: 700, gap: 300 });
      if (!now && shown) stop();
      shown = now;
    };
    new MutationObserver(onShown).observe(rtSec, { attributes: true, attributeFilter: ['class'] });
    onShown();
    // Phones: the dot that comes up (the tour or a tap), and the current one when Retouch scrolls into view.
    rtSec.addEventListener('story', e => {
      if (e.detail.i === rtStep) return;
      rtStep = e.detail.i;
      if (!isApp() && rtSeen && !locked()) reveal(ofStep(rtStep), { wait: 500, gap: 900, pop: true });
    });
    new IntersectionObserver(es => {
      const now = es[0].intersectionRatio >= 0.4;
      if (now && !rtSeen && !isApp() && !locked()) reveal(ofStep(rtStep), { wait: 500, gap: 900, pop: true });
      if (!now && rtSeen && !isApp()) stop();
      rtSeen = now;
    }, { threshold: [0, 0.4] }).observe(rtSec);
    // Just unlocked: the reveal plays where Retouch is on screen.
    rtSec.addEventListener('rt-unlocked', () => {
      if (isApp() ? rtSec.classList.contains('is-shown') : rtSeen) {
        if (isApp()) reveal([...rtPieces].sort((a, b) => a.dataset.step - b.dataset.step), { wait: 400, gap: 300 });
        else reveal(ofStep(rtStep), { wait: 400, gap: 900, pop: true });
      }
    });
  }

  // ---------- Laptops: a soft fade at the bottom of a list that goes on below, and at the top once it's scrolled (test layout 2) ----------
  document.querySelectorAll('.p-body .steps').forEach(st => {
    const f = () => { st.classList.toggle('is-more', isApp() && st.scrollHeight - st.scrollTop - st.clientHeight > 4); st.classList.toggle('is-up', isApp() && st.scrollTop > 4); };
    st.addEventListener('scroll', f, { passive: true });
    new ResizeObserver(f).observe(st);
  });

  // ---------- About on laptops: a small map of every project (Kris, 19 Nov) ----------
  // Where the pictures go, a tile per project in its group: a shrunken, still copy of that project's own pictures (so it
  // stays right when a picture changes, in light and dark), and its name. A click goes to the project.
  const map = el('nav', 'map');
  map.setAttribute('aria-label', 'All projects');
  let mapGroup = null;
  [...list.children].forEach(sec => {
    if (sec.hidden) return;
    if (sec.dataset.group !== mapGroup) { mapGroup = sec.dataset.group; map.append(el('p', 'map-k', mapGroup)); }
    const a = el('a', 'map-tile'), pic = el('span', 'map-pic'), mini = el('span', 'map-mini');
    a.href = '#' + sec.id;
    a.dataset.id = sec.id;
    const col = sec.querySelector('.collage');
    if (col) {
      // Copied through a template: a cloneNode copy starts downloading its pictures at once, lazy or not (20 Nov:
      // that was every picture of every project on every load); these wait until About is shown.
      const tpl = document.createElement('template');
      tpl.innerHTML = col.outerHTML;
      const c = tpl.content.firstElementChild;
      c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      c.querySelectorAll('canvas').forEach(x => x.remove());  // Silver Bliss: the still logo shows instead of the live one
      c.querySelectorAll('.is-on,.is-lit,.is-big,.is-open,.is-playing,.is-live').forEach(x => x.classList.remove('is-on', 'is-lit', 'is-big', 'is-open', 'is-playing', 'is-live'));
      mini.append(c);
    }
    mini.inert = true;
    mini.setAttribute('aria-hidden', 'true');
    pic.append(mini);
    a.append(pic, el('span', 'map-name', sec.querySelector('.p-title').textContent));
    map.append(a);
  });
  about.append(map);
  map.addEventListener('click', e => {
    const a = e.target.closest('.map-tile');
    if (!a) return;
    e.preventDefault();
    go(a.dataset.id, true);
  });
  // The copies are drawn at 1000 x 500 and scaled down to the tile.
  new ResizeObserver(() => {
    const t = map.querySelector('.map-pic');
    if (t && t.clientWidth) map.style.setProperty('--k', (t.clientWidth / 1000).toFixed(4));
  }).observe(map);

  // ---------- Laptops: the pictures in tidy rows (Kris, 19 Nov) ----------
  // Instead of lying about like photos on a table (overlapping, tilted), a project's pictures sit in rows, in the order
  // of their paragraphs: no overlap, no tilt, the same gap everywhere. The rows are all as wide as each other and the
  // pictures in a row share one height. Of every way to split them into rows, the one with the biggest pictures wins,
  // rows of even height preferred. The block is as big as the room right of the column allows, above the project's
  // button, at the top; next.css sizes the box from --tb-w/--tb-h and places each picture from --gx/--gy/--gw (the
  // About map's copies: --mx/--my/--mw). ?scatter in the address (or the tune panel) puts the photos on the table back.
  if (new URLSearchParams(location.search).has('scatter')) root.classList.add('scatter');
  function pack(rs, W, H, gap, maxH = H) {
    const n = rs.length;
    let best = null;
    for (let cut = 0; cut < 1 << (n - 1); cut++) {
      const rows = [[0]];
      for (let i = 1; i < n; i++) { if (cut & 1 << (i - 1)) rows.push([]); rows[rows.length - 1].push(i); }
      // At a block width w, a row is (w - its gaps) / (its pictures' width-to-height ratios added up) tall.
      const sums = rows.map(r => r.reduce((t, i) => t + rs[i], 0));
      let a = 0, b = (rows.length - 1) * gap;
      rows.forEach((r, k) => { a += 1 / sums[k]; b -= (r.length - 1) * gap / sums[k]; });
      // As wide as the room allows, as long as the block fits the height and no row is taller than maxH.
      const w = Math.min(W, (H - b) / a, ...rows.map((r, k) => maxH * sums[k] + (r.length - 1) * gap)), hs = rows.map((r, k) => (w - (r.length - 1) * gap) / sums[k]);
      if (hs.some(h => h <= 0)) continue;
      const score = hs.reduce((t, h, k) => t + sums[k] * h * h, 0) * Math.min(...hs) / Math.max(...hs);
      if (!best || score > best.score) best = { score, w, rows, hs };
    }
    if (!best) return null;
    const rects = [];
    let y = 0;
    best.rows.forEach((r, k) => {
      const h = best.hs[k];
      let x = 0;
      r.forEach(i => { rects[i] = { x, y, w: rs[i] * h }; x += rs[i] * h + gap; });
      y += h + gap;
    });
    return { w: best.w, h: y - gap, rects };
  }
  const pct = v => (v * 100).toFixed(3) + '%';
  function tidy() {
    const shown = targets().find(s => s.classList.contains('is-shown'));
    if (!isApp() || !shown) return;
    const cs = getComputedStyle(shown), gap = Math.round(Math.min(24, Math.max(12, innerWidth * .012)));
    const W = shown.clientWidth - 2 * padX - colW - colGap, H = shown.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    targets().forEach(sec => {
      const col = sec.classList.contains('project') && sec.querySelector('.collage');
      const ps = col ? [...col.children].filter(p => p.classList.contains('piece')) : [];
      if (!ps.length) return;
      // Each picture's shape, measured as it's laid out (hidden projects are laid out unseen for a moment).
      const off = !sec.classList.contains('is-shown') && !sec.classList.contains('is-leaving');
      if (off) sec.classList.add('is-measure');
      const rs = ps.map(p => p.offsetWidth / p.offsetHeight);
      if (off) sec.classList.remove('is-measure');
      if (rs.some(r => !(r > 0 && isFinite(r)))) return;
      const order = ps.map((p, i) => i).sort((i, j) => (+ps[i].dataset.step || 0) - (+ps[j].dataset.step || 0) || i - j);
      // data-tidy: a close-up that stays smaller than its row, at the row's top (blend's notch, half as tall as the screens).
      const ks = order.map(i => rs[i] * (+ps[i].dataset.tidy || 1));
      // Every project keeps the button's room under its pictures (20px and the 49px button), with a button or not, and
      // no row is taller than CFG.picMax of what's left (Kris, 20 Nov: the animated posters were too big, and one grew
      // over the bar when pointed at).
      const room = 20 + Math.ceil(44 * 1.11);
      // A piece's place in % of the box. Logos are cut-outs with no card around them, so each one is drawn a little
      // smaller in the middle of its place, or they'd touch.
      const put = (s, r, i, bw, bh, ox, oy, names) => {
        const c = ps[i].classList.contains('cutout') ? .8 : 1, h = r.w / rs[i];
        s.setProperty(names[0], pct((ox + r.x + r.w * (1 - c) / 2) / bw));
        s.setProperty(names[1], pct((oy + r.y + h * (1 - c) / 2) / bh));
        s.setProperty(names[2], pct(r.w * c / bw));
      };
      const L = pack(ks, W, H - room, gap, CFG.picMax * (H - room));
      if (!L) return;
      sec.style.setProperty('--tb-w', L.w.toFixed(1) + 'px');
      sec.style.setProperty('--tb-h', L.h.toFixed(1) + 'px');
      // Pictures and button sit in the middle of the height, so the room they don't need is shared above and below
      // instead of collecting under the button (Kris, 20 Nov: empty space at the bottom of blend, TravelPulse,
      // Silver Bliss and the animated posters).
      // A project without a button centres its pictures alone (the button's room still keeps their size the same).
      const used = L.h + (sec.querySelector('.p-body > .p-link, .p-body > .sb-cam') ? room : 0);
      sec.style.setProperty('--tb-y', Math.max(0, Math.floor((H - used) / 2)) + 'px');
      order.forEach((i, k) => put(ps[i].style, L.rects[k], i, L.w, L.h, 0, 0, ['--gx', '--gy', '--gw']));
      // The About map's copy of these pictures: the same rows in its 1000 x 500 tile, centred.
      const mini = document.querySelector(`.map-tile[data-id="${sec.id}"] .map-mini .collage`);
      if (!mini) return;
      const mp = [...mini.children].filter(p => p.classList.contains('piece')), M = pack(ks, 940, 440, 24, CFG.picMax * 440);
      if (!M || mp.length !== ps.length) return;
      order.forEach((i, k) => put(mp[i].style, M.rects[k], i, 1000, 500, (1000 - M.w) / 2, (500 - M.h) / 2, ['--mx', '--my', '--mw']));
    });
  }
  // Phones and narrow windows: the same tidy rows (Kris, 25 Nov: "are we going to leave the frames scattered around like
  // before or rearange them like in the web version", then chose the rows). They fill the box's width, and the box is
  // as tall as the rows (no longer 5:4); no row is taller than 90% of the width, so one tall screenshot can't fill a
  // screen. Same order (the dots'), close-ups (data-tidy) and cut-outs as on laptops. Placed with --px/--py/--pw.
  // Each picture's shape is worked out once (Kris, 25 Nov, with a video: "on phone the frames are vibrating"). It used
  // to be measured on every run, from the last run's layout rounded to whole pixels, so every run came out a hair
  // different; that moved the pictures and changed the page's height, which ran it again, and it never settled (the
  // iPhone's toolbar showing and hiding while scrolling set it off too). Now: the picture's own width and height
  // when its frame has that shape (all but the layered animated poster), otherwise the frame, measured once.
  const shapes = new WeakMap();
  function shapeOf(p) {
    if (shapes.has(p)) return shapes.get(p);
    const box = p.offsetWidth / p.offsetHeight;
    if (!(box > 0 && isFinite(box))) return NaN;
    const m = p.querySelector('img, video'), aw = m ? +m.getAttribute('width') : 0, ah = m ? +m.getAttribute('height') : 0;
    const s = aw > 0 && ah > 0 && Math.abs(aw / ah - box) / box < .01 ? aw / ah : box;
    shapes.set(p, s);
    return s;
  }
  function tidyPhone() {
    const cols = [...main.querySelectorAll('.project .collage')];
    if (isApp() || root.classList.contains('scatter')) { cols.forEach(c => c.classList.remove('is-tidy')); return; }
    const gap = 10;
    cols.forEach(col => {
      const ps = [...col.children].filter(p => p.classList.contains('piece')), W = col.clientWidth;
      if (!ps.length || !W) return;
      const rs = ps.map(shapeOf);
      if (rs.some(r => !(r > 0 && isFinite(r)))) return;
      const order = ps.map((p, i) => i).sort((i, j) => (+ps[i].dataset.step || 0) - (+ps[j].dataset.step || 0) || i - j);
      const L = pack(order.map(i => rs[i] * (+ps[i].dataset.tidy || 1)), W, W * 1.6, gap, W * .9);
      if (!L) return;
      const ox = (W - L.w) / 2;
      order.forEach((i, k) => {
        const r = L.rects[k], c = ps[i].classList.contains('cutout') ? .8 : 1, h = r.w / rs[i], s = ps[i].style;
        s.setProperty('--px', pct((ox + r.x + r.w * (1 - c) / 2) / W));
        s.setProperty('--py', pct((r.y + h * (1 - c) / 2) / L.h));
        s.setProperty('--pw', pct(r.w * c / W));
      });
      col.style.setProperty('--ph', L.h.toFixed(1) + 'px');
      col.classList.add('is-tidy');
    });
  }
  new ResizeObserver(() => { tidy(); tidyPhone(); }).observe(main);
  tidy();
  tidyPhone();

  // ---------- Laptops: scrolling over the pictures or the bar steps through the projects (Kris, 19 Nov) ----------
  // The bar reads as the page from top to bottom: About is at the top, so scrolling down goes About, blend, TravelPulse
  // and on to Retouch, and scrolling up goes back (no wrapping round at either end). Down sends the pictures up, as on a
  // page. One flick moves one project: once it has moved, the wheel must rest (CFG.wheelRest) before the next, since a
  // trackpad keeps gliding for a while after the fingers lift. The column still scrolls its own text, and a sideways
  // swipe still scrolls the bar on a narrow window.
  let wheelSum = 0, wheelHeld = false, wheelTimer = 0;
  main.addEventListener('wheel', e => {
    if (!isApp() || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (e.target.closest('.p-body, .end .in')) return;
    e.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelHeld = false; wheelSum = 0; }, CFG.wheelRest);
    if (wheelHeld) return;
    wheelSum += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);  // lines or pages, in pixels
    if (Math.abs(wheelSum) < CFG.wheelStep) return;
    const c = cards[barIndex(current) + Math.sign(wheelSum)];
    wheelHeld = true;
    wheelSum = 0;
    if (c) go(c.dataset.id, true);  // an open picture leaves as it is
  }, { passive: false });

  // ---------- Loading (Kris, 20 Nov: empty frames for a moment after a refresh) ----------
  // Laptops: the open project's pictures load first, then every other project's in the background, so a switch finds
  // them ready. (Before, the About map's copies started every picture of every project at once, about 2.5 MB, and the
  // open project's waited in the queue with the rest.) The map's copies still wait until About is shown.
  // (modern-web-guidance, 20 Nov: high priority only for the one or two biggest pictures, as more dilutes it; the
  // background ones low, as they only show after a switch.) The looping videos are loading="lazy" in next.html, so
  // the hidden projects' don't download at once where browsers support it; the open project's load now.
  if (isApp()) {
    const imgs = [...main.querySelectorAll('img')].filter(i => !i.closest('.map-mini')), first = imgs.filter(i => i.closest('.is-shown'));
    first.forEach(i => { i.loading = 'eager'; });
    const area = i => { const r = i.getBoundingClientRect(); return r.width * r.height; };
    first.toSorted((a, b) => area(b) - area(a)).slice(0, 2).forEach(i => { i.fetchPriority = 'high'; });
    main.querySelectorAll('.is-shown video[loading]').forEach(v => v.removeAttribute('loading'));
    const arrived = i => i.complete || new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); });
    Promise.race([Promise.all(first.map(arrived)), new Promise(r => setTimeout(r, 4000))])
      .then(() => imgs.forEach(i => { if (i.loading === 'lazy') { i.fetchPriority = 'low'; i.loading = 'eager'; } }));
  }
  // A frame whose picture hasn't come yet shows a soft tint, and the picture fades in when it arrives (next.css).
  // After the map is built, so its copies get it too. Animated posters are many layers: they're left as they are.
  main.querySelectorAll('.piece > img, .piece > picture > img').forEach(img => {
    const p = img.closest('.piece');
    if (img.complete) return;
    p.classList.add('is-wait');
    const done = () => p.classList.remove('is-wait');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
  // The bar takes its first sizes without growing into them (it grew from 100px wide on every load): no card
  // transitions until the fonts are in (they change the open card's width) and two frames have shown, at most 1.5s.
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))])
    .then(() => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-loading'))));

  // ---------- 3A + 4B + 5C: pieces, dots and the self-playing tour ----------
  function setupStory(sec) {
    const dots = [...sec.querySelectorAll('.dot')];
    const steps = [...sec.querySelectorAll('.step')];
    const pieces = [...sec.querySelectorAll('.piece[data-step]')];
    const body = sec.querySelector('.p-body');
    const n = steps.length;
    // data-solo (Retouch, Kris 22 Nov): a dot with several photos doesn't grow them together. Pointing at one grows only
    // that one; on phones the tour pops the first, and the reveal (further down) moves on from photo to photo.
    const solo = sec.hasAttribute('data-solo');
    const firstOf = i => pieces.find(q => Number(q.dataset.step) === i);

    // 4B: longer texts stay longer. About 300 ms per word plus 2 s to look at the picture, 5–16 s. Only the words on
    // show count: the label and the short line, not the text behind "Why?" (25 Nov).
    const dwell = steps.map(s => {
      const words = [...s.children].filter(c => c.tagName !== 'DETAILS').map(c => c.textContent).join(' ').trim().split(/\s+/).length;
      return Math.min(16000, Math.max(5000, 2000 + words * 300));
    });

    let cur = 0, auto = !reduceMotion, inView = false, reading = false;
    let elapsed = 0, last = 0, raf = 0;

    // Tells the laptops' shared row of dots (sdots) which step is on, how far the tour is, and whether it still plays.
    const tell = p => sec.dispatchEvent(new CustomEvent('story', { bubbles: true, detail: { i: cur, p, auto } }));

    function setProgress(f) { dots[cur].style.setProperty('--p', (f * 100).toFixed(1) + '%'); tell(f); }

    function show(i) {
      if (dots[cur]) dots[cur].style.removeProperty('--p');
      cur = i;
      const listed = isApp();  // test layout 2, laptops: every step is listed and read out; no picture pops at rest
      dots.forEach((d, k) => d.setAttribute('aria-pressed', String(k === i)));
      steps.forEach((s, k) => {
        s.classList.toggle('is-on', k === i);
        if (listed) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', String(k !== i));
      });
      pieces.forEach(p => p.classList.toggle('is-on', !listed && Number(p.dataset.step) === i && (!solo || p === firstOf(i))));
      elapsed = 0;
      tell(0);
    }

    // Laptops (test layout 2): pointing at a paragraph pops its pictures; pointing at a picture lights its paragraph, but
    // only if that paragraph is in view (the list never jumps to it; a click does, see enlarge). Nothing while a picture
    // is big.
    const box = sec.querySelector('.steps');
    function light(i, onlyIfSeen, only) {
      let text = i >= 0 && !!steps[i];
      if (text && onlyIfSeen && box) {
        const r = steps[i].getBoundingClientRect(), b = box.getBoundingClientRect();
        text = r.top >= b.top - 4 && r.top < b.bottom - 40;
      }
      steps.forEach((s, k) => s.classList.toggle('is-lit', text && k === i));
      pieces.forEach(p => p.classList.toggle('is-lit', i >= 0 && (solo && only ? p === only : Number(p.dataset.step) === i)));
    }
    steps.forEach((s, k) => {
      s.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && isApp() && !bigPiece) light(k); });
      s.addEventListener('pointerleave', () => { if (isApp() && !bigPiece) light(-1); });
    });
    document.addEventListener('portfolio:mode', () => { light(-1); show(cur); });

    // Opening "Why?" stops the tour, so the step being read stays on (25 Nov).
    steps.forEach((s, k) => s.querySelector('.s-why')?.addEventListener('toggle', e => { if (e.target.open && (auto || k !== cur)) takeOver(k); }));

    // The visitor touched something: the tour stops for good.
    function takeOver(i) {
      if (auto) {
        auto = false;
        cancelAnimationFrame(raf);
        sec.classList.remove('is-auto');
      }
      if (i !== cur) show(i); else tell(0);
    }

    function tick(t) {
      raf = requestAnimationFrame(tick);
      // Cap at 1 s so a slow or throttled screen still keeps time, without jumping after a long pause.
      const dt = last ? Math.min(t - last, 1000) : 0;
      last = t;
      // Pauses (doesn't stop) while off screen, while the tab is hidden, or while the mouse rests on the text.
      // Test layout 2: no tour on laptops (every step is listed).
      if (isApp() || !inView || reading || document.hidden) return;
      elapsed += dt;
      const f = elapsed / dwell[cur];
      if (f >= 1) show((cur + 1) % n);
      else setProgress(f);
    }

    pieces.forEach(p => {
      const i = Number(p.dataset.step);
      p.addEventListener('click', () => takeOver(i));
      p.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || isApp() || performance.now() - lastScroll < 250) return;
        if (auto || i !== cur) takeOver(i);
      });
      p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && isApp() && !bigPiece) light(i, true, p); });
      p.addEventListener('pointerleave', () => { if (isApp() && !bigPiece) light(-1); });
    });
    dots.forEach((d, k) => d.addEventListener('click', () => takeOver(k)));

    body.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') reading = true; });
    body.addEventListener('pointerleave', () => { reading = false; });

    new IntersectionObserver(entries => {
      inView = entries[0].intersectionRatio >= 0.4;
      last = 0;
    }, { threshold: [0, 0.4] }).observe(sec);
    document.addEventListener('visibilitychange', () => { last = 0; });

    show(0);
    if (auto) {
      sec.classList.add('is-auto');
      raf = requestAnimationFrame(tick);
    }
  }
})();
