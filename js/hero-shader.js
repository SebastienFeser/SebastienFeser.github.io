/**
 * Site background: animated GLSL "dark plasma" shader.
 *
 * Just include this script on any page (the global CSS already styles the
 * canvas). It reuses an existing #hero-shader canvas if present, otherwise it
 * creates one, so no per-page HTML is required beyond the <script> tag.
 *
 * Degrades gracefully:
 *  - No WebGL support  -> script exits, nothing shown, normal page.
 *  - prefers-reduced-motion -> no animation, nothing shown.
 *  - Tab hidden -> render loop pauses (saves battery/CPU).
 */
(function () {
    // Respect accessibility preference: no animated background.
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    // Respect the site's visual-effects toggle.
    if (document.documentElement.classList.contains('fx-off')) return;

    // Reuse the canvas if the page provides one, otherwise create it.
    let canvas = document.getElementById('hero-shader');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'hero-shader';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
    }

    // Bail out cleanly if WebGL is unavailable or blocked.
    // preserveDrawingBuffer keeps the last frame painted after we pause the
    // render loop, so the plasma doesn't blank out abruptly while scrolling.
    const opts = { preserveDrawingBuffer: true, antialias: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return;

    const vert = `
        attribute vec2 p;
        void main() { gl_Position = vec4(p, 0.0, 1.0); }
    `;

    const frag = `
        precision mediump float;
        uniform vec2 u_res;
        uniform float u_time;
        void main() {
            vec2 uv = gl_FragCoord.xy / u_res.xy;
            uv.x *= u_res.x / u_res.y;
            float t = u_time * 0.15;
            float v = sin(uv.x * 3.0 + t)
                    + sin(uv.y * 4.0 - t)
                    + sin((uv.x + uv.y) * 2.5 + t * 1.3);
            v *= 0.33;
            vec3 col = mix(vec3(0.04, 0.05, 0.09), vec3(0.10, 0.16, 0.30), v * 0.5 + 0.5);
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            return null;
        }
        return s;
    }

    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return; // compilation failed -> stay hidden

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    function resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    // Everything is ready: reveal the canvas.
    canvas.classList.add('active');
    resize();
    window.addEventListener('resize', resize);

    let rafId = null;
    let running = false;

    function render(time) {
        if (!running) return;
        resize();
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        rafId = requestAnimationFrame(render);
    }

    function start() {
        if (running) return;
        running = true;
        rafId = requestAnimationFrame(render);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    // Fixed full-screen background: render continuously.
    start();

    // Also pause when the tab is hidden.
    document.addEventListener('visibilitychange', () => {
        document.hidden ? stop() : start();
    });
})();
