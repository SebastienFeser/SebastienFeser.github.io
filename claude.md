# Sebastien Feser - Portfolio Website

## Project Overview

Personal portfolio website for Sebastien Feser, a Game Engineer specializing in gameplay programming, team leadership, and AI-augmented development.

## Tech Stack

- **HTML5** - Semantic markup with accessibility in mind
- **CSS3** - Custom properties, Flexbox, Grid, responsive design
- **Vanilla JavaScript** - No frameworks, minimal JS
- **No build process** - Static site, opens directly in browser

## Visual Effects System

The site has a global **visual-effects toggle** in the header (a button injected
by `js/effects-toggle.js`). It lets visitors turn ALL ambient visual effects on/off,
and remembers the choice in `localStorage` (key `effects-enabled`).

### IMPORTANT: Every new visual effect MUST be disableable by the toggle

**Whenever you add a new visual effect (CSS animation, JS animation, canvas/WebGL,
parallax, particles, glitch, tilt, etc.), it MUST be wired into the toggle so it
turns off with the button.** No exception.

How the toggle works:
- `effects-toggle.js` loads **first** (before all other effect scripts) and adds
  the class `fx-off` to `<html>` when effects are disabled. It is the single source
  of truth.

To make a new effect respect the toggle:

1. **CSS effects** - gate them under `.fx-off`:
   ```css
   .fx-off .my-effect {
       animation: none !important;
       transform: none !important;
       filter: none !important;
   }
   ```

2. **JS effects** - bail out early when disabled:
   ```js
   // Treat the toggle exactly like prefers-reduced-motion.
   if (document.documentElement.classList.contains('fx-off')) return;
   ```
   Load the script AFTER `effects-toggle.js` (it already is, since the toggle is
   the first `<script>` in the block). If you add a new effect script, place its
   `<script>` tag after `js/effects-toggle.js` on every page.

3. **Accessibility** - also respect `prefers-reduced-motion: reduce` (disable or
   tone down the effect), and keep flashing under 3 flashes/second (WCAG seizure
   threshold). The toggle is an extra opt-out, not a replacement for this.

The Konami-code easter egg (`konami-physics.js`) is intentionally NOT gated by the
toggle: it's a deliberate, user-triggered surprise, not an ambient effect.

### Files involved

| File | Role |
|------|------|
| `js/effects-toggle.js` | Injects the button, stores state, sets `fx-off` class |
| `css/style.css` | `.fx-off ...` rules + `.fx-toggle` button styling |
| `js/hero-shader.js`, `js/animations.js`, `js/card-tilt.js` | Effect scripts that check `fx-off` |

## Internationalization (i18n) System

The site supports 4 languages: English, French, German, and Italian.

### Modular File Structure

Translation files are split into modules for optimized loading:

```
locales/
├── en/
│   ├── common.json       # Shared: nav, footer, contact, error, skills, sections
│   ├── home.json         # Homepage: hero, games, projects, education, experience
│   └── pages/
│       └── aer-racers.json   # All Aer Racers pages content
├── fr/
│   ├── common.json
│   ├── home.json
│   └── pages/
│       └── aer-racers.json
├── de/
│   └── ...
└── it/
    └── ...
```

### How It Works

1. **JavaScript handler** in `js/i18n.js` that:
   - Detects browser language on first visit
   - Saves user preference in `localStorage`
   - **Loads `common.json` on every page** (nav, footer, etc.)
   - **Auto-detects page module** based on URL or `data-i18n-module` attribute
   - Replaces content of elements with `data-i18n` attribute

2. **Language selector** in the header (EN | FR | DE | IT buttons)

### Module Auto-Detection

The system automatically loads the right module based on URL:
- `index.html` or `/` -> loads `home.json`
- `pages/aer-racers*.html` -> loads `pages/aer-racers.json`
- Other pages -> loads `home.json` (default)

You can override with: `<html data-i18n-module="pages/custom-module">`

### Usage

Add `data-i18n` attribute to any element you want to translate:

