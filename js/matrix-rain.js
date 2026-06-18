/**
 * Matrix-mode background: the classic falling "digital rain" of glowing green
 * glyphs, on a 2D canvas, for the retro hacker theme (<html class="theme-matrix">).
 *
 * Mirrors horror-fire.js: it starts/stops live via the `themechange` event
 * dispatched by themes.js (the console `matrix` command), and also turns on at
 * load if the matrix theme was persisted.
 *
 * Degrades gracefully:
 *  - No 2D context -> nothing shown, normal background.
 *  - reduced motion / effects toggle off -> a single static frame, no animation.
 *  - Tab hidden -> render loop pauses.
 */
(function () {
    'use strict';

    let canvas, ctx, rafId = null, running = false;
    let cols = 0, drops = [], w = 0, h = 0;
    const FONT_SIZE = 16;

    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function effectsOff() { return document.documentElement.classList.contains('fx-off'); }
    function matrixOn() { return document.documentElement.classList.contains('theme-matrix'); }

    // Half-width katakana (the real Matrix glyphs) + hex digits + a few code
    // symbols, so it reads as "code raining down".
    const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾚﾛﾜﾝ0123456789ABCDEF<>/\\|=+*{}[];:';
    function glyph() { return GLYPHS.charAt((Math.random() * GLYPHS.length) | 0); }

    function init() {
        if (canvas) return !!ctx;
        canvas = document.createElement('canvas');
        canvas.id = 'matrix-rain';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        if (!ctx) { canvas.remove(); canvas = null; return false; }
        return true;
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(w / FONT_SIZE);
        // Start each column at a random height above the screen so the rain
        // doesn't begin as one flat row.
        drops = new Array(cols);
        for (let i = 0; i < cols; i++) drops[i] = (Math.random() * -h / FONT_SIZE) | 0;
    }

    function drawFrame() {
        // Translucent black wash each frame leaves fading trails behind the heads.
        ctx.fillStyle = 'rgba(0, 8, 2, 0.10)';
        ctx.fillRect(0, 0, w, h);
        ctx.font = FONT_SIZE + "px 'Share Tech Mono', Consolas, monospace";
        ctx.textBaseline = 'top';

        for (let i = 0; i < cols; i++) {
            const x = i * FONT_SIZE;
            const y = drops[i] * FONT_SIZE;
            // Bright, near-white leading glyph...
            ctx.fillStyle = '#d8ffe2';
            ctx.fillText(glyph(), x, y);
            // ...with a dimmer green one just behind it.
            ctx.fillStyle = 'rgba(0, 255, 102, 0.55)';
            ctx.fillText(glyph(), x, y - FONT_SIZE);

            if (y > h && Math.random() > 0.975) drops[i] = 0;
            else drops[i]++;
        }
    }

    function loop() {
        if (!running) return;
        drawFrame();
        rafId = requestAnimationFrame(loop);
    }

    function start() {
        if (!init()) return;
        canvas.classList.add('active');
        resize();
        // Clear to solid black first so the static/first frame isn't transparent.
        ctx.fillStyle = '#020803';
        ctx.fillRect(0, 0, w, h);
        if (reduce || effectsOff()) {
            // One still frame of scattered glyphs, no animation.
            for (let n = 0; n < 3; n++) drawFrame();
            return;
        }
        if (running) return;
        running = true;
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (canvas) canvas.classList.remove('active');
    }

    window.addEventListener('resize', function () {
        if (canvas && canvas.classList.contains('active')) resize();
    });

    // Live toggle. themes.js fires `themechange` for every theme switch; we only
    // care whether the matrix theme is the one now active.
    window.addEventListener('themechange', function () {
        if (matrixOn()) start(); else stop();
    });

    // Pause/resume with tab visibility (saves CPU), only while matrix is active.
    document.addEventListener('visibilitychange', function () {
        if (!matrixOn()) return;
        if (document.hidden) stop();
        else start();
    });

    // Turn on at load if the matrix theme was persisted.
    if (matrixOn()) start();
})();
