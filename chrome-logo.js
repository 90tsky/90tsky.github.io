// Silver Bliss: the logo as live chrome. The method from the reel (reflections taken straight from the webcam),
// done in 2D for a flat logo. Two pictures: img/silverbliss-logo.webp (the logo itself: its shading and its edges)
// and img/silverbliss-normal.webp (a normal map: which way each point of the bevel faces, smoothed so reflections
// glide instead of crinkling). Every pixel reflects either a soft studio light or, after a click, the visitor's camera.
// The camera only starts on the button, stays on this device, and stops when the section leaves the screen.
(() => {
  const piece = document.querySelector('.sb-chrome');
  if (!piece) return;
  const canvas = piece.querySelector('canvas');
  const logoImg = piece.querySelector('img');
  const camBtn = document.querySelector('.sb-cam');
  const camNote = document.querySelector('.sb-cam-note');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NORMALS = 'img/silverbliss-normal.webp';
  const ASPECT = 1164 / 987; // the logo picture's width / height

  const opts = { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
  const hide = () => { if (camBtn) camBtn.hidden = true; };
  if (!gl) { hide(); return; }
  // WebGL 2 can smooth any picture when it's drawn smaller (mipmaps); WebGL 1 only for power-of-two sizes.
  const canMip = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  const VS = `attribute vec2 p; varying vec2 vUv;
    void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uLogo, uNorm, uCam;
    uniform vec2 uTilt;
    uniform float uTime, uCamMix, uCamAspect, uSmooth;

    vec2 mirrored(vec2 q){ return 1. - abs(1. - mod(q, 2.)); }

    // Soft studio: bright above, dark floor, two light bars, a softbox to the right. e = reflection direction (y down).
    float studio(vec2 e){
      float t = uTime;
      float y = e.y + .06 * sin(t * .35);
      float x = e.x + .22 * sin(t * .23);
      float sky = smoothstep(.35, -.45, y);
      float c = mix(.05 + .07 * smoothstep(.2, 1.4, y), .5 + .32 * sky, sky);
      // Light bars and softbox: 6% softer and 11% fainter than first built (Kris, 13 Nov), so they don't cut sharp lines.
      c += .846 * exp(-pow((y + .62) / .0954, 2.));
      c += .49 * exp(-pow((y - .12) / .0477, 2.));
      c += .40 * exp(-pow((x - .55) / .127, 2.)) * smoothstep(.7, -.6, y);
      // Two vertical strip lights, left and right (Kris, 13 Nov): the bars catch the mouse moving up and down,
      // these catch it moving left and right, so the stems flash along their sides.
      c += (.5 * exp(-pow((x + .45) / .1, 2.)) + .4 * exp(-pow((x - .3) / .085, 2.))) * smoothstep(.55, .05, y);
      return c;
    }
    vec3 cam(vec2 e){
      vec2 q = mirrored(.5 + vec2(-e.x / uCamAspect, e.y) * .6);  // mirrored, like looking into it
      vec2 o = vec2(1.5 / 320., 1.5 / 240.);              // a soft 5-tap blur: no webcam grain on the edges
      vec3 c = (texture2D(uCam, q) * 2. + texture2D(uCam, q + o) + texture2D(uCam, q - o)
              + texture2D(uCam, q + vec2(o.x, -o.y)) + texture2D(uCam, q - vec2(o.x, -o.y))).rgb / 6.;
      float l = dot(c, vec3(.299, .587, .114));
      vec3 g = (c - .5) * 1.3 + .5 - .03;                 // a bit more contrast
      return mix(vec3((l - .5) * 1.3 + .5 - .03), g, .69); // the room's colour, still silvery (60% + 15% more saturation, Kris 13 Nov)
    }

    void main(){
      vec4 t = texture2D(uLogo, vUv);
      if (t.a < .004) { gl_FragColor = vec4(0.); return; }
      vec2 nxy = texture2D(uNorm, vUv, uSmooth).rg * 2. - 1.;  // read a little blurred: small bumps merge into the big shape
      nxy *= min(1., .72 / max(length(nxy), 1e-4));        // nothing steeper than about 46°, so the edges stop flicking
      vec3 n = normalize(vec3(nxy, sqrt(max(.04, 1. - dot(nxy, nxy)))));
      // Looking at a mirror: the view moves across the logo and with the mouse.
      vec3 v = normalize(vec3((vUv - .5) * vec2(${ASPECT.toFixed(3)}, 1.) * .6 + uTilt * .35, -1.));
      vec3 r = reflect(v, n);
      vec2 e = 2. * r.xy / (1. + max(r.z, -.5));          // gentle at the steep edges, no sudden jumps
      vec2 mir = v.xy;                                     // what a flat mirror would show here
      vec2 ec = mir + (e - mir) * .4;                      // the camera: bevels bend it less, so a face stays readable
      float lit = studio(e);
      // With the camera on, the studio's brightest lights stay on top, so the mouse still moves light around.
      vec3 env = mix(vec3(lit), cam(ec) + smoothstep(.72, 1.55, lit) * .40, uCamMix);
      vec4 sh = texture2D(uLogo, vUv, 1.5);                // the logo's own shading, softened so its small marks merge
      float shade = mix(.5, sh.r, smoothstep(.5, 1., sh.a));
      vec3 c = env * (.68 + .45 * shade);                  // a hint of the original, so its baked marks don't read as stains
      c = mix(c, vec3(shade), .1 - .05 * uCamMix);
      c += pow(1. - n.z, 2.) * .267;                       // a bright rim on the steep edges (11% fainter)
      gl_FragColor = vec4(min(c, vec3(1.)) * t.a, t.a);    // see-through around the letters (premultiplied)
    }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { hide(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const u = { logo: U('uLogo'), norm: U('uNorm'), cam: U('uCam'), tilt: U('uTilt'), time: U('uTime'), camMix: U('uCamMix'), camAspect: U('uCamAspect'), smooth: U('uSmooth') };

  function texture(unit) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function upload(unit, tex, img) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (canMip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const logoTex = texture(0), normTex = texture(1), camTex = texture(2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.uniform1i(u.logo, 0);
  gl.uniform1i(u.norm, 1);
  gl.uniform1i(u.cam, 2);
  gl.uniform1f(u.camAspect, 4 / 3);
  gl.uniform1f(u.smooth, canMip ? 0.5 : 0); // how much small bumps merge (a blur level; needs mipmaps). The traced maps are clean, so only a little.

  let ready = false, inView = false, raf = 0, start = performance.now();
  let tilt = [0, 0], tiltTo = [0, 0], camMix = 0, camMixTo = 0;
  let stream = null, video = null, camFrame = false;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function draw(now) {
    raf = 0;
    if (!ready) return;
    const k = 0.12;
    tilt[0] += (tiltTo[0] - tilt[0]) * k; tilt[1] += (tiltTo[1] - tilt[1]) * k;
    camMix += (camMixTo - camMix) * 0.08;
    if (video && camFrame && video.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, camTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      camFrame = !('requestVideoFrameCallback' in video);
    }
    gl.uniform2f(u.tilt, tilt[0], tilt[1]);
    gl.uniform1f(u.time, reduceMotion ? 0 : (now - start) / 1000);
    gl.uniform1f(u.camMix, camMix);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const settling = Math.abs(tiltTo[0] - tilt[0]) + Math.abs(tiltTo[1] - tilt[1]) + Math.abs(camMixTo - camMix) > 0.002;
    if (inView && (!reduceMotion || stream || settling)) raf = requestAnimationFrame(draw);
  }
  const kick = () => { if (!raf && ready && inView) raf = requestAnimationFrame(draw); };

  async function picture(src) { const im = new Image(); im.src = src; await im.decode(); return im; }
  async function load() {
    let logo, norm;
    try { [logo, norm] = await Promise.all([picture(logoImg.currentSrc || logoImg.src), picture(NORMALS)]); } catch (e) { return; }
    try { upload(0, logoTex, logo); upload(1, normTex, norm); }
    catch (e) { hide(); return; } // e.g. opened as a file: the picture stays
    ready = true;
    resize();
    draw(performance.now());
    piece.classList.add('is-live');
    kick();
  }

  // Mouse: the logo tilts a little under it, so the reflection slides.
  piece.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = piece.getBoundingClientRect();
    tiltTo = [((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2];
    kick();
  });
  piece.addEventListener('pointerleave', () => { tiltTo = [0, 0]; kick(); });

  // Camera: only on the button. Stops when the section leaves the screen or the tab is hidden.
  function setCam(on, note) {
    if (!camBtn) return;
    camBtn.setAttribute('aria-pressed', String(on));
    camBtn.querySelector('span').textContent = on ? 'Turn camera off' : 'See yourself in the silver';
    if (camNote) camNote.textContent = note || '';
  }
  async function camOn() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setCam(false, 'This browser can’t share a camera here, so the logo reflects a studio light.'); return; }
    camBtn.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
    } catch (e) {
      camBtn.disabled = false;
      setCam(false, 'No camera, so the logo reflects a studio light.');
      return;
    }
    camBtn.disabled = false;
    video = document.createElement('video');
    video.muted = true; video.playsInline = true;
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    const onFrame = () => { camFrame = true; kick(); if (video) video.requestVideoFrameCallback(onFrame); };
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame); else camFrame = true;
    const aspect = () => { if (video && video.videoHeight) gl.uniform1f(u.camAspect, video.videoWidth / video.videoHeight); };
    video.addEventListener('loadedmetadata', aspect);
    aspect();
    camMixTo = 1;
    setCam(true, 'Your camera stays on this device. Nothing is recorded or sent.');
    kick();
  }
  function camOff(note) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    if (video) { video.srcObject = null; video = null; }
    camMixTo = 0;
    setCam(false, note);
    kick();
  }
  if (camBtn) camBtn.addEventListener('click', () => (stream ? camOff() : camOn()));
  document.addEventListener('visibilitychange', () => { if (document.hidden && stream) camOff(); });

  let started = false;
  new IntersectionObserver(es => {
    inView = es[es.length - 1].isIntersecting;
    if (inView && !started) { started = true; load(); }
    if (!inView && stream) camOff();
    kick();
  }, { rootMargin: '200px 0px' }).observe(piece);
  new ResizeObserver(() => { if (ready) { resize(); kick(); } }).observe(canvas);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; piece.classList.remove('is-live'); });
})();
