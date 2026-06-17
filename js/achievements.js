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
                en: { name: 'All the Way Down', desc: 'Scroll all the way to the bottom of the homepage.' },
                fr: { name: 'Jusqu\'au bout',   desc: 'Faire défiler la page d\'accueil jusqu\'en bas.' },
                de: { name: 'Bis zum Ende',     desc: 'Die Startseite bis ganz nach unten scrollen.' },
                it: { name: 'Fino in fondo',    desc: 'Scorri la home page fino in fondo.' },
            },
        },
        {
            id: 'read-article',
            icon: '📖',
            secret: false,
            i18n: {
                en: { name: 'Good Read',     desc: 'Open one of the articles.' },
                fr: { name: 'Bonne lecture', desc: 'Ouvrir un des articles.' },
                de: { name: 'Gute Lektüre',  desc: 'Einen der Artikel öffnen.' },
                it: { name: 'Buona lettura', desc: 'Aprire uno degli articoli.' },
            },
        },
        {
            id: 'play-game',
            icon: '👾',
            secret: false,
            i18n: {
                en: { name: 'Insert Coin',      desc: 'Open one of the published games.' },
                fr: { name: 'Insert Coin',      desc: 'Ouvrir un des jeux publiés.' },
                de: { name: 'Münze einwerfen',  desc: 'Eines der veröffentlichten Spiele öffnen.' },
                it: { name: 'Inserisci gettone', desc: 'Aprire uno dei giochi pubblicati.' },
            },
        },
        {
            id: 'education',
            icon: '🎓',
            secret: false,
            i18n: {
                en: { name: 'Graduate',  desc: 'Open the education page.' },
                fr: { name: 'Diplômé',   desc: 'Ouvrir la page de formation.' },
                de: { name: 'Absolvent', desc: 'Die Ausbildungsseite öffnen.' },
                it: { name: 'Laureato',  desc: 'Aprire la pagina della formazione.' },
            },
        },
        {
            id: 'experience',
            icon: '💼',
            secret: false,
            i18n: {
                en: { name: 'On the Job',   desc: 'Open a work experience page.' },
                fr: { name: 'Au travail',   desc: 'Ouvrir une page d\'expérience professionnelle.' },
                de: { name: 'An die Arbeit', desc: 'Eine Berufserfahrungsseite öffnen.' },
                it: { name: 'Al lavoro',    desc: 'Aprire una pagina di esperienza professionale.' },
            },
        },
        {
            id: 'youtube',
            icon: '😏',
            secret: false,
            i18n: {
                en: { name: 'Mystery',  desc: 'Some things are better left unexplained.' },
                fr: { name: 'Mystère',  desc: 'Certaines choses valent mieux rester inexpliquées.' },
                de: { name: 'Mysterium', desc: 'Manche Dinge bleiben besser unerklärt.' },
                it: { name: 'Mistero',  desc: 'Certe cose è meglio non spiegarle.' },
            },
        },
        {
            id: 'cv',
            icon: '📄',
            secret: false,
            i18n: {
                en: { name: 'Ready to Work',     desc: 'Open the CV.' },
                fr: { name: 'Paré à travailler', desc: 'Ouvrir le CV.' },
                de: { name: 'Bereit zu arbeiten', desc: 'Den Lebenslauf öffnen.' },
                it: { name: 'Pronto a lavorare', desc: 'Aprire il CV.' },
            },
        },
        {
            id: 'globe-trotter',
            icon: '🌍',
            secret: false,
            i18n: {
                en: { name: 'Globe Trotter', desc: 'Visit 10 pages across the site.' },
                fr: { name: 'Globe Trotter', desc: 'Visiter 10 pages du site.' },
                de: { name: 'Globetrotter',  desc: 'Besuche 10 Seiten der Website.' },
                it: { name: 'Globetrotter',  desc: 'Visita 10 pagine del sito.' },
            },
        },
        {
            id: 'contact',
            icon: '📬',
            secret: false,
            i18n: {
                en: { name: 'First Contact',   desc: 'Reach out by email.' },
                fr: { name: 'Premier contact', desc: 'Prendre contact par email.' },
                de: { name: 'Erster Kontakt',  desc: 'Per E-Mail Kontakt aufnehmen.' },
                it: { name: 'Primo contatto',  desc: 'Mettersi in contatto via email.' },
            },
        },
        {
            id: 'language',
            icon: '🗣️',
            secret: false,
            i18n: {
                en: { name: 'Polyglot',   desc: 'Switch the site language.' },
                fr: { name: 'Polyglotte', desc: 'Changer la langue du site.' },
                de: { name: 'Polyglott',  desc: 'Die Seitensprache wechseln.' },
                it: { name: 'Poliglotta', desc: 'Cambiare la lingua del sito.' },
            },
        },
        {
            id: 'devtools',
            icon: '🔎',
            secret: true,
            i18n: {
                en: { name: 'Inspector',  desc: 'Open the browser developer tools.' },
                fr: { name: 'Inspecteur', desc: 'Ouvrir les outils de développement du navigateur.' },
                de: { name: 'Inspektor',  desc: 'Die Entwicklertools des Browsers öffnen.' },
                it: { name: 'Ispettore',  desc: 'Aprire gli strumenti per sviluppatori del browser.' },
            },
            hints: {
                en: [
                    'A magician never reveals his secrets.',
                    'Developers spend a lot of time in here.',
                    'So this is how you inspect the little details of a site?',
                ],
                fr: [
                    'Un magicien ne révèle jamais ses secrets.',
                    'Les développeurs passent souvent par là.',
                    'Donc c\'est comme ça qu\'on observe les détails des sites ?',
                ],
                de: [
                    'Ein Zauberer verrät niemals seine Tricks.',
                    'Entwickler sind hier oft unterwegs.',
                    'Also so schaut man sich die Details einer Website an?',
                ],
                it: [
                    'Un mago non svela mai i suoi trucchi.',
                    'Gli sviluppatori ci passano spesso.',
                    'Quindi è così che si osservano i dettagli di un sito?',
                ],
            },
        },
        {
            id: 'console',
            icon: '⌨️',
            secret: true,
            i18n: {
                en: { name: 'Command Line',     desc: 'Open the hidden console (the key just left of "1").' },
                fr: { name: 'Ligne de commande', desc: 'Ouvrir la console cachée (la touche juste à gauche du « 1 »).' },
                de: { name: 'Befehlszeile',     desc: 'Öffne die versteckte Konsole (die Taste links neben der „1").' },
                it: { name: 'Riga di comando',  desc: 'Apri la console nascosta (il tasto subito a sinistra dell\'« 1 »).' },
            },
            hints: {
                en: [
                    'Paradox veterans know what turns an ordinary game into a playground.',
                    'Most people never know what this button is for, but it is right there.',
                    'So that key is not so useless after all...',
                ],
                fr: [
                    'Les vétérans de Paradox savent ce qui transforme une partie ordinaire en terrain de jeu.',
                    'Beaucoup de gens ne savent pas à quoi sert ce bouton, mais il est là.',
                    'Cette touche n\'est donc pas si inutile...',
                ],
                de: [
                    'Paradox-Veteranen wissen, was eine gewöhnliche Partie in einen Spielplatz verwandelt.',
                    'Viele Leute wissen nicht, wozu diese Taste dient, aber sie ist da.',
                    'Diese Taste ist also doch nicht so nutzlos...',
                ],
                it: [
                    'I veterani di Paradox sanno cosa trasforma una partita qualunque in un parco giochi.',
                    'Molti non sanno a cosa serva questo tasto, ma è lì.',
                    'Quindi questo tasto non è poi così inutile...',
                ],
            },
        },
        {
            id: 'horror',
            icon: '👻',
            secret: true,
            i18n: {
                en: { name: 'The 13th Hour', desc: 'Summon the horror mode.' },
                fr: { name: 'La 13e heure',  desc: 'Invoquer le mode horreur.' },
                de: { name: 'Die 13. Stunde', desc: 'Den Horror-Modus heraufbeschwören.' },
                it: { name: 'La 13ª ora',    desc: 'Evocare la modalità horror.' },
            },
            hints: {
                en: [
                    'I loved working on this project.',
                    'The site will never be the same again.',
                    'What if I typed help? Maybe I would find a clue.',
                ],
                fr: [
                    'J\'ai adoré bosser sur ce projet.',
                    'Le site ne sera plus jamais le même.',
                    'Et si je tapais help ? Peut-être que je trouverais un indice.',
                ],
                de: [
                    'Ich habe es geliebt, an diesem Projekt zu arbeiten.',
                    'Die Seite wird nie mehr dieselbe sein.',
                    'Was, wenn ich help eingebe? Vielleicht finde ich einen Hinweis.',
                ],
                it: [
                    'Ho adorato lavorare a questo progetto.',
                    'Il sito non sarà più lo stesso.',
                    'E se digitassi help? Forse troverei un indizio.',
                ],
            },
        },
        {
            id: 'konami',
            icon: '🕹️',
            secret: true,
            i18n: {
                en: { name: 'Up Up Down Down',    desc: 'Enter the legendary Konami code.' },
                fr: { name: 'Haut Haut Bas Bas',  desc: 'Saisir le légendaire code Konami.' },
                de: { name: 'Oben Oben Unten Unten', desc: 'Den legendären Konami-Code eingeben.' },
                it: { name: 'Su Su Giù Giù',      desc: 'Inserire il leggendario codice Konami.' },
            },
            hints: {
                en: [
                    'Those who know it have never forgotten it.',
                    'Plug in a controller and it works too.',
                    'It is the kind of detail that gives away a Konami game.',
                ],
                fr: [
                    'Ceux qui le connaissent ne l\'ont jamais oublié.',
                    'Si on branche une manette, ça fonctionne aussi.',
                    'C\'est à ce genre de détails qu\'on reconnaît un jeu Konami.',
                ],
                de: [
                    'Wer ihn kennt, hat ihn nie vergessen.',
                    'Schließt man einen Controller an, funktioniert es auch.',
                    'An solchen Details erkennt man ein Konami-Spiel.',
                ],
                it: [
                    'Chi lo conosce non l\'ha mai dimenticato.',
                    'Se colleghi un controller, funziona anche così.',
                    'È da questi dettagli che si riconosce un gioco Konami.',
                ],
            },
        },
        {
            id: 'completionist',
            icon: '🏆',
            secret: false,
            i18n: {
                en: { name: 'Completionist',    desc: 'Unlock every other achievement.' },
                fr: { name: 'Complétionniste',  desc: 'Débloquer tous les autres succès.' },
                de: { name: 'Komplettist',      desc: 'Alle anderen Erfolge freischalten.' },
                it: { name: 'Completista',      desc: 'Sbloccare tutti gli altri obiettivi.' },
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
            hintCta: 'Reveal a hint',
            revealNameCta: 'Reveal the name',
            hintLabel: 'Hint',
            fxHint: 'Click here to turn off the effects and achievements',
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
            hintCta: 'Révéler un indice',
            revealNameCta: 'Révéler le nom',
            hintLabel: 'Indice',
            fxHint: 'Cliquez ici pour désactiver les effets et les succès',
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
            hintCta: 'Hinweis aufdecken',
            revealNameCta: 'Namen aufdecken',
            hintLabel: 'Hinweis',
            fxHint: 'Hier klicken, um Effekte und Erfolge zu deaktivieren',
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
            hintCta: 'Rivela un indizio',
            revealNameCta: 'Rivela il nome',
            hintLabel: 'Indizio',
            fxHint: 'Clicca qui per disattivare effetti e obiettivi',
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

    // Hint progress for secret achievements. Stored as a map { id: level }, where
    // `level` counts how far the visitor has dug: 1..N reveal that many hints, and
    // N+1 (N = number of hints) reveals the real name + description. Persisted so
    // the progress survives reloads, separate from the unlocked map.
    const HINTS_KEY = 'achievements-hints';
    function loadHints() {
        try { return JSON.parse(localStorage.getItem(HINTS_KEY)) || {}; }
        catch (e) { return {}; }
    }
    function saveHints(map) { localStorage.setItem(HINTS_KEY, JSON.stringify(map)); }
    function hintLevel(id) {
        const n = loadHints()[id];
        return typeof n === 'number' && n > 0 ? n : 0;
    }
    function bumpHint(id) {
        const a = def(id);
        if (!a || !a.hints) return;
        const max = (a.hints.en || []).length + 1;   // hints + the final name reveal
        const map = loadHints();
        const next = Math.min(max, (map[id] || 0) + 1);
        map[id] = next;
        saveHints(map);
        renderPage();
    }

    /* =========================================================
       Unlock + toast
       ========================================================= */
    // Key under which a toast is deferred to the NEXT page (used by triggers that
    // navigate the current page away before the toast could be seen).
    const PENDING_KEY = 'achievement-pending-toast';

    // unlock(id) — records the achievement and pops its toast.
    // unlock(id, { deferToast: true }) — records it but hands the toast to the
    // next page load (the trigger is about to navigate away), via sessionStorage.
    function unlock(id, opts) {
        const a = def(id);
        if (!a) { console.warn('[achievements] unknown achievement id:', id); return false; }
        const state = load();
        if (state[id]) return false;            // already earned — no-op
        state[id] = new Date().toISOString();
        save(state);
        if (opts && opts.deferToast) {
            try { sessionStorage.setItem(PENDING_KEY, id); } catch (e) { /* ignore */ }
        } else {
            showToast(a);
        }
        updateFooterLink();
        renderPage();
        // On the 2nd unlock, nudge the visitor toward the effects/achievements
        // off-switch (once ever). Best-effort, ambient — see maybeShowEffectsHint.
        maybeShowEffectsHint();
        // Unlocking any regular achievement may complete the set -> the meta one.
        if (id !== 'completionist' && allOthersUnlocked()) unlock('completionist');
        return true;
    }

    // True once every achievement EXCEPT the meta 'completionist' is unlocked.
    function allOthersUnlocked() {
        const state = load();
        return ACHIEVEMENTS.every(function (a) {
            return a.id === 'completionist' || !!state[a.id];
        });
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
        // The completionist gets a special fanfare + confetti instead of the chime.
        if (a.id === 'completionist') {
            playTada();
            fireConfetti();
        } else {
            playSound();
        }

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
       "Turn off effects" nudge (shown once, on the 2nd unlock)
       ========================================================= */
    // A one-time pulsing callout with an arrow pointing at the header effects
    // toggle, telling the visitor they can switch the effects (and achievement
    // toasts) off. It is itself an ambient visual effect, so it is shown ONLY
    // when effects are on (when they are off there's nothing to advertise), and
    // its pulse respects prefers-reduced-motion via CSS.
    const FXHINT_KEY = 'achievements-fxhint-shown';
    function maybeShowEffectsHint() {
        if (document.documentElement.classList.contains('fx-off')) return;
        if (localStorage.getItem(FXHINT_KEY) === 'true') return;
        if (unlockedCount() < 2) return;
        localStorage.setItem(FXHINT_KEY, 'true');
        showEffectsHint(0);
    }

    function showEffectsHint(attempt) {
        // The toggle button is injected by effects-toggle.js on DOMContentLoaded;
        // if it isn't in the DOM yet, retry briefly before giving up.
        const btn = document.querySelector('.fx-toggle');
        if (!btn) {
            if (attempt < 20) setTimeout(function () { showEffectsHint(attempt + 1); }, 150);
            return;
        }
        const host = ensureToastHost();
        if (host.querySelector('.fx-hint-callout')) return;

        // Outer element only positions (centered under the button); the inner
        // element does the grow/shrink pulse, so the centering transform and the
        // pulse transform never fight.
        const el = document.createElement('div');
        el.className = 'fx-hint-callout';
        el.setAttribute('role', 'status');
        el.innerHTML =
            '<div class="fx-hint-pulse">' +
            '<span class="fx-hint-arrow" aria-hidden="true">↑</span>' +
            '<span class="fx-hint-text"></span>' +
            '</div>';
        el.querySelector('.fx-hint-text').textContent = strings().fxHint;
        host.appendChild(el);

        // Anchor the arrow just under the toggle, centered on the button, but
        // clamped so the centered text never spills off the right/left edge.
        function place() {
            const r = btn.getBoundingClientRect();
            el.style.top = (r.bottom + 6) + 'px';
            const half = (el.offsetWidth / 2) || 100;
            const cx = (r.left + r.right) / 2;
            const clamped = Math.max(half + 8, Math.min(window.innerWidth - half - 8, cx));
            el.style.left = clamped + 'px';
        }
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, { passive: true });

        requestAnimationFrame(function () { el.classList.add('show'); });

        let gone = false;
        function dismiss() {
            if (gone) return;
            gone = true;
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place);
            el.classList.remove('show');
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
        }
        el.addEventListener('click', dismiss);
        btn.addEventListener('click', dismiss, { once: true });
        setTimeout(dismiss, 7000);   // a short moment, then it fades on its own
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

    // Special "tada" fanfare for the completionist achievement.
    const TADA_SRC = (onSubpage ? '../' : '') + 'assets/audio/tada.wav';
    let tada = null;
    function preloadTada() {
        try { tada = new Audio(TADA_SRC); tada.preload = 'auto'; tada.load(); }
        catch (e) { tada = null; }
    }
    function playTada() {
        if (!tada) preloadTada();
        if (!tada) return;
        try {
            tada.currentTime = 0;
            tada.volume = 0.6;
            const p = tada.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) { /* ignore */ }
    }

    // One-shot confetti burst (vanilla canvas). It's a visual effect, so it honors
    // the effects toggle and reduced-motion. The canvas is pointer-events:none and
    // self-removes after the burst.
    function fireConfetti() {
        if (document.documentElement.classList.contains('fx-off')) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'achievement-confetti';
        Object.assign(canvas.style, {
            position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '9989',
        });
        function size() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        size();
        document.body.appendChild(canvas);
        window.addEventListener('resize', size);

        const ctx = canvas.getContext('2d');
        const colors = ['#e94560', '#4ade80', '#fbbf24', '#60a5fa', '#ff6b6b', '#ffffff'];
        const parts = [];
        for (let i = 0; i < 160; i++) {
            parts.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * canvas.height * 0.4,
                w: 5 + Math.random() * 6,
                h: 3 + Math.random() * 5,
                color: colors[(Math.random() * colors.length) | 0],
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 4,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.3,
            });
        }

        const DURATION = 4000;
        const start = performance.now();
        function frame(now) {
            const t = now - start;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
            for (const p of parts) {
                p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.angle += p.spin;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            if (t < DURATION) {
                requestAnimationFrame(frame);
            } else {
                window.removeEventListener('resize', size);
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }
        }
        requestAnimationFrame(frame);
    }

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

            // Hint progression (only for hidden secret achievements that define hints).
            const hintList = a.hints ? (a.hints[lang()] || a.hints.en) : null;
            const hasHints = hidden && Array.isArray(hintList) && hintList.length > 0;
            const level = hasHints ? hintLevel(a.id) : 0;
            const nHints = hasHints ? hintList.length : 0;
            const nameRevealed = hasHints && level > nHints;   // the final step shows name + desc

            const card = document.createElement('article');
            card.className = 'achievement-card ' + (got ? 'is-unlocked' : 'is-locked')
                + (hidden ? ' is-secret' : '');

            const icon = document.createElement('div');
            icon.className = 'achievement-card-icon';
            icon.textContent = (hidden && !nameRevealed) ? '🔒' : a.icon;

            const body = document.createElement('div');
            body.className = 'achievement-card-body';

            const name = document.createElement('h3');
            name.className = 'achievement-card-name';
            name.textContent = (hidden && !nameRevealed) ? s.secretName : t.name;

            const desc = document.createElement('p');
            desc.className = 'achievement-card-desc';
            desc.textContent = (hidden && !nameRevealed) ? s.secretDesc : t.desc;

            body.appendChild(name);
            body.appendChild(desc);

            // Revealed hints + the button to dig further (3 hints, then the name).
            if (hasHints) {
                if (level > 0) {
                    const list = document.createElement('ol');
                    list.className = 'achievement-hints';
                    for (let i = 0; i < Math.min(level, nHints); i++) {
                        const li = document.createElement('li');
                        li.className = 'achievement-hint';
                        li.textContent = hintList[i];
                        list.appendChild(li);
                    }
                    body.appendChild(list);
                }
                if (level <= nHints) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'achievement-hint-btn';
                    btn.textContent = (level < nHints)
                        ? s.hintCta + ' (' + level + '/' + nHints + ')'
                        : s.revealNameCta;
                    btn.addEventListener('click', function () { bumpHint(a.id); });
                    body.appendChild(btn);
                }
            }

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
            localStorage.removeItem(PAGEVIEWS_KEY);
            localStorage.removeItem(HINTS_KEY);
            localStorage.removeItem(FXHINT_KEY);
            try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
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

        // Opening a blog article counts as a read. Article pages are explicitly
        // tagged with `data-article` on <html> (project/experience pages are not),
        // so this never fires on a non-article page.
        if (document.documentElement.hasAttribute('data-article')) unlock('read-article');

        // Opening the education page (tagged with `data-education` on <html>).
        if (document.documentElement.hasAttribute('data-education')) unlock('education');

        // Opening a work experience page (tagged with `data-experience` on <html>).
        if (document.documentElement.hasAttribute('data-experience')) unlock('experience');

        setupGameAchievement();
        setupYoutubeAchievement();
        setupCvAchievement();
        setupContactAchievement();
        setupLanguageAchievement();
        setupDevtoolsAchievement();
        setupHorrorAchievement();
        trackPageViews();

        // Catch the case where every other achievement is already unlocked.
        if (!isUnlocked('completionist') && allOthersUnlocked()) unlock('completionist');

        // A toast handed over from the previous page (a navigating trigger).
        consumePendingToast();
    }

    // Unlock 'play-game' when the visitor opens one of the published games (the
    // itch.io cards in the homepage "Published Games" section, #projects).
    function setupGameAchievement() {
        if (isUnlocked('play-game')) return;
        document.querySelectorAll('#projects a.card').forEach(function (card) {
            card.addEventListener('click', function () { unlock('play-game'); });
        });
    }

    // Unlock 'youtube' (the "Mystery" achievement) when the visitor clicks the
    // "YouTube Channel Manager" experience card. That card navigates away (to the
    // 404 for now), so the toast is deferred to the page it lands on.
    function setupYoutubeAchievement() {
        if (isUnlocked('youtube')) return;
        const cards = document.querySelectorAll('#experience a.experience-card');
        cards.forEach(function (card) {
            if (card.querySelector('[data-i18n="experience.youtube.title"]')) {
                card.addEventListener('click', function () {
                    unlock('youtube', { deferToast: true });
                });
            }
        });
    }

    // Unlock 'horror' when the visitor turns on "The 13th Hour" horror mode. The
    // console `horror` command fires a `horrorchange` event; we also catch the
    // case where the mode is already active on load (persisted via localStorage,
    // applied as the `theme-horror` class before this runs).
    function setupHorrorAchievement() {
        if (isUnlocked('horror')) return;
        if (document.documentElement.classList.contains('theme-horror')) unlock('horror');
        window.addEventListener('horrorchange', function (e) {
            if (e && e.detail && e.detail.on) unlock('horror');
        });
    }

    // Unlock 'devtools' when the visitor opens the browser developer tools.
    // Detection is best-effort (browsers expose no real signal):
    //  1) keyboard shortcuts — F12, Ctrl/Cmd+Shift+I/J/C (caught before the
    //     browser handles them);
    //  2) a window-size heuristic — when DevTools dock, inner vs outer size jumps
    //     past a threshold (catches right-click → Inspect and docking). Undocked
    //     DevTools in a separate window can't be detected this way.
    function setupDevtoolsAchievement() {
        if (isUnlocked('devtools')) return;

        window.addEventListener('keydown', function (e) {
            const k = (e.key || '').toLowerCase();
            const isF12 = k === 'f12';
            const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey
                && (k === 'i' || k === 'j' || k === 'c');
            if (isF12 || isInspect) unlock('devtools');
        }, true);

        const THRESH = 160;
        let done = false;
        function check() {
            if (done || isUnlocked('devtools')) { done = true; cleanup(); return; }
            const wGap = window.outerWidth - window.innerWidth > THRESH;
            const hGap = window.outerHeight - window.innerHeight > THRESH;
            // DevTools docked to a side (wGap) or bottom (hGap), but not both
            // (a small popup window). The threshold steps over normal chrome.
            if ((wGap || hGap) && !(wGap && hGap)) {
                done = true;
                unlock('devtools');
                cleanup();
            }
        }
        const timer = setInterval(check, 1000);
        window.addEventListener('resize', check);
        function cleanup() {
            clearInterval(timer);
            window.removeEventListener('resize', check);
        }
        check();
    }

    // Unlock 'language' on a real language change. We wrap I18n.switchLanguage —
    // the single chokepoint used by the EN/FR/DE/IT buttons AND the console `lang`
    // command — so any method counts, but only an actual switch (not the auto
    // detection at page load, which never calls switchLanguage). Falls back to
    // listening on the language buttons if I18n isn't available.
    function setupLanguageAchievement() {
        if (isUnlocked('language')) return;
        if (typeof I18n !== 'undefined' && typeof I18n.switchLanguage === 'function') {
            const original = I18n.switchLanguage.bind(I18n);
            I18n.switchLanguage = function (lang) {
                const changed = lang !== I18n.currentLang
                    && I18n.supportedLangs && I18n.supportedLangs.indexOf(lang) !== -1;
                const result = original(lang);
                if (changed) unlock('language');
                return result;
            };
        } else {
            document.querySelectorAll('.lang-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const lang = btn.getAttribute('data-lang');
                    if (lang && lang !== lang_current()) unlock('language');
                });
            });
        }
    }
    function lang_current() {
        return (typeof I18n !== 'undefined' && I18n.currentLang) || lang();
    }

    // Unlock 'contact' when the visitor clicks an email (mailto:) link — the
    // contact-section "Send Email" button and the footer "Email" link.
    function setupContactAchievement() {
        if (isUnlocked('contact')) return;
        document.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
            link.addEventListener('click', function () { unlock('contact'); });
        });
    }

    // Count every page load (one per init) and unlock 'globe-trotter' at 10.
    // Revisits and the homepage all count, exactly like opening pages.
    const PAGEVIEWS_KEY = 'achievements-pageviews';
    function trackPageViews() {
        if (isUnlocked('globe-trotter')) return;
        let n = parseInt(localStorage.getItem(PAGEVIEWS_KEY) || '0', 10);
        if (isNaN(n)) n = 0;
        n += 1;
        localStorage.setItem(PAGEVIEWS_KEY, String(n));
        if (n >= 10) unlock('globe-trotter');
    }

    // Unlock 'cv' when the visitor opens the CV PDF (linked from the header,
    // footer and contact section — all open in a new tab).
    function setupCvAchievement() {
        if (isUnlocked('cv')) return;
        document.querySelectorAll('a[href*="documents/CV"]').forEach(function (link) {
            link.addEventListener('click', function () { unlock('cv'); });
        });
    }

    // Show a toast that a navigating trigger stored for this page, then clear it.
    function consumePendingToast() {
        let id;
        try { id = sessionStorage.getItem(PENDING_KEY); } catch (e) { return; }
        if (!id) return;
        try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
        const a = def(id);
        if (a) showToast(a);
    }

    // Unlock 'reach-bottom' once the visitor scrolls to the bottom of the HOMEPAGE
    // only. Ignores pages too short to scroll (so it can't fire without real
    // scrolling).
    function isHomepage() {
        const p = location.pathname.toLowerCase();
        return p === '' || p === '/' || p.endsWith('/index.html');
    }
    function setupScrollAchievement() {
        if (!isHomepage()) return;
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
