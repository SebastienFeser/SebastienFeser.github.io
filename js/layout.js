/**
 * Shared site layout (header + footer).
 *
 * There is no build step and no server-side templating on this site, so the
 * header and footer used to be hand-copied into every HTML file, and they
 * drifted apart over time. This script is the SINGLE source of truth for both:
 * every page just loads it and gets the exact same header + footer injected.
 *
 * To change the header or footer site-wide, edit ONLY this file.
 *
 * Loaded FIRST in the script block (before effects-toggle.js), because:
 *   - effects-toggle.js injects its button into `.header-content`;
 *   - achievements.js injects a link into `.site-footer`;
 *   - i18n.js translates the `data-i18n` elements inside both.
 * Those scripts all act on DOMContentLoaded, so as long as we insert the markup
 * synchronously here (this script sits at the end of <body>, so the DOM already
 * exists), they will all find their targets.
 *
 * Relative paths are computed automatically from the page's depth, so the same
 * markup works from the site root (index.html) and from pages/ subpages.
 */
(function () {
    'use strict';

    /* ---- Work out where we are so links resolve from any depth ---- */
    // Pages live either at the site root or under /pages/. Detect the depth
    // from the stylesheet link (../css on subpages, css on the root), falling
    // back to the URL path.
    const cssHref = (document.querySelector('link[rel="stylesheet"]') || {}).getAttribute
        ? document.querySelector('link[rel="stylesheet"]').getAttribute('href') || ''
        : '';
    const inPages = cssHref.indexOf('../') === 0 || /\/pages\//.test(location.pathname);

    const prefix = inPages ? '../' : '';            // -> assets, CV, index.html
    const path = location.pathname.replace(/\\/g, '/');
    const isHome = !inPages && (/\/$/.test(path) || /index\.html$/i.test(path));

    // Base for the main-nav anchors. On the homepage they are same-page anchors
    // (#about); everywhere else they jump back to the homepage (../index.html#about).
    const navBase = isHome ? '' : prefix + 'index.html';

    /* ---- Markup (defined once) ---- */
    const headerHTML =
        '<header class="site-header">' +
            '<div class="header-content">' +
                '<a href="' + prefix + 'index.html" class="site-logo">SF</a>' +
                '<button class="mobile-menu-toggle" aria-label="Menu" aria-expanded="false">' +
                    '<span></span><span></span><span></span>' +
                '</button>' +
                '<nav class="main-nav">' +
                    '<a href="' + navBase + '#about" class="nav-link" data-i18n="nav.about">About</a>' +
                    '<a href="' + navBase + '#blog" class="nav-link" data-i18n="nav.blog">Blog</a>' +
                    '<a href="' + navBase + '#projects" class="nav-link" data-i18n="nav.projects">Projects</a>' +
                    '<a href="' + navBase + '#experience" class="nav-link" data-i18n="nav.experience">Experience</a>' +
                    '<a href="' + navBase + '#skills" class="nav-link" data-i18n="nav.skills">Skills</a>' +
                    '<a href="' + navBase + '#contact" class="nav-link" data-i18n="nav.contact">Contact</a>' +
                '</nav>' +
                '<div class="social-links">' +
                    '<a href="https://github.com/SebastienFeser" target="_blank" rel="noopener noreferrer" class="social-link" title="GitHub">' +
                        '<img src="' + prefix + 'assets/images/GithubLogoWhite.svg" alt="GitHub">' +
                    '</a>' +
                    '<a href="https://www.linkedin.com/in/s%C3%A9bastien-feser-a89727191/" target="_blank" rel="noopener noreferrer" class="social-link" title="LinkedIn">' +
                        '<img src="' + prefix + 'assets/images/LinkedInLogoWhite.svg" alt="LinkedIn">' +
                    '</a>' +
                    '<a href="' + prefix + 'assets/documents/CV_EN.pdf" target="_blank" class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.9rem;">CV</a>' +
                    '<div class="lang-selector">' +
                        '<button class="lang-btn" data-lang="en">EN</button>' +
                        '<button class="lang-btn" data-lang="fr">FR</button>' +
                        '<button class="lang-btn" data-lang="de">DE</button>' +
                        '<button class="lang-btn" data-lang="it">IT</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</header>';

    const footerHTML =
        '<footer class="site-footer">' +
            '<div class="footer-links">' +
                '<a href="https://github.com/SebastienFeser" target="_blank" rel="noopener noreferrer">GitHub</a>' +
                '<a href="https://www.linkedin.com/in/s%C3%A9bastien-feser-a89727191/" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
                '<a href="' + prefix + 'assets/documents/CV_EN.pdf" target="_blank">CV</a>' +
                '<a href="mailto:sebastien.feser@gmail.com">Email</a>' +
            '</div>' +
            '<p class="mt-2">&copy; <span data-i18n="footer.copyright">2026 Sebastien Feser. Built with passion.</span></p>' +
        '</footer>';

    function el(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html.trim();
        return tpl.content.firstElementChild;
    }

    function inject() {
        // Idempotent + safe during migration: drop any header/footer already in
        // the page (old hand-copied ones, or a previous run) before inserting.
        document.querySelectorAll('header.site-header').forEach(function (n) { n.remove(); });
        document.querySelectorAll('footer.site-footer').forEach(function (n) { n.remove(); });

        const header = el(headerHTML);
        document.body.insertBefore(header, document.body.firstChild);

        const footer = el(footerHTML);
        const main = document.querySelector('main');
        if (main && main.parentNode) {
            main.parentNode.insertBefore(footer, main.nextSibling);
        } else {
            document.body.appendChild(footer);
        }

        wireMobileMenu();
    }

    // Mobile hamburger menu (previously inline on index.html only — now works on
    // every page because the header is shared).
    function wireMobileMenu() {
        const menuToggle = document.querySelector('.mobile-menu-toggle');
        const mainNav = document.querySelector('.main-nav');
        if (!menuToggle || !mainNav) return;

        menuToggle.addEventListener('click', function () {
            const isOpen = mainNav.classList.toggle('mobile-open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        mainNav.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                mainNav.classList.remove('mobile-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    if (document.body) {
        inject();
    } else {
        document.addEventListener('DOMContentLoaded', inject);
    }
})();
