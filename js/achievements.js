/**
 * Achievement system.
 *
 * A lightweight, self-contained achievement/trophy system for the site.
 *
 *  - Unlocked achievements are stored in localStorage (key `achievements-unlocked`)
 *    as a map { id: ISO-timestamp }, so they persist across reloads and pages.
 *  - When one is unlocked, a toast slides in from the BOTTOM-RIGHT of the screen,
 *    in its own fixed overlay (`#achievement-overlay`). The overlay is excluded
 *    from the Konami physics easter egg, so it never collapses with the page.
 *  - A localized "Achievements N/total" link is injected into every page footer.
 *  - The achievements page (`pages/achievements.html`) is rendered from the same
 *    registry, so there is a single source of truth.
 *
 * The toast is treated as an AMBIENT visual effect: when the visual-effects
 * toggle is OFF (`<html class="fx-off">`), achievements still unlock silently but
 * NO toast is shown. (It also respects `prefers-reduced-motion` via CSS.)
 * This script therefore loads AFTER `effects-toggle.js`.
 *
 * ---------------------------------------------------------------------------
 *  HOW TO ADD A NEW ACHIEVEMENT  (see also CLAUDE.md)
 * ---------------------------------------------------------------------------
 *  1. Add an entry to the ACHIEVEMENTS array below:
 *       {
 *         id:    'unique-kebab-id',     // never reuse / rename (it's the storage key)
 *         icon:  '🏆',                  // any emoji (or short text)
 *         secret: false,                // true = hidden as "???" until unlocked
 *         i18n: {                       // name + description in ALL 4 languages
 *           en: { name: '...', desc: '...' },
 *           fr: { name: '...', desc: '...' },
 *           de: { name: '...', desc: '...' },
 *           it: { name: '...', desc: '...' },
 *         },
 *       }
 *  2. Unlock it wherever its condition is met, using EITHER:
 *       window.Achievements.unlock('unique-kebab-id');
 *     or, from a script that should not depend on load order:
 *       window.dispatchEvent(new CustomEvent('achievement-unlock',
 *           { detail: { id: 'unique-kebab-id' } }));
 *     Calling unlock again after it's already earned is a harmless no-op.
 *
 *  Built by Sebastien Feser.
 */
