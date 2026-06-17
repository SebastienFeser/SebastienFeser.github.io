/**
 * EU4-style command console.
 *
 * Opens/closes with the physical key to the LEFT OF "1" (event.code ===
 * 'Backquote'), so it works on every keyboard layout regardless of the
 * character printed on that key (² on AZERTY, ` on QWERTY, etc.) - just like
 * EU4.
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

        print('Sebastien Feser console. Type "help" for commands. Close with the same key or Esc.', 'is-muted');
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
    // One global CAPTURE listener handles everything. Capture runs before any
    // bubble listener (incl. the Konami code and scroll-lock handlers), so we
    // can reliably intercept the toggle key and swallow keystrokes while open.
    // stopPropagation() blocks other JS listeners but NOT the browser's default
    // text insertion, so normal typing into the input still works.
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Backquote') {
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

    // Load the horror-theme fonts only the first time the mode is switched on,
    // so normal visitors never pay for them.
    function ensureHorrorFonts() {
        if (document.getElementById('horror-fonts')) return;
        const link = document.createElement('link');
        link.id = 'horror-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Nosifer&family=Special+Elite&display=swap';
        document.head.appendChild(link);
    }

    // Horror mode persists across reloads / pages via localStorage. Apply it as
    // early as this script runs so it carries over the whole site.
    const HORROR_KEY = 'theme-horror';
    if (localStorage.getItem(HORROR_KEY) === 'true') {
        document.documentElement.classList.add('theme-horror');
        ensureHorrorFonts();
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
            desc: 'About Sebastien',
            run: function () {
                printLines([
                    'Sebastien Feser - Game Engineer & Project Lead',
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
                const v = (a[0] || 'toggle').toLowerCase();
                const html = document.documentElement;
                const cur = html.classList.contains('theme-horror');
                let on = cur;
                if (v === 'on') on = true;
                else if (v === 'off') on = false;
                else on = !cur;
                if (on) ensureHorrorFonts();
                html.classList.toggle('theme-horror', on);
                // Persist across reloads / pages.
                if (on) localStorage.setItem(HORROR_KEY, 'true');
                else localStorage.removeItem(HORROR_KEY);
                // Start/stop the WebGL firelight background live.
                window.dispatchEvent(new CustomEvent('horrorchange', { detail: { on: on } }));
                if (on) {
                    print('The Thirteenth Hour approaches... the ghost stirs.', 'is-err');
                } else {
                    print('Dawn breaks. The haunting fades.', 'is-ok');
                }
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
