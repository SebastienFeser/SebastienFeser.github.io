/**
 * EU4-style command console.
 *
 * Opens/closes with the key to the LEFT OF "1", just like EU4. We match both
 * the physical key codes ('Backquote' / 'IntlBackslash') AND the characters
 * that key prints across layouts (` on QWERTY, ² on AZERTY, ^/° on QWERTZ,
 * etc.), because not every keyboard/OS reports 'Backquote' for that key - so
 * relying on the code alone left some layouts unable to open the console.
 *
 * Design constraints:
 *  - It sits ABOVE everything (max z-index), including the Konami physics
 *    overlay (z 999999).
 *  - It is NOT affected by the physics easter egg: it is excluded from the
 *    physics bodies and never hidden when the page collapses.
 *  - It is a TOOL, not an ambient visual effect, so it stays available even
 *    when the visual-effects toggle is off.
 *
 * Commands live in the `commands` registry below and are easy to add/remove.
 */
(function () {
    'use strict';

    /* =========================================================
       DOM
       ========================================================= */
    let root, outputEl, inputEl;
    let isOpen = false;

    // command history (up/down arrows)
    const history = [];
    let histIndex = -1;

    function build() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'command-console';
        root.className = 'cmd-console';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="cmd-titlebar">' +
            '<span class="cmd-title">Console</span>' +
            '<button class="cmd-close-btn" type="button" aria-label="Close console">&times;</button>' +
            '</div>' +
            '<div class="cmd-output" role="log" aria-live="polite"></div>' +
            '<div class="cmd-inputline">' +
            '<span class="cmd-prompt">&gt;</span>' +
            '<input class="cmd-input" type="text" autocomplete="off" autocapitalize="off" ' +
            'spellcheck="false" aria-label="Console command input" />' +
            '</div>';
        document.body.appendChild(root);

        outputEl = root.querySelector('.cmd-output');
        inputEl = root.querySelector('.cmd-input');

        root.querySelector('.cmd-close-btn').addEventListener('click', close);
        makeDraggable(root.querySelector('.cmd-titlebar'));

        print('Sébastien Feser console. Type "help" for commands. Close with the same key or Esc.', 'is-muted');
    }

    /* =========================================================
       Output helpers
       ========================================================= */
    function print(text, cls) {
        const line = document.createElement('div');
        line.className = 'cmd-line' + (cls ? ' ' + cls : '');
        line.textContent = text;
        outputEl.appendChild(line);
        outputEl.scrollTop = outputEl.scrollHeight;
        return line;
    }
    function printLines(arr, cls) { arr.forEach((t) => print(t, cls)); }

    /* =========================================================
       Open / close
       ========================================================= */
    function open() {
        build();
        if (isOpen) return;
        isOpen = true;
        root.classList.add('open');
        root.setAttribute('aria-hidden', 'false');
        // focus after the slide starts so the caret lands correctly
        setTimeout(() => inputEl && inputEl.focus(), 0);
        // Opening the hidden console is a secret achievement.
        window.dispatchEvent(new CustomEvent('achievement-unlock', { detail: { id: 'console' } }));
    }
    function close() {
        if (!isOpen) return;
        isOpen = false;
        root.classList.remove('open');
        root.setAttribute('aria-hidden', 'true');
        if (inputEl) inputEl.blur();
    }
    function toggle() { isOpen ? close() : open(); }

    // Drag the window by its title bar (EU4-style movable console window).
    function makeDraggable(handle) {
        let startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', function (e) {
            // Pin the current on-screen position, dropping the centering transform.
            const r = root.getBoundingClientRect();
            root.style.transform = 'none';
            root.style.left = r.left + 'px';
            root.style.top = r.top + 'px';
            startX = e.clientX; startY = e.clientY;
            startLeft = r.left; startTop = r.top;
            e.preventDefault();

            function onMove(ev) {
                const nx = startLeft + (ev.clientX - startX);
                const ny = startTop + (ev.clientY - startY);
                // keep the window within the viewport
                const maxX = innerWidth - root.offsetWidth;
                const maxY = innerHeight - root.offsetHeight;
                root.style.left = Math.max(0, Math.min(maxX, nx)) + 'px';
                root.style.top = Math.max(0, Math.min(maxY, ny)) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    /* =========================================================
       Key handling
       ========================================================= */
    // The console opens with the key to the LEFT OF "1", EU4-style. We can't
    // rely on `event.code === 'Backquote'` alone: not every keyboard/OS/layout
    // reports that code for that physical key, so on some setups the console
    // could not be opened at all. We therefore also match the characters that
    // key actually prints across the common layouts (` on QWERTY, ² on AZERTY,
    // ^/° on QWERTZ, § on some Nordic, etc.), plus the alternate physical code
    // `IntlBackslash` some ISO keyboards emit.
    const TOGGLE_CODES = ['Backquote', 'IntlBackslash'];
    const TOGGLE_CHARS = ['`', '~', '²', '^', '°', '§', '½', '|', '\\'];

    function isToggleKey(e) {
        if (e.ctrlKey || e.altKey || e.metaKey) return false;
        if (TOGGLE_CODES.includes(e.code)) return true;
        return TOGGLE_CHARS.includes(e.key);
    }

    // While the console is closed, don't hijack the toggle character if the user
    // is typing into another editable field (so e.g. a search box stays usable).
    // The console's own input is fine: it only sees the key once the console is
    // already open, handled separately below.
    function isTypingElsewhere(e) {
        const t = e.target;
        if (!t) return false;
        if (inputEl && t === inputEl) return false;
        const tag = t.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
    }

    // One global CAPTURE listener handles everything. Capture runs before any
    // bubble listener (incl. the Konami code and scroll-lock handlers), so we
    // can reliably intercept the toggle key and swallow keystrokes while open.
    // stopPropagation() blocks other JS listeners but NOT the browser's default
    // text insertion, so normal typing into the input still works.
    document.addEventListener('keydown', function (e) {
        if (isToggleKey(e) && (isOpen || !isTypingElsewhere(e))) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
            return;
        }
        if (!isOpen) return;

        // From here on the console is open: nothing else on the page reacts.
        e.stopPropagation();

        if (e.key === 'Enter') {
            e.preventDefault();
            const raw = inputEl.value;
            inputEl.value = '';
            run(raw);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navHistory(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navHistory(1);
        }
        // Any other key: let it type into the focused input (default action).
    }, true);

    function navHistory(dir) {
        if (!history.length) return;
        if (histIndex === -1) histIndex = history.length;
        histIndex = Math.max(0, Math.min(history.length, histIndex + dir));
        inputEl.value = history[histIndex] || '';
        // move caret to end
        const v = inputEl.value;
        inputEl.value = '';
        inputEl.value = v;
    }

    /* =========================================================
       Command runner
       ========================================================= */
    function run(raw) {
        const text = raw.trim();
        if (text === '') return;
        history.push(text);
        histIndex = -1;
        print('> ' + text, 'is-cmd');

        const parts = text.split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1);

        const cmd = commands[name] || (aliases[name] && commands[aliases[name]]);
        if (!cmd) {
            print('Unknown command: "' + name + '". Type "help".', 'is-err');
            return;
        }
        try {
            cmd.run(args);
        } catch (err) {
            print('Error: ' + (err && err.message ? err.message : err), 'is-err');
        }
    }

    /* =========================================================
       Helpers used by commands
       ========================================================= */
    const onSubpage = /\/pages\//.test(location.pathname);
    const toRoot = onSubpage ? '../' : '';

    // Theme switching (horror, matrix, ...) lives in themes.js (window.SiteTheme):
    // it owns the persistence, font loading and the `themechange` event. The
    // console commands below are just a thin front-end over that API. `arg` is
    // on|off|toggle (default toggle); we report the resulting state with the
    // matching flavour text.
    function runThemeCommand(id, arg, msgOn, msgOff, onCls) {
        if (typeof window.SiteTheme === 'undefined') {
            print('Themes unavailable.', 'is-err');
            return;
        }
        const v = (arg || 'toggle').toLowerCase();
        if (v === 'on') window.SiteTheme.set(id);
        else if (v === 'off') { if (window.SiteTheme.isActive(id)) window.SiteTheme.clear(); }
        else window.SiteTheme.toggle(id);

        if (window.SiteTheme.isActive(id)) print(msgOn, onCls || 'is-info');
        else print(msgOff, 'is-ok');
    }

    function gotoSection(id) {
        const el = document.getElementById(id);
        if (el) {
            close();
            el.scrollIntoView({ behavior: 'smooth' });
        } else {
            // section lives on the homepage
            location.href = toRoot + 'index.html#' + id;
        }
    }

    /* =========================================================
       Command registry  (we will refine these together)
       ========================================================= */
    const aliases = {
        cls: 'clear',
        quit: 'close',
        exit: 'close',
        '?': 'help',
        konami: 'physics',
        debug: 'debug_mode',
        '13th': 'horror',
        '13thhour': 'horror',
        the13thhour: 'horror',
    };

    const commands = {
        help: {
            desc: 'List available commands',
            run: function () {
                print('Available commands:', 'is-info');
                Object.keys(commands).sort().forEach(function (k) {
                    if (commands[k].hidden) return; // easter eggs stay secret
                    print('  ' + k.padEnd(12) + ' - ' + commands[k].desc);
                });
            },
        },
        clear: {
            desc: 'Clear the console output',
            run: function () { outputEl.innerHTML = ''; },
        },
        clear_cache: {
            desc: 'Wipe all saved site data (effects, language, achievements...) and reload',
            run: function () {
                // Wipe everything the site persists: visual-effects toggle, debug
                // mode, language, achievements, horror theme, pending toast, etc.
                // A static site has no service worker / Cache API, so localStorage
                // + sessionStorage IS the site's cache.
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    print('Could not clear storage: ' + (e && e.message ? e.message : e), 'is-err');
                    return;
                }
                print('Cache cleared. Reloading with default settings...', 'is-ok');
                setTimeout(function () { close(); location.reload(); }, 400);
            },
        },
        close: {
            desc: 'Close the console',
            run: function () { close(); },
        },
        echo: {
            desc: 'Print text back',
            run: function (a) { print(a.join(' ')); },
        },
        goto: {
            desc: 'Scroll to a section (about, blog, projects, experience, skills, contact)',
            run: function (a) {
                if (!a[0]) { print('Usage: goto <section>', 'is-err'); return; }
                gotoSection(a[0].toLowerCase());
            },
        },
        home: {
            desc: 'Go to the homepage',
            run: function () { location.href = toRoot + 'index.html'; },
        },
        achievements: {
            desc: 'Open the achievements page',
            run: function () { location.href = toRoot + 'pages/achievements.html'; },
        },
        back: {
            desc: 'Go back one page',
            run: function () { window.history.back(); },
        },
        lang: {
            desc: 'Change language (en, fr, de, it)',
            run: function (a) {
                const l = (a[0] || '').toLowerCase();
                if (!['en', 'fr', 'de', 'it'].includes(l)) {
                    print('Usage: lang <en|fr|de|it>', 'is-err');
                    return;
                }
                if (typeof I18n !== 'undefined' && I18n.switchLanguage) {
                    I18n.switchLanguage(l);
                    print('Language set to ' + l.toUpperCase(), 'is-ok');
                } else {
                    localStorage.setItem('preferred-lang', l);
                    location.reload();
                }
            },
        },
        debug_mode: {
            desc: 'Toggle the debug overlay: FPS + physics colliders (on/off)',
            run: function (a) {
                if (typeof window.DebugMode === 'undefined') {
                    print('Debug mode unavailable.', 'is-err');
                    return;
                }
                const v = (a[0] || 'toggle').toLowerCase();
                let on;
                if (v === 'on') { window.DebugMode.enable(); on = true; }
                else if (v === 'off') { window.DebugMode.disable(); on = false; }
                else { on = window.DebugMode.toggle(); }
                if (on) {
                    print('Debug mode ON. FPS shown; colliders draw during physics mode.', 'is-ok');
                } else {
                    print('Debug mode OFF.', 'is-ok');
                }
            },
        },
        effects: {
            desc: 'Toggle ambient visual effects (on/off)',
            run: function (a) {
                const v = (a[0] || 'toggle').toLowerCase();
                const cur = localStorage.getItem('effects-enabled') !== 'false';
                let next = cur;
                if (v === 'on') next = true;
                else if (v === 'off') next = false;
                else next = !cur;
                localStorage.setItem('effects-enabled', String(next));
                print('Visual effects ' + (next ? 'enabled' : 'disabled') + '. Reloading...', 'is-ok');
                setTimeout(function () { location.reload(); }, 400);
            },
        },
        physics: {
            desc: 'Unleash the physics (the Konami easter egg)',
            hidden: true,
            run: function () {
                close();
                window.dispatchEvent(new CustomEvent('konami-activate'));
            },
        },
        whoami: {
            desc: 'About Sébastien',
            run: function () {
                printLines([
                    'Sébastien Feser - Game Engineer & Project Lead',
                    'Gameplay programming, team leadership, AI-augmented dev.',
                ], 'is-info');
            },
        },
        contact: {
            desc: 'Show contact email',
            run: function () {
                print('sebastien.feser@gmail.com', 'is-info');
            },
        },
        horror: {
            desc: 'Plunge the site into "The 13th Hour" horror mode (toggle)',
            run: function (a) {
                runThemeCommand(
                    'horror', a[0],
                    'The Thirteenth Hour approaches... the ghost stirs.',
                    'Dawn breaks. The haunting fades.',
                    'is-err'
                );
            },
        },
        matrix: {
            desc: 'Enter the Matrix: retro hacker / CRT terminal mode (toggle)',
            run: function (a) {
                runThemeCommand(
                    'matrix', a[0],
                    'Wake up... You are in the Matrix now. Follow the white rabbit.',
                    'You unplug from the Matrix. Welcome back to the real world.',
                    'is-ok'
                );
            },
        },
    };

    /* =========================================================
       Init
       ========================================================= */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
