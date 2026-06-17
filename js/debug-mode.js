/**
 * Debug mode (a developer-style overlay, toggled from the console).
 *
 * Toggled with the console command `debug_mode` (on/off). When on:
 *   - a small FPS panel is shown top-left (frame rate + frame time, color-coded);
 *   - while the Konami physics easter egg is running, every collider, contact
 *     point and velocity vector is drawn on top of it (that part lives in
 *     `konami-physics.js`, which checks the same `debug-on` class), and the panel
 *     also shows the live body / contact count.
 *
 * `debug-on` on <html> is the single source of truth (mirrors how `fx-off`
 * works for the effects toggle). The state is remembered in localStorage.
 *
 * Like the console, debug mode is a TOOL, not an ambient visual effect, so it is
 * NOT gated by the visual-effects toggle.
 *
 * Built by Sebastien Feser.
 */
(function () {
    'use strict';

    const KEY = 'debug-mode';
    const ROOT = document.documentElement;

    function stored() { return localStorage.getItem(KEY) === 'true'; }

    // Apply the persisted state to <html> immediately so konami-physics (which
    // reads the class each frame) sees it even before this module finishes.
    if (stored()) ROOT.classList.add('debug-on');

    /* =========================================================
       FPS panel
       ========================================================= */
    let panel = null;
    let rafId = 0;
    let frames = 0;
    let lastSample = 0;
    let fps = 0;
    let frameMs = 0;

    function buildPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'debug-panel';
        document.body.appendChild(panel);
    }

    function fpsColor(v) {
        if (v >= 50) return '#4ade80';   // green
        if (v >= 30) return '#fbbf24';   // amber
        return '#e94560';                // red
    }

    function updatePanel() {
        if (!panel) return;
        let html = '<span class="dbg-row"><b>FPS</b> <span style="color:' + fpsColor(fps) + '">'
            + fps + '</span> <span class="dbg-dim">(' + frameMs.toFixed(1) + ' ms)</span></span>';

        // Physics stats, only while the easter egg is live.
        const kp = window.KonamiPhysics && window.KonamiPhysics.stats;
        if (kp) {
            html += '<span class="dbg-row"><b>Bodies</b> ' + kp.bodies + '</span>'
                + '<span class="dbg-row"><b>Contacts</b> ' + kp.contacts + '</span>'
                + '<span class="dbg-row dbg-dim">' + (kp.awake ? 'simulating' : 'asleep') + '</span>';
        }
        panel.innerHTML = html;
    }

    function tick(now) {
        frames++;
        const dt = now - lastSample;
        if (dt >= 500) {
            fps = Math.round((frames * 1000) / dt);
            frameMs = dt / frames;
            frames = 0;
            lastSample = now;
            updatePanel();
        }
        rafId = requestAnimationFrame(tick);
    }

    /* =========================================================
       Enable / disable
       ========================================================= */
    function enable() {
        localStorage.setItem(KEY, 'true');
        ROOT.classList.add('debug-on');
        buildPanel();
        updatePanel();
        if (!rafId) {
            lastSample = performance.now();
            frames = 0;
            rafId = requestAnimationFrame(tick);
        }
    }

    function disable() {
        localStorage.setItem(KEY, 'false');
        ROOT.classList.remove('debug-on');
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        if (panel) { panel.remove(); panel = null; }
        // Clean up the physics collider canvas if the easter egg left one around.
        const c = document.getElementById('konami-debug-canvas');
        if (c) c.remove();
    }

    function toggle() {
        if (ROOT.classList.contains('debug-on')) { disable(); return false; }
        enable();
        return true;
    }

    window.DebugMode = {
        enable: enable,
        disable: disable,
        toggle: toggle,
        get enabled() { return ROOT.classList.contains('debug-on'); },
    };

    // If it was on from a previous visit, bring the panel up on load.
    function init() { if (stored()) enable(); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