(function () {
    'use strict';

    const KEY = 'achievements-unlocked';

    /* =========================================================
       Registry — the single source of truth.
       Add new achievements here (see header comment / CLAUDE.md).
       ========================================================= */
    const ACHIEVEMENTS = [
        {
            id: 'welcome',
            icon: '👋',
            secret: false,
            i18n: {
                en: { name: 'Welcome aboard',     desc: 'Land on the site for the very first time.' },
                fr: { name: 'Bienvenue à bord',   desc: 'Arriver sur le site pour la toute première fois.' },
                de: { name: 'Willkommen an Bord', desc: 'Zum allerersten Mal auf der Seite landen.' },
                it: { name: 'Benvenuto a bordo',  desc: 'Arrivare sul sito per la primissima volta.' },
            },
        },
        {
            id: 'reach-bottom',
            icon: '🏁',
            secret: false,
            i18n: {
                en: { name: 'All the Way Down', desc: 'Scroll all the way to the bottom of a page.' },
                fr: { name: 'Jusqu\'au bout',   desc: 'Faire défiler une page jusqu\'en bas.' },
                de: { name: 'Bis zum Ende',     desc: 'Eine Seite bis ganz nach unten scrollen.' },
                it: { name: 'Fino in fondo',    desc: 'Scorri una pagina fino in fondo.' },
            },
        },
    ];

    /* =========================================================
       Localized UI strings (for the toast, footer link and page).
       Kept inline (like effects-toggle.js / command-console.js) so the toast
       works on every page without waiting on the i18n module to load.
       ========================================================= */
    const UI = {
        en: {
            unlocked: 'Achievement unlocked',
            footer: 'Achievements',
            title: 'Achievements',
            subtitle: 'Little rewards scattered across the site. Go find them.',
            progress: 'unlocked',
            locked: 'Locked',
            secretName: '???',
            secretDesc: 'Hidden achievement — keep exploring to reveal it.',
            unlockedOn: 'Unlocked on',
            back: '← Back to home',
        },
        fr: {
            unlocked: 'Succès débloqué',
            footer: 'Succès',
            title: 'Succès',
            subtitle: 'De petites récompenses disséminées sur le site. À vous de les trouver.',
            progress: 'débloqués',
            locked: 'Verrouillé',
            secretName: '???',
            secretDesc: 'Succès caché : continuez à explorer pour le révéler.',
            unlockedOn: 'Débloqué le',
            back: '← Retour à l\'accueil',
        },
        de: {
            unlocked: 'Erfolg freigeschaltet',
            footer: 'Erfolge',
            title: 'Erfolge',
            subtitle: 'Kleine Belohnungen, über die Seite verstreut. Finde sie.',
            progress: 'freigeschaltet',
            locked: 'Gesperrt',
            secretName: '???',
            secretDesc: 'Versteckter Erfolg — erkunde weiter, um ihn zu enthüllen.',
            unlockedOn: 'Freigeschaltet am',
            back: '← Zurück zur Startseite',
        },
        it: {
            unlocked: 'Obiettivo sbloccato',
            footer: 'Obiettivi',
            title: 'Obiettivi',
            subtitle: 'Piccole ricompense sparse per il sito. Sta a te trovarle.',
            progress: 'sbloccati',
            locked: 'Bloccato',
            secretName: '???',
            secretDesc: 'Obiettivo nascosto: continua a esplorare per rivelarlo.',
            unlockedOn: 'Sbloccato il',
            back: '← Torna alla home',
        },
    };

    // Mirror i18n.js's resolution order (saved > browser > en) so the very first
    // toast (shown before i18n sets the language) is already in the right language.
    function lang() {
        const saved = localStorage.getItem('preferred-lang');
        if (saved && UI[saved]) return saved;
        const browser = (navigator.language || 'en').split('-')[0];
        return UI[browser] ? browser : 'en';
    }
    function strings() { return UI[lang()]; }
    function text(a) { return a.i18n[lang()] || a.i18n.en; }
    function def(id) { return ACHIEVEMENTS.find((a) => a.id === id); }

    /* =========================================================
       Persistent state
       ========================================================= */
    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
        catch (e) { return {}; }
    }
    function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
    function isUnlocked(id) { return !!load()[id]; }
    function unlockedCount() { return Object.keys(load()).length; }

    /* =========================================================
       Unlock + toast
       ========================================================= */
    function unlock(id) {
        const a = def(id);
        if (!a) { console.warn('[achievements] unknown achievement id:', id); return false; }
        const state = load();
        if (state[id]) return false;            // already earned — no-op
        state[id] = new Date().toISOString();
        save(state);
        showToast(a);
        updateFooterLink();
        renderPage();
        return true;
    }

    let toastHost = null;
    function ensureToastHost() {
        if (toastHost && document.body.contains(toastHost)) return toastHost;
        toastHost = document.createElement('div');
        toastHost.id = 'achievement-overlay';
        document.body.appendChild(toastHost);
        return toastHost;
    }

    // Browsers block sound until the page has had a user interaction, so the
    // toast and its chime must stay in sync: if no interaction has happened yet
    // (e.g. the `welcome` achievement fired on page load), we QUEUE the toast and
    // release it — toast + sound together — on the first click/scroll/key/etc.
    // Achievements unlocked by an action already have that interaction, so they
    // pop instantly. Silent entirely when effects are off.
    function showToast(a) {
        if (document.documentElement.classList.contains('fx-off')) return;
        if (!interacted) { pendingToasts.push(a); return; }
        buildToast(a);
    }

    function buildToast(a) {
        playSound();

        const s = strings();
        const t = text(a);
        const host = ensureToastHost();

        const el = document.createElement('div');
        el.className = 'achievement-toast';
        el.setAttribute('role', 'status');
        el.innerHTML =
            '<div class="achievement-toast-icon"></div>' +
            '<div class="achievement-toast-body">' +
            '<div class="achievement-toast-label"></div>' +
            '<div class="achievement-toast-name"></div>' +
            '</div>';
        el.querySelector('.achievement-toast-icon').textContent = a.icon;
        el.querySelector('.achievement-toast-label').textContent = s.unlocked;
        el.querySelector('.achievement-toast-name').textContent = t.name;
        host.appendChild(el);

        requestAnimationFrame(() => el.classList.add('show'));

        let gone = false;
        function hide() {
            if (gone) return;
            gone = true;
            el.classList.remove('show');
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
        }
        el.addEventListener('click', hide);
        setTimeout(hide, 5000);
    }

    /* =========================================================
       Footer link (injected on every page)
       ========================================================= */
    const onSubpage = /\/pages\//.test(location.pathname);
    function pagePath() { return onSubpage ? 'achievements.html' : 'pages/achievements.html'; }
    const SOUND_SRC = (onSubpage ? '../' : '') + 'assets/audio/achievement.mp3';

    // Unlock chime. Preloaded up front (the small mp3 is fetched as soon as the
    // script runs) so it's ready the instant a toast pops. Plays from the start;
    // this is only ever called from buildToast, i.e. after a user interaction, so
    // the browser allows it.
    let sound = null;
    function preloadSound() {
        try { sound = new Audio(SOUND_SRC); sound.preload = 'auto'; sound.load(); }
        catch (e) { sound = null; /* audio unsupported */ }
    }
    function playSound() {
        if (!sound) preloadSound();
        if (!sound) return;
        try {
            sound.currentTime = 0;
            sound.volume = 0.5;
            const p = sound.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) { /* ignore */ }
    }
    preloadSound();

    // First-interaction gate. The toast + chime are released together on the very
    // first user interaction. Broad on purpose: click, mouse, keyboard, touch,
    // wheel and scroll all count. Capture-phase + passive so it runs before any
    // click handler that might itself unlock an achievement, without blocking it.
    const GESTURES = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchstart', 'wheel', 'scroll'];
    let interacted = false;
    const pendingToasts = [];
    function onFirstInteraction() {
        if (interacted) return;
        interacted = true;
        GESTURES.forEach(function (ev) { window.removeEventListener(ev, onFirstInteraction, true); });
        while (pendingToasts.length) buildToast(pendingToasts.shift());
    }
    GESTURES.forEach(function (ev) {
        window.addEventListener(ev, onFirstInteraction, { capture: true, passive: true });
    });

    let footerLink = null;
    function injectFooterLink() {
        const footer = document.querySelector('.site-footer');
        if (!footer || footer.querySelector('.achievements-footer-link')) return;

        const a = document.createElement('a');
        a.className = 'achievements-footer-link';
        a.href = pagePath();

        const existing = footer.querySelector('.footer-links');
        if (existing) {
            existing.appendChild(a);
        } else {
            const wrap = document.createElement('div');
            wrap.className = 'footer-links';
            wrap.appendChild(a);
            footer.insertBefore(wrap, footer.firstChild);
        }
        footerLink = a;
        updateFooterLink();
    }
    function updateFooterLink() {
        if (!footerLink) return;
        footerLink.textContent = '🏆 ' + strings().footer + ' ' + unlockedCount() + '/' + ACHIEVEMENTS.length;
    }

    /* =========================================================
       Achievements page rendering (only runs if the page is present)
       ========================================================= */
    function renderPage() {
        const root = document.getElementById('achievements-page');
        if (!root) return;

        const s = strings();
        const state = load();
        const done = unlockedCount();
        const total = ACHIEVEMENTS.length;

        root.innerHTML = '';

        const header = document.createElement('header');
        header.className = 'article-header achievements-header';
        const h1 = document.createElement('h1');
        h1.textContent = s.title;
        const sub = document.createElement('p');
        sub.className = 'hero-subtitle';
        sub.textContent = s.subtitle;
        const progress = document.createElement('p');
        progress.className = 'achievements-progress';
        progress.textContent = done + ' / ' + total + ' ' + s.progress;
        header.appendChild(h1);
        header.appendChild(sub);
        header.appendChild(progress);
        root.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'achievements-grid';

        ACHIEVEMENTS.forEach((a) => {
            const got = !!state[a.id];
            const hidden = a.secret && !got;
            const t = text(a);

            const card = document.createElement('article');
            card.className = 'achievement-card ' + (got ? 'is-unlocked' : 'is-locked')
                + (hidden ? ' is-secret' : '');

            const icon = document.createElement('div');
            icon.className = 'achievement-card-icon';
            icon.textContent = hidden ? '🔒' : a.icon;

            const body = document.createElement('div');
            body.className = 'achievement-card-body';

            const name = document.createElement('h3');
            name.className = 'achievement-card-name';
            name.textContent = hidden ? s.secretName : t.name;

            const desc = document.createElement('p');
            desc.className = 'achievement-card-desc';
            desc.textContent = hidden ? s.secretDesc : t.desc;

            body.appendChild(name);
            body.appendChild(desc);

            const meta = document.createElement('span');
            meta.className = 'achievement-card-meta';
            if (got) {
                const d = new Date(state[a.id]);
                const formatted = isNaN(d) ? '' : d.toLocaleDateString(lang(), {
                    year: 'numeric', month: 'short', day: 'numeric',
                });
                meta.textContent = s.unlockedOn + ' ' + formatted;
            } else {
                meta.textContent = s.locked;
            }
            body.appendChild(meta);

            card.appendChild(icon);
            card.appendChild(body);
            grid.appendChild(card);
        });

        root.appendChild(grid);
    }

    /* =========================================================
       Public API + event bridge
       ========================================================= */
    window.Achievements = {
        unlock: unlock,
        isUnlocked: isUnlocked,
        list: ACHIEVEMENTS,
        count: unlockedCount,
        reset: function () {
            localStorage.removeItem(KEY);
            updateFooterLink();
            renderPage();
        },
    };

    window.addEventListener('achievement-unlock', function (e) {
        if (e && e.detail && e.detail.id) unlock(e.detail.id);
    });

    /* =========================================================
       Init
       ========================================================= */
    function init() {
        injectFooterLink();
        renderPage();
        // Re-localize injected bits live when the language changes. i18n.js sets
        // <html lang="..."> on every switch, so we just watch that attribute.
        const obs = new MutationObserver(function () {
            updateFooterLink();
            renderPage();
        });
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

        // First-ever arrival on the site (any page). No-op on every later visit.
        unlock('welcome');

        setupScrollAchievement();
    }

    // Unlock 'reach-bottom' once the visitor scrolls to the bottom of a page.
    // Ignores pages too short to scroll (so it can't fire without real scrolling).
    function setupScrollAchievement() {
        if (isUnlocked('reach-bottom')) return;
        function check() {
            const full = document.documentElement.scrollHeight;
            if (full <= window.innerHeight + 4) return;          // nothing to scroll
            if (window.innerHeight + window.scrollY >= full - 4) {
                unlock('reach-bottom');
                window.removeEventListener('scroll', check);
            }
        }
        window.addEventListener('scroll', check, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