```html
<h2 data-i18n="sections.experience">Professional Experience</h2>
<p data-i18n="hero.description">I build game engines...</p>
```

The key path (e.g., `sections.experience`) corresponds to the JSON structure:

```json
{
  "sections": {
    "experience": "Professional Experience"
  }
}
```

### Adding a New Translation

**For common content** (appears on all pages):
1. Add the key to `locales/{lang}/common.json` for all 4 languages
2. Add `data-i18n="your.key.path"` to the HTML element

**For homepage content**:
1. Add the key to `locales/{lang}/home.json` for all 4 languages
2. Add `data-i18n="your.key.path"` to the HTML element

**For page-specific content**:
1. Create or edit `locales/{lang}/pages/your-page.json` for all 4 languages
2. Add `data-i18n-module="pages/your-page"` to the `<html>` tag
3. Add `data-i18n="your.key.path"` to HTML elements

### Adding a New Page Module

1. Create `locales/en/pages/new-page.json` with your translations
2. Copy to fr, de, it folders with translated content
3. In your HTML: `<html data-i18n-module="pages/new-page">`
4. Or rely on auto-detection if URL contains the page name

### IMPORTANT: Multilingual Requirement

**Every new page or text content must be multilingual.** When creating or modifying pages:

1. Add `data-i18n` attributes to all translatable text
2. Add corresponding keys to the appropriate module in ALL 4 languages
3. Include the language selector in the header
4. Include `<script src="js/i18n.js"></script>` before `</body>`
5. Test all 4 languages after changes
6. **ALWAYS use proper accents and special characters in translations:**
   - French: é, è, ê, ë, à, â, ù, û, ô, î, ï, ç, œ, æ (e.g., "Expérience", "À propos", "Télécharger")
   - German: ä, ö, ü, ß (e.g., "Über", "Fähigkeiten", "Zurück", "für")
   - Italian: à, è, é, ì, ò, ù (e.g., "Perché", "è", "più")
   - Use Unicode characters directly in JSON files, NOT HTML entities
7. **Translations must sound natural in each language:**
   - Don't translate word-for-word - adapt the meaning to sound natural
   - Stay as close as possible to the original meaning
   - Example: "I build game engines and deliver polished gameplay" should NOT be "Je construis des game engines et livre du gameplay soigné" (too literal) but rather "Je conçois des moteurs de jeu et développe du gameplay abouti" (natural French)

### Modifying Translations

Edit the corresponding JSON file in `locales/{lang}/`. Example for French common content:

```json
// locales/fr/common.json
"contact": {
  "title": "Travaillons ensemble",
  "email": "Envoyer un email"
}
```

### CSS Classes

- `.lang-selector` - Container for language buttons
- `.lang-btn` - Individual language button
- `.lang-btn.active` - Currently selected language (accent color)

### Lazy Loading Additional Modules

You can dynamically load additional modules with JavaScript:

```javascript
// Load additional translations when needed
await I18n.loadAdditionalModule('pages/extra-content');
```

## Design System

Dark theme inspired by modern tech blogs. Design tokens in `css/style.css`:

### Colors
```css
--bg-primary: #1a1a2e      /* Main background */
--bg-secondary: #16213e    /* Cards, sections */
--bg-tertiary: #0f0f1a     /* Code blocks */
--accent: #e94560          /* Primary accent (red/pink) */
--accent-hover: #ff6b6b    /* Accent hover state */
--text-primary: #eaeaea    /* Main text */
--text-secondary: #a0a0a0  /* Secondary text */
--text-muted: #6b7280      /* Muted text */
--success: #4ade80         /* Current/active badges */
--warning: #fbbf24         /* Warning callouts */
--info: #60a5fa            /* Info callouts */
```

### Typography
- Body: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- Code: 'Cascadia Code', 'Fira Code', Consolas, monospace
- Base: 16px (14px on mobile)

## File Structure

