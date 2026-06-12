# Améliorations pour sebastienfeser.ch

Objectif : vitrine perso / freelance + plaisir de coder. Plusieurs petites touches, sans framework (HTML/CSS/JS pur).

Ordre conseillé : **1 → 2 → 3** (signature + polish), puis **4 → 5 → 6** en dessert.

---

## 1. Shader GLSL en fond du hero ⭐ (ta signature)

Un fond WebGL animé derrière ton nom. Subtil et sombre. Tu listes GLSL dans tes skills — là tu le *montres*.

**HTML** — ajoute le canvas en premier enfant de ta section hero :

```html
<canvas id="hero-shader"></canvas>
```

**CSS** :

```css
#hero-shader {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
/* assure-toi que le contenu du hero est au-dessus */
.hero-content { position: relative; z-index: 1; }
```

**JS** (fragment shader type "plasma sombre", réactif au temps) :

```js
const canvas = document.getElementById('hero-shader');
const gl = canvas.getContext('webgl');

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

const vert = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const frag = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  uv.x *= u_res.x / u_res.y;
  float t = u_time * 0.15;
  float v = sin(uv.x * 3.0 + t)
          + sin(uv.y * 4.0 - t)
          + sin((uv.x + uv.y) * 2.5 + t * 1.3);
  v *= 0.33;
  vec3 col = mix(vec3(0.04, 0.05, 0.09), vec3(0.10, 0.16, 0.30), v * 0.5 + 0.5);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, 'u_res');
const uTime = gl.getUniformLocation(prog, 'u_time');

function render(time) {
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, time * 0.001);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

**Astuce perf** : ajoute `if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;` au début pour respecter les préférences d'accessibilité, et coupe la boucle quand le hero n'est plus visible (IntersectionObserver).

---

## 2. Compteurs animés + reveal au scroll

Tes chiffres (19+ / 5+ / 25) qui s'incrémentent à l'apparition, et tes sections en fondu/glissement. `IntersectionObserver` natif, zéro lib.

**Compteurs** — balise tes chiffres :

```html
<span class="counter" data-target="19" data-suffix="+">0</span>
<span class="counter" data-target="5" data-suffix="+">0</span>
<span class="counter" data-target="25">0</span>
```

```js
const counters = document.querySelectorAll('.counter');
const cObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || '';
    const dur = 1200;
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    cObs.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => cObs.observe(c));
```

**Reveal au scroll** :

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

```js
const rObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      rObs.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('section, .card').forEach(el => {
  el.classList.add('reveal');
  rObs.observe(el);
});
```

---

## 3. Cartes de jeux avec tilt 3D (+ vidéo au survol)

Au survol, la carte s'incline vers la souris (parallaxe). Bonus : la vidéo se lance en muet.

```css
.card {
  transform-style: preserve-3d;
  transition: transform 0.15s ease;
  will-change: transform;
}
```

```js
document.querySelectorAll('.card').forEach(card => {
  const max = 8; // degrés max
  card.addEventListener('mousemove', (ev) => {
    const r = card.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    card.style.transform =
      `perspective(800px) rotateY(${px * max}deg) rotateX(${-py * max}deg) scale(1.02)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });

  // vidéo en muet au survol
  const vid = card.querySelector('video');
  if (vid) {
    vid.muted = true;
    card.addEventListener('mouseenter', () => vid.play());
    card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
  }
});
```

---

## 4. Easter egg console (F12)

ASCII art + message pour les devs curieux. ~5 minutes.

```js
console.log(`%c
   ____  _____
  / ___||  ___|
  \\___ \\| |_
   ___) |  _|
  |____/|_|

  Salut, dev curieux 👋
  Tu fouilles le code ? Bon réflexe.
  Si tu cherches quelqu'un qui fait pareil avec
  les moteurs de jeu : sebastien.feser@gmail.com
`, 'color:#5a8dee; font-family:monospace; font-size:13px;');
```

---

## 5. Konami code → mode CRT/scanlines

↑↑↓↓←→←→ B A débloque un effet rétro. Pile dans ton univers game dev.

```css
body.crt-mode {
  animation: flicker 0.15s infinite;
}
body.crt-mode::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0px,
    rgba(0,0,0,0) 2px,
    rgba(0,0,0,0.25) 3px
  );
}
@keyframes flicker {
  0% { opacity: 1; }
  50% { opacity: 0.97; }
  100% { opacity: 1; }
}
```

```js
const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
             'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let pos = 0;
document.addEventListener('keydown', (e) => {
  pos = (e.key === seq[pos]) ? pos + 1 : 0;
  if (pos === seq.length) {
    document.body.classList.toggle('crt-mode');
    pos = 0;
  }
});
```

---

## 6. Curseur custom + micro-interactions

Un cercle qui suit la souris avec un léger retard et grossit sur les liens. Discret mais ça donne du cachet.

```css
* { cursor: none; }  /* attention : à tester, garde un fallback */
.cursor-dot {
  position: fixed;
  top: 0; left: 0;
  width: 24px; height: 24px;
  border: 1.5px solid #5a8dee;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  transition: width 0.2s, height 0.2s, background 0.2s;
}
.cursor-dot.hover {
  width: 44px; height: 44px;
  background: rgba(90,141,238,0.15);
}
```

```js
const dot = document.createElement('div');
dot.className = 'cursor-dot';
document.body.appendChild(dot);

let mx = 0, my = 0, cx = 0, cy = 0;
addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
function follow() {
  cx += (mx - cx) * 0.18;
  cy += (my - cy) * 0.18;
  dot.style.left = cx + 'px';
  dot.style.top = cy + 'px';
  requestAnimationFrame(follow);
}
follow();

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => dot.classList.add('hover'));
  el.addEventListener('mouseleave', () => dot.classList.remove('hover'));
});
```

> ⚠️ Le curseur custom peut gêner sur mobile/tactile et l'accessibilité. Active-le uniquement sur desktop : `if (matchMedia('(pointer:fine)').matches) { /* init */ }` et garde un curseur visible en fallback.

---

## Checklist d'intégration

- [ ] 1. Shader GLSL dans le hero
- [ ] 2. Compteurs animés + reveal au scroll
- [ ] 3. Tilt 3D + vidéo au survol des cartes
- [ ] 4. Easter egg console
- [ ] 5. Konami code → CRT
- [ ] 6. Curseur custom (desktop only)

**Accessibilité / perf à garder en tête partout :**
- Respecter `prefers-reduced-motion`
- Couper les boucles `requestAnimationFrame` quand l'élément n'est pas visible
- Tester sur mobile (désactiver tilt et curseur custom sur tactile)
- Garder les effets subtils : le contenu reste roi

---

*Document généré pour la refonte de sebastienfeser.ch — 2026*
