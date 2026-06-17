/**
 * Site visual-effects toggle.
 *
 * A single switch (button injected into the header) that turns ALL ambient
 * visual effects on/off and remembers the choice in localStorage:
 *   - header glitch (CSS)
 *   - animated shader background
 *   - scroll reveal + animated counters
 *   - 3D card tilt
 *
 * When off, the <html> element gets the `fx-off` class. The other effect
 * scripts and the stylesheet both key off this class, so it's a single source
 * of truth. Toggling reloads the page for a clean start/stop of every effect.
 *
 * Loaded BEFORE the other effect scripts so the class is set before they run.
 *
 * The Konami-code easter egg is intentionally left alone: it's a deliberate,
 * user-triggered surprise, not an ambient effect.
 */
(function () {
    'use strict';

    const KEY = 'effects-enabled';

    // Default: enabled. Only an explicit "false" disables effects.
    function enabled() {
        return localStorage.getItem(KEY) !== 'false';
    }

    // Apply the state to <html> immediately (this script runs before the other
    // effect scripts, which read this class).
    if (!enabled()) document.documentElement.classList.add('fx-off');

    // Expose for the other effect scripts.
    window.FX = { get enabled() { return enabled(); } };

    /* ---- Localized labels (matches the site's 4 languages) ---- */
    const L = {
        en: { on: 'Effects: on',          off: 'Effects: off',           label: 'Toggle visual effects' },
        fr: { on: 'Effets : activés',     off: 'Effets : désactivés',    label: 'Activer ou désactiver les effets visuels' },
        de: { on: 'Effekte: an',          off: 'Effekte: aus',           label: 'Visuelle Effekte umschalten' },
        it: { on: 'Effetti: attivi',      off: 'Effetti: disattivati',   label: 'Attiva o disattiva gli effetti visivi' },
    };
    function strings() {
        const l = localStorage.getItem('preferred-lang');
        return L[l] || L.en;
    }

    /* ---- Icons ---- */
    const ICON_ON =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
        '<path d="M11 1.5l1.7 5L18 8.2l-5.3 1.8L11 15l-1.7-5L4 8.2l5.3-1.7L11 1.5z"/>' +
        '<path d="M18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z"/></svg>';
    const ICON_OFF =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
        '<path d="M11 1.5l1.7 5L18 8.2l-5.3 1.8L11 15l-1.7-5L4 8.2l5.3-1.7L11 1.5z" opacity="0.4"/>' +
        '<path d="M18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity="0.4"/>' +
        '<line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    function build() {
        const host = document.querySelector('.header-content');
        if (!host || host.querySelector('.fx-toggle')) return;

        const btn = document.createElement('button');
        btn.className = 'fx-toggle';
        btn.type = 'button';

        function sync() {
            const on = enabled();
            const s = strings();
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', s.label);
            btn.title = on ? s.on : s.off;
            btn.classList.toggle('is-off', !on);
            btn.innerHTML = on ? ICON_ON : ICON_OFF;
        }
        sync();

        btn.addEventListener('click', function () {
            localStorage.setItem(KEY, String(!enabled()));
            location.reload();
        });

        // Place it just before the language selector (which may be nested inside
        // .social-links, as on the homepage), falling back to the header end.
        const langSel = host.querySelector('.lang-selector');
        if (langSel && langSel.parentNode) {
            langSel.parentNode.insertBefore(btn, langSel);
        } else {
            host.appendChild(btn);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