```
MyNewWebsite/
├── index.html              # Homepage (main file)
├── claude.md               # Project documentation
├── css/
│   └── style.css           # Global stylesheet (~1400 lines)
├── pages/                  # Individual project pages
│   ├── aer-racers.html
│   ├── bachelor-thesis.html
│   ├── neko-engine.html
│   ├── networking-fps.html
│   ├── mon-eco-pote.html
│   ├── athena-technologies.html
│   └── youtube-channel.html
├── assets/
│   ├── images/             # All images
│   │   ├── GithubLogoWhite.svg
│   │   ├── LinkedInLogoWhite.svg
│   │   └── [project thumbnails - to add]
│   ├── videos/             # Game preview videos (MP4)
│   │   ├── Dreamness.mp4
│   │   ├── The13thHour.mp4
│   │   ├── ForgotenHero.mp4
│   │   └── GravityPunk.mp4
│   └── documents/          # PDFs
│       └── CV.pdf
└── Old files/              # Archived old website
```

## Page Sections (index.html)

1. **Header** - Sticky navigation with logo, nav links, social icons
2. **Hero** - Enhanced hero with avatar, description, CTAs, stats
3. **Featured Project** - Highlighted Aer Racers project
4. **Published Games** - 4 game jam projects with videos
5. **Technical Projects** - Academic/engine work with placeholders
6. **Education** - BSc Games Programming card
7. **Experience** - Timeline of professional roles
8. **Skills** - Categorized by type (Languages, Game Dev, Web, Creative)
9. **Contact** - CTA section with buttons
10. **Footer** - Links and copyright

## Key CSS Components

### Layout
- `.container` - 900px max-width
- `.container-wide` - 1200px max-width
- `.section` - Standard section spacing

### Hero
- `.hero-enhanced` - Two-column hero layout
- `.hero-avatar` - Circular avatar (200px)
- `.hero-stats` - Stats row with numbers

### Featured
- `.featured-project` - Large highlighted project card
- `.featured-highlights` - Icon + text highlights

### Cards
- `.card` - Standard project card
- `a.card` - Accessible link-based card
- `.card-video`, `.card-image` - Media elements

### Skills
- `.skills-section` - Grid of skill categories
- `.skills-category` - Category box with title
- `.skill-tag` - Individual skill badge

### Experience
- `.experience-grid` - List of experience cards
- `.experience-card` - Individual role card
- `.experience-card.current` - Green border for current roles

### Contact
- `.contact-section` - Gradient CTA section
- `.contact-links` - Button row

## Placeholders to Replace

1. **Hero Avatar** - Replace `<div class="hero-avatar">SF</div>` with:
   ```html
   <div class="hero-avatar">
       <img src="assets/images/profile.jpg" alt="Sebastien Feser">
   </div>
   ```

2. **Featured Project Image** - Add `assets/images/aer-racers-hero.png`

3. **Technical Project Thumbnails**:
   - `assets/images/bachelor-thesis.png`
   - `assets/images/neko-engine.png`
   - `assets/images/networking-fps.png`

4. **OG Image** - `assets/images/og-image-placeholder.png` (1200x630px)

5. **Email** - Update `mailto:sebastien.feser@gmail.com` if needed

## Accessibility Features

- All cards use `<a>` elements instead of `onclick`
- `rel="noopener noreferrer"` on external links
- Alt text on images
- Semantic HTML structure
- Focus states for keyboard navigation
- Color contrast meets WCAG AA

## SEO Features

- Meta description and keywords
- Open Graph tags for social sharing
- Twitter Card meta tags
- Semantic HTML (header, main, section, nav, footer)
- Inline SVG favicon

## Creating New Project Pages

