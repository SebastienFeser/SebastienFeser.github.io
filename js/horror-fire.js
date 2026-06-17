/**
 * Horror-mode background: an animated GLSL "torch / firelight" effect.
 *
 * Simulates a fire burning in the foreground that we don't see directly - only
 * the warm, flickering light it casts on the dark scene behind. The glow is
 * strongest near the bottom (the fire is low/in front) and fades upward.
 *
 * Only runs while the site is in horror mode (<html class="theme-horror">). It
 * starts/stops live via the `horrorchange` event dispatched by the console's
 * `horror` command, and also turns on at load if horror mode is persisted.
 *
 * Degrades gracefully:
 *  - No WebGL          -> nothing shown, normal dark background.
 *  - reduced motion / effects toggle off -> a single static frame, no animation.
 *  - Tab hidden        -> render loop pauses.
 */
(function () {
    'use strict';

    let canvas, gl, rafId = null, running = false, startTime = 0;
    let uRes, uTime;

    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function effectsOff() { return document.documentElement.classList.contains('fx-off'); }
    function horrorOn() { return document.documentElement.classList.contains('theme-horror'); }

    const vert = `
        attribute vec2 p;
        void main() { gl_Position = vec4(p, 0.0, 1.0); }
    `;

    const frag = `
        precision mediump float;
        uniform vec2 u_res;
        uniform float u_time;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            float a = hash(i), b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
            return v;
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_res.xy;
            float aspect = u_res.x / u_res.y;
            float t = u_time;

            // Vertical falloff: a fire burns BELOW the screen, so only the lower
            // part is lit; the glow dies out smoothly toward the top.
            float grad = smoothstep(0.85, -0.10, uv.y);

            // Broad shimmer across the bottom (drifting over time). No sharp
            // flame tongues - just an uneven, living glow.
            float shimmer = 0.80 + 0.20 * fbm(vec2(uv.x * aspect * 2.2, uv.y * 2.0 + t * 0.6));

            // Random global flicker of the overall intensity.
            float flick = 0.82 + 0.18 * fbm(vec2(t * 1.6, 9.0));

            // Higher exponent + lower scale = a dimmer, darker glow.
            float light = pow(grad * shimmer * flick, 1.7) * 0.6;

            // Surface detail so the glow reads as light on a textured wall
            // instead of a soft blur. Smooth fbm layers (no raw high-frequency
            // noise, which would look blocky/pixelated).
            float detail = 0.72 + 0.58 * fbm(vec2(uv.x * aspect, uv.y) * 6.0);
            detail *= 0.88 + 0.24 * fbm(vec2(uv.x * aspect, uv.y) * 15.0);
            light *= detail;

            // Warm torchlight palette: yellow-ish, like a torch flame.
            vec3 base = vec3(0.010, 0.008, 0.012);
            vec3 col = base;
            col += vec3(0.80, 0.45, 0.12) * light;                  // warm yellow body
            col += vec3(1.00, 0.72, 0.26) * pow(light, 2.2) * 0.4;  // hotter core
            col += vec3(1.00, 0.92, 0.52) * pow(light, 4.5) * 0.25; // brightest near base

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
        return s;
    }

    function init() {
        if (canvas) return !!gl;
        canvas = document.createElement('canvas');
        canvas.id = 'horror-fire';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);

        const opts = { preserveDrawingBuffer: true, antialias: false };
        gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
        if (!gl) { canvas.remove(); canvas = null; return false; }

        const vs = compile(gl.VERTEX_SHADER, vert);
        const fs = compile(gl.FRAGMENT_SHADER, frag);
        if (!vs || !fs) { canvas.remove(); canvas = null; gl = null; return false; }

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); canvas = null; gl = null; return false; }
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        uRes = gl.getUniformLocation(prog, 'u_res');
        uTime = gl.getUniformLocation(prog, 'u_time');
        return true;
    }

    function resize() {
        // Render at device pixel ratio (capped) so the texture stays crisp
        // instead of looking pixelated on high-DPI screens.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.floor((canvas.clientWidth || innerWidth) * dpr);
        const h = Math.floor((canvas.clientHeight || innerHeight) * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    function drawFrame(t) {
        resize();
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function loop(now) {
        if (!running) return;
        drawFrame((now - startTime) / 1000);
        rafId = requestAnimationFrame(loop);
    }

    function start() {
        if (!init()) return;
        canvas.classList.add('active');
        resize();
        // No animation for reduced-motion / effects-off: just a still frame.
        if (reduce || effectsOff()) {
            drawFrame(3.0);
            return;
        }
        if (running) return;
        running = true;
        startTime = performance.now();
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (canvas) canvas.classList.remove('active');
    }

    window.addEventListener('resize', function () { if (canvas && canvas.classList.contains('active')) resize(); });

    // Live toggle from the console `horror` command.
    window.addEventListener('horrorchange', function (e) {
        if (e.detail && e.detail.on) start(); else stop();
    });

    // Pause/resume with tab visibility (saves CPU), only while horror is active.
    document.addEventListener('visibilitychange', function () {
        if (!horrorOn()) return;
        if (document.hidden) stop();
        else start();
    });

    // Turn on at load if horror mode was persisted.
    if (horrorOn()) start();
})();
