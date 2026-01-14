/**
 * Internationalization (i18n) System - Modular Version
 * Handles language switching with split JSON translation files
 *
 * File structure:
 *   locales/{lang}/common.json    - Shared translations (nav, footer, etc.)
 *   locales/{lang}/home.json      - Homepage content
 *   locales/{lang}/pages/*.json   - Page-specific content
 */

const I18n = {
    currentLang: 'en',
    translations: {},
    supportedLangs: ['en', 'fr', 'de', 'it'],
    loadedModules: new Set(),

    /**
     * Initialize the i18n system
     */
    async init() {
        // Get saved language or detect from browser
        const savedLang = localStorage.getItem('preferred-lang');
        const browserLang = navigator.language.split('-')[0];

        // Priority: saved > browser > default (en)
        if (savedLang && this.supportedLangs.includes(savedLang)) {
            this.currentLang = savedLang;
        } else if (this.supportedLangs.includes(browserLang)) {
            this.currentLang = browserLang;
        }

        // Load translations and apply
        await this.loadAllModules(this.currentLang);
        this.applyTranslations();
        this.updateLanguageSelector();
    },

    /**
     * Get the base path for locales (handles both root and pages/ directory)
     */
    getBasePath() {
        const path = window.location.pathname;
        // Check if we're in a subdirectory (e.g., /pages/)
        if (path.includes('/pages/')) {
            return '../locales';
        }
        return 'locales';
    },

    /**
     * Load all required modules for the current page
     */
    async loadAllModules(lang) {
        this.translations = {};
        this.loadedModules.clear();

        const basePath = this.getBasePath();

        // Always load common translations
        await this.loadModule(lang, 'common', basePath);

        // Detect which page module to load based on data attribute or URL
        const pageModule = this.detectPageModule();
        if (pageModule) {
            await this.loadModule(lang, pageModule, basePath);
        }

        this.currentLang = lang;
    },

    /**
     * Detect which page module to load based on page attribute or URL
     */
    detectPageModule() {
        // First check for explicit data-i18n-module attribute on html or body
        const moduleAttr = document.documentElement.dataset.i18nModule ||
                          document.body?.dataset?.i18nModule;
        if (moduleAttr) {
            return moduleAttr;
        }

        // Auto-detect based on URL
        const path = window.location.pathname.toLowerCase();

        // Homepage
        if (path.endsWith('/') || path.endsWith('/index.html') || path === '') {
            return 'home';
        }

        // Aer Racers pages
        if (path.includes('aer-racers')) {
            return 'pages/aer-racers';
        }

        // Default to home for unknown pages (will have common translations anyway)
        return 'home';
    },

    /**
     * Load a specific translation module
     */
    async loadModule(lang, moduleName, basePath) {
        if (this.loadedModules.has(moduleName)) {
            return; // Already loaded
        }

        try {
            const response = await fetch(`${basePath}/${lang}/${moduleName}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${moduleName}.json for ${lang}`);
            }
            const moduleTranslations = await response.json();

            // Merge with existing translations
            this.translations = { ...this.translations, ...moduleTranslations };
            this.loadedModules.add(moduleName);
        } catch (error) {
            console.warn(`Could not load module ${moduleName} for ${lang}:`, error.message);

            // Fallback to English if not already trying English
            if (lang !== 'en') {
                try {
                    const fallbackResponse = await fetch(`${basePath}/en/${moduleName}.json`);
                    if (fallbackResponse.ok) {
                        const fallbackTranslations = await fallbackResponse.json();
                        this.translations = { ...this.translations, ...fallbackTranslations };
                        this.loadedModules.add(moduleName);
                    }
                } catch (fallbackError) {
                    console.error(`Fallback also failed for ${moduleName}:`, fallbackError.message);
                }
            }
        }
    },

    /**
     * Get a translation by key path (e.g., "hero.title")
     */
    t(keyPath) {
        const keys = keyPath.split('.');
        let value = this.translations;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`Translation not found: ${keyPath}`);
                return keyPath;
            }
        }

        return value;
    },

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            if (translation && translation !== key) {
                // Check if we should update innerHTML or textContent
                if (el.hasAttribute('data-i18n-html')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update placeholder attributes
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                el.placeholder = translation;
            }
        });

        // Update title attributes
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation && translation !== key) {
                el.title = translation;
            }
        });

        // Update document lang attribute
        document.documentElement.lang = this.currentLang;
    },

    /**
     * Switch to a new language
     */
    async switchLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) {
            console.error(`Unsupported language: ${lang}`);
            return;
        }

        if (lang === this.currentLang) return;

        // Save preference
        localStorage.setItem('preferred-lang', lang);

        // Load and apply new translations
        await this.loadAllModules(lang);
        this.applyTranslations();
        this.updateLanguageSelector();
    },

    /**
     * Update the language selector UI to show current language
     */
    updateLanguageSelector() {
        const selector = document.querySelector('.lang-selector');
        if (!selector) return;

        // Update active state on language buttons
        const buttons = selector.querySelectorAll('.lang-btn');
        buttons.forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            btn.classList.toggle('active', lang === this.currentLang);
        });

        // Update current language display if exists
        const currentDisplay = selector.querySelector('.lang-current');
        if (currentDisplay) {
            currentDisplay.textContent = this.currentLang.toUpperCase();
        }
    },

    /**
     * Dynamically load an additional module (for lazy loading)
     */
    async loadAdditionalModule(moduleName) {
        const basePath = this.getBasePath();
        await this.loadModule(this.currentLang, moduleName, basePath);
        this.applyTranslations();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});

// Handle language button clicks
document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('.lang-btn');
    if (langBtn) {
        const lang = langBtn.getAttribute('data-lang');
        I18n.switchLanguage(lang);
    }
});