Use this template in `pages/`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Name | Sebastien Feser</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <header class="site-header">
        <div class="header-content">
            <a href="../index.html" class="site-logo">SF</a>
            <nav class="main-nav">
                <a href="../index.html" class="nav-link">Home</a>
                <a href="../index.html#projects" class="nav-link">Projects</a>
                <a href="../index.html#contact" class="nav-link">Contact</a>
            </nav>
        </div>
    </header>

    <main>
        <div class="container">
            <header class="article-header">
                <span class="hero-badge">Category</span>
                <h1>Project Title</h1>
                <p class="hero-subtitle">Short description</p>
            </header>

            <article class="article-content">
                <p class="lead">Introduction paragraph...</p>

                <h2>Section Title</h2>
                <p>Content...</p>

                <!-- Add images, code blocks, callouts as needed -->
            </article>

            <nav class="nav-links">
                <a href="../index.html" class="nav-link-btn">&larr; Back to Home</a>
            </nav>
        </div>
    </main>

    <footer class="site-footer">
        <p>&copy; 2025 Sebastien Feser</p>
    </footer>
</body>
</html>
```

## Creating Blog Posts

Chaque nouveau blog post doit être ajouté à **deux endroits** :

### 1. Page Blog (`pages/blog.html`)

Ajouter un élément `.blog-list-item` dans la section appropriée (existante ou nouvelle) :

```html
<!-- Dans la section appropriée, à l'intérieur de <div class="blog-list"> -->
<a href="your-blog-post.html" class="blog-list-item">
    <div class="blog-list-content">
        <span class="blog-badge" data-i18n="blog.yourpost.badge">Category</span>
        <h3 class="blog-list-title" data-i18n="blog.yourpost.title">Post Title</h3>
        <p class="blog-list-description" data-i18n="blog.yourpost.description">Description...</p>
    </div>
    <span class="blog-list-date">2024</span>
</a>
```

**Emplacement** : À l'intérieur d'une `<section class="blog-section">`, dans le `<div class="blog-list">`.

### 2. Page Principale (`index.html`)

Ajouter une carte dans la grille de blog pour afficher un aperçu :

```html
<!-- Dans la section #blog, à l'intérieur de <div class="blog-grid"> -->
<a href="pages/your-blog-post.html" class="blog-card">
    <span class="blog-badge" data-i18n="blog.yourpost.badge">Category</span>
    <h3 class="blog-title" data-i18n="blog.yourpost.title">Post Title</h3>
    <p class="blog-description" data-i18n="blog.yourpost.description">Description...</p>
    <span class="blog-date">2024</span>
</a>
```

**Emplacement** : Section `#blog` (ligne ~109), à l'intérieur de `<div class="blog-grid">` (ligne ~113).

### Checklist pour un nouveau blog post

1. Créer la page du blog post dans `pages/`
2. Ajouter les traductions dans `locales/{lang}/pages/blog.json` (4 langues)
3. Ajouter le `.blog-list-item` dans `pages/blog.html`
4. Ajouter le `.blog-card` dans `index.html` section `#blog`
5. Vérifier les 4 langues

### Fichiers concernés

| Fichier | Description |
|---------|-------------|
| `pages/blog.html` | Liste complète des blog posts |
| `index.html` (section `#blog`) | Aperçus des derniers posts sur la page d'accueil |
| `locales/{lang}/pages/blog.json` | Traductions des posts (titres, descriptions, badges) |
| `locales/{lang}/home.json` | Traductions pour les aperçus sur la homepage |

## Responsive Breakpoints

- **Desktop**: > 768px (full layout)
- **Tablet**: 481px - 768px (stacked hero, single-column cards)
- **Mobile**: < 480px (compact stats, smaller avatar)

## TODO / Future Improvements

- [ ] Add real profile photo
- [ ] Add project thumbnails/screenshots
- [ ] Create individual project pages
- [ ] Add dark/light theme toggle
- [ ] Add blog section
- [ ] Optimize images (WebP format)
- [ ] Add real favicon file
- [ ] Add analytics (if needed)
- [ ] Consider adding animations/transitions

## Development Notes

1. Test on mobile before deploying
2. Keep videos under 10MB
3. Use relative paths for all assets
4. Update OG image when deploying
5. Verify all external links work
6. Check email address is correct
