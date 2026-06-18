/**
 * Site theme manager — the SINGLE source of truth for swappable site-wide
 * "skins" toggled from the console (the original horror mode, the matrix mode,
 * and any future one).
 *
 * A theme is just a `<html class="theme-<id>">` reskin (all the looks live in
 * CSS) plus, optionally, a background-effect canvas script that reacts to the
 * `themechange` event. Only ONE theme is active at a time; the choice persists
 * in localStorage (key `site-theme`).
 *
 * ── HOW TO ADD A NEW THEME ───────────────────────────────────────────────
 *   1. Add an entry to the THEMES registry below:
 *        mytheme: {
 *            className: 'theme-mytheme',                   // CSS hook
 *            fonts: 'https://fonts.googleapis.com/...',    // optional web fonts
 *        }
 *   2. Add a `.theme-mytheme { ... }` block in css/style.css (palette + look).
 *      Gate any ambient animation under `.theme-mytheme:not(.fx-off)` and
 *      `@media (prefers-reduced-motion: reduce)` (see the existing themes).
 *   3. (Optional) a background canvas script (like matrix-rain.js / horror-fire.js)
 *      that listens for `themechange` and checks its `.theme-mytheme` class.
 *   4. Add a console command to toggle it (see command-console.js `horror` /
 *      `matrix`). Turning on any theme already unlocks the shared "tried a style"
 *      achievement, so no per-theme achievement is needed.
 * Nothing else is wired by hand.
 *
 * Loads EARLY in the end-of-body script block (right after layout.js) so the
 * persisted theme is applied before the other scripts run and with minimal flash.
 *
 * Like the console and debug mode, a theme is a deliberate, user-triggered tool,
 * NOT an ambient effect, so it is intentionally NOT gated by the visual-effects
 * toggle. (Its ambient animations — flicker, rain, caret — ARE gated, in CSS/JS.)
 */
(function () {
    'use strict';

    const KEY = 'site-theme';

    /* ---- Theme registry (add new themes here) ---- */
    const THEMES = {
        horror: {
            className: 'theme-horror',
            fonts: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Nosifer&family=Special+Elite&display=swap',
        },
        matrix: {
            className: 'theme-matrix',
            fonts: 'https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap',
        },
    };

    // Turning on ANY theme unlocks one shared "tried a style" achievement
    // (achievements.js listens for the `themechange` event), so individual
    // themes don't each need their own achievement.

    const ALL_CLASSES = Object.keys(THEMES).map(function (id) { return THEMES[id].className; });

    function loadFonts(id) {
        const t = THEMES[id];
        if (!t || !t.fonts) return;
        const fid = 'theme-fonts-' + id;
        if (document.getElementById(fid)) return;
        const link = document.createElement('link');
        link.id = fid;
        link.rel = 'stylesheet';
        link.href = t.fonts;
        document.head.appendChild(link);
    }

    function currentId() {
        const id = localStorage.getItem(KEY);
        return THEMES[id] ? id : null;
    }

    // One-time migration from the old standalone horror flag to the unified key.
    if (!localStorage.getItem(KEY) && localStorage.getItem('theme-horror') === 'true') {
        localStorage.setItem(KEY, 'horror');
    }
    localStorage.removeItem('theme-horror');

    function applyClass(id) {
        const html = document.documentElement;
        ALL_CLASSES.forEach(function (c) { html.classList.remove(c); });
        if (id && THEMES[id]) html.classList.add(THEMES[id].className);
    }

    // Apply the persisted theme as early as this script runs.
    (function applyAtLoad() {
        const id = currentId();
        if (id) { applyClass(id); loadFonts(id); }
    })();

    // Switch to a theme (id), or pass null / '' / 'default' to go back to the
    // normal site. Fires `themechange` so effect scripts + achievements react.
    function setTheme(id) {
        if (id === 'default' || id === '') id = null;
        if (id && !THEMES[id]) return false;

        const prev = currentId();
        if (id === prev) return true;

        // Update the class FIRST so the new state is in place before we notify:
        // each background effect re-checks its own `.theme-*` class on the event
        // and starts/stops accordingly. (If we dispatched before swapping the
        // class, turning a theme OFF would leave its effect running.)
        applyClass(id);
        if (id) { loadFonts(id); localStorage.setItem(KEY, id); }
        else { localStorage.removeItem(KEY); }

        window.dispatchEvent(new CustomEvent('themechange', { detail: { id: id, prev: prev, on: !!id } }));
        return true;
    }

    function toggle(id) {
        if (!THEMES[id]) return false;
        return setTheme(currentId() === id ? null : id);
    }

    /* ---- Public API ---- */
    window.SiteTheme = {
        set: setTheme,                                  // set('matrix') / set(null)
        toggle: toggle,                                 // toggle('matrix')
        clear: function () { return setTheme(null); },  // back to default
        current: currentId,                             // -> 'matrix' | 'horror' | null
        isActive: function (id) { return currentId() === id; },
        list: THEMES,                                   // the registry
    };
})();
