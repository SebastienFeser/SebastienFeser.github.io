/**
 * Konami physics: a tiny home-made 2D rigid-body engine.
 *
 * Trigger the Konami code (up up down down left right left right B A) and every
 * visible element in the viewport turns into a physics body and collapses into a
 * pile at the bottom of the screen: real gravity, rotation, box/circle collisions
 * (SAT + face clipping), impulse resolution with friction and positional
 * correction. Scroll is locked while it runs. Elements that end up clipped by the
 * screen edges fade out after settling, to keep the page from staying cluttered.
 *
 * 100% vanilla, no dependencies. Press Escape (or re-enter the code) to reload.
 *
 * Built by Sebastien Feser.
 */
(function () {
    'use strict';

    /* =========================================================
       Vector helpers
       ========================================================= */
    const V = (x, y) => ({ x, y });
    const add = (a, b) => V(a.x + b.x, a.y + b.y);
    const sub = (a, b) => V(a.x - b.x, a.y - b.y);
    const mul = (a, s) => V(a.x * s, a.y * s);
    const dot = (a, b) => a.x * b.x + a.y * b.y;
    const crossVV = (a, b) => a.x * b.y - a.y * b.x;      // scalar
    const crossSV = (s, v) => V(-s * v.y, s * v.x);        // scalar x vector
    const lenSq = (a) => a.x * a.x + a.y * a.y;
    const len = (a) => Math.sqrt(lenSq(a));
    function norm(a) {
        const l = len(a);
        return l > 1e-9 ? V(a.x / l, a.y / l) : V(0, 0);
    }
    // rotate by body angle, and inverse rotate (into local space)
    const rot = (v, a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return V(c * v.x - s * v.y, s * v.x + c * v.y);
    };
    const rotT = (v, a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return V(c * v.x + s * v.y, -s * v.x + c * v.y);
    };

    /* =========================================================
       Tunables
       ========================================================= */
    const GRAVITY = V(0, 1600);     // px / s^2
    const DT = 1 / 60;              // fixed timestep
    const ITERATIONS = 12;          // solver iterations (stacking stability)
    const PEN_SLOP = 0.05;
    const PEN_PERCENT = 0.4;
    const MAX_BODIES = 140;

    /* =========================================================
       Body factory
       ========================================================= */
    function makeBox(cx, cy, w, h) {
        const hw = w / 2, hh = h / 2;
        const vertices = [V(-hw, -hh), V(hw, -hh), V(hw, hh), V(-hw, hh)];
        const normals = [];
        for (let i = 0; i < 4; i++) {
            const a = vertices[i], b = vertices[(i + 1) % 4];
            const e = sub(b, a);
            normals.push(norm(V(e.y, -e.x))); // outward (screen y-down winding)
        }
        const mass = w * h;
        const inertia = mass * (w * w + h * h) / 12;
        return baseBody({
            shape: 'poly', vertices, normals,
            pos: V(cx, cy), w, h, mass, inertia,
        });
    }

    function makeCircle(cx, cy, r) {
        const mass = Math.PI * r * r;
        const inertia = mass * r * r * 0.5;
        return baseBody({
            shape: 'circle', radius: r,
            pos: V(cx, cy), w: r * 2, h: r * 2, mass, inertia,
        });
    }

    function baseBody(o) {
        return Object.assign({
            velocity: V(0, 0),
            angle: 0,
            angularVelocity: 0,
            restitution: 0.2,
            staticFriction: 0.5,
            dynamicFriction: 0.35,
            invMass: o.mass ? 1 / o.mass : 0,
            invInertia: o.inertia ? 1 / o.inertia : 0,
            el: null,
            initX: o.pos.x,
            initY: o.pos.y,
            clipTimer: 0,
            fading: false,
            dead: false,
        }, o);
    }

    function makeStatic(body) {
        body.invMass = 0;
        body.invInertia = 0;
        body.staticFriction = 0.6;
        body.dynamicFriction = 0.5;
        body.restitution = 0.1;
        return body;
    }

    // world-space vertex / normal of a polygon body
    const worldVert = (b, i) => add(rot(b.vertices[i], b.angle), b.pos);
    const worldNorm = (b, i) => rot(b.normals[i], b.angle);

    function supportLocal(b, dir) {
        let best = -Infinity, bestV = b.vertices[0];
        for (const v of b.vertices) {
            const p = dot(v, dir);
            if (p > best) { best = p; bestV = v; }
        }
        return bestV;
    }

    /* =========================================================
       Collision detection -> manifold {normal, contacts[], penetration}
       ========================================================= */
    function collide(a, b) {
        if (a.shape === 'circle' && b.shape === 'circle') return circleCircle(a, b);
        if (a.shape === 'circle' && b.shape === 'poly') return flip(circlePoly(b, a));
        if (a.shape === 'poly' && b.shape === 'circle') return circlePoly(a, b);
        return polyPoly(a, b);
    }
    function flip(m) {
        if (m) m.normal = mul(m.normal, -1);
        return m;
    }

    function circleCircle(a, b) {
        const n = sub(b.pos, a.pos);
        const r = a.radius + b.radius;
        const d2 = lenSq(n);
        if (d2 >= r * r) return null;
        const d = Math.sqrt(d2);
        if (d === 0) return { normal: V(1, 0), penetration: a.radius, contacts: [a.pos] };
        const normal = mul(n, 1 / d);
        return { normal, penetration: r - d, contacts: [add(mul(normal, a.radius), a.pos)] };
    }

    // p = polygon (A), c = circle (B). Returned normal points from p toward c.
    function circlePoly(p, c) {
        // circle center into polygon local space
        const center = rotT(sub(c.pos, p.pos), p.angle);
        let sep = -Infinity, face = 0;
        const n = p.vertices.length;
        for (let i = 0; i < n; i++) {
            const s = dot(p.normals[i], sub(center, p.vertices[i]));
            if (s > c.radius) return null;
            if (s > sep) { sep = s; face = i; }
        }
        const v1 = p.vertices[face];
        const v2 = p.vertices[(face + 1) % n];

        // circle center is inside the polygon: push out along the face normal
        if (sep < 1e-6) {
            const normal = rot(p.normals[face], p.angle); // outward = poly -> circle
            return { normal, penetration: c.radius, contacts: [sub(c.pos, mul(normal, c.radius))] };
        }

        const d1 = dot(sub(center, v1), sub(v2, v1));
        const d2 = dot(sub(center, v2), sub(v1, v2));
        const pen = c.radius - sep;
        if (d1 <= 0) {
            // nearest to vertex v1
            if (lenSq(sub(center, v1)) > c.radius * c.radius) return null;
            const normal = rot(norm(sub(center, v1)), p.angle); // vertex -> circle = poly -> circle
            return { normal, penetration: pen, contacts: [add(rot(v1, p.angle), p.pos)] };
        } else if (d2 <= 0) {
            // nearest to vertex v2
            if (lenSq(sub(center, v2)) > c.radius * c.radius) return null;
            const normal = rot(norm(sub(center, v2)), p.angle);
            return { normal, penetration: pen, contacts: [add(rot(v2, p.angle), p.pos)] };
        } else {
            // nearest to the face
            if (dot(sub(center, v1), p.normals[face]) > c.radius) return null;
            const normal = rot(p.normals[face], p.angle); // outward = poly -> circle
            return { normal, penetration: pen, contacts: [sub(c.pos, mul(normal, c.radius))] };
        }
    }

    function axisLeastPenetration(A, B) {
        let best = -Infinity, bi = 0;
        for (let i = 0; i < A.vertices.length; i++) {
            const nW = worldNorm(A, i);
            const nB = rotT(nW, B.angle);
            const s = supportLocal(B, mul(nB, -1));
            const vW = worldVert(A, i);
            const vB = rotT(sub(vW, B.pos), B.angle);
            const d = dot(nB, sub(s, vB));
            if (d > best) { best = d; bi = i; }
        }
        return { dist: best, index: bi };
    }

    function incidentFace(ref, inc, refIndex) {
        const refNormal = worldNorm(ref, refIndex);
        let min = Infinity, ii = 0;
        for (let i = 0; i < inc.vertices.length; i++) {
            const d = dot(refNormal, worldNorm(inc, i));
            if (d < min) { min = d; ii = i; }
        }
        return [worldVert(inc, ii), worldVert(inc, (ii + 1) % inc.vertices.length)];
    }

    function clip(n, c, face) {
        const out = [];
        const d1 = dot(n, face[0]) - c;
        const d2 = dot(n, face[1]) - c;
        if (d1 <= 0) out.push(face[0]);
        if (d2 <= 0) out.push(face[1]);
        if (d1 * d2 < 0) {
            const alpha = d1 / (d1 - d2);
            out.push(add(face[0], mul(sub(face[1], face[0]), alpha)));
        }
        return out;
    }

    function polyPoly(A, B) {
        const a = axisLeastPenetration(A, B);
        if (a.dist >= 0) return null;
        const b = axisLeastPenetration(B, A);
        if (b.dist >= 0) return null;

        // Pick the reference face: the one with the least penetration (closest
        // to 0). Small bias to keep the choice stable frame to frame.
        const biasGreater = (x, y) => x >= y * 0.95 + x * 0.01;
        let ref, inc, refIndex, flipNormal;
        if (biasGreater(a.dist, b.dist)) {
            ref = A; inc = B; refIndex = a.index; flipNormal = false;
        } else {
            ref = B; inc = A; refIndex = b.index; flipNormal = true;
        }

        let face = incidentFace(ref, inc, refIndex);
        const rv1 = worldVert(ref, refIndex);
        const rv2 = worldVert(ref, (refIndex + 1) % ref.vertices.length);
        const sidePlane = norm(sub(rv2, rv1));
        const refNormal = worldNorm(ref, refIndex);

        const negSide = -dot(sidePlane, rv1);
        const posSide = dot(sidePlane, rv2);

        face = clip(mul(sidePlane, -1), negSide, face);
        if (face.length < 2) return null;
        face = clip(sidePlane, posSide, face);
        if (face.length < 2) return null;

        const normal = flipNormal ? mul(refNormal, -1) : refNormal;
        const refC = dot(refNormal, rv1);
        const contacts = [];
        let penSum = 0, cnt = 0;
        for (const p of face) {
            const sep = dot(refNormal, p) - refC;
            if (sep <= 0) { contacts.push(p); penSum += -sep; cnt++; }
        }
        if (cnt === 0) return null;
        return { normal, contacts, penetration: penSum / cnt };
    }

    /* =========================================================
       Impulse resolution
       ========================================================= */
    function resolve(m, A, B) {
        const e = Math.min(A.restitution, B.restitution);
        const sf = Math.sqrt(A.staticFriction * B.staticFriction);
        const df = Math.sqrt(A.dynamicFriction * B.dynamicFriction);
        const restThreshold = lenSq(mul(GRAVITY, DT)) + 1e-4;

        for (const cp of m.contacts) {
            const ra = sub(cp, A.pos);
            const rb = sub(cp, B.pos);
            let rv = sub(
                add(B.velocity, crossSV(B.angularVelocity, rb)),
                add(A.velocity, crossSV(A.angularVelocity, ra))
            );
            const contactVel = dot(rv, m.normal);
            if (contactVel > 0) continue;

            const raCrossN = crossVV(ra, m.normal);
            const rbCrossN = crossVV(rb, m.normal);
            const invMassSum = A.invMass + B.invMass
                + raCrossN * raCrossN * A.invInertia
                + rbCrossN * rbCrossN * B.invInertia;
            if (invMassSum === 0) continue;

            const bounce = lenSq(rv) < restThreshold ? 0 : e;
            let j = -(1 + bounce) * contactVel / invMassSum;
            j /= m.contacts.length;
            const impulse = mul(m.normal, j);
            applyImpulse(A, mul(impulse, -1), ra);
            applyImpulse(B, impulse, rb);

            // friction
            rv = sub(
                add(B.velocity, crossSV(B.angularVelocity, rb)),
                add(A.velocity, crossSV(A.angularVelocity, ra))
            );
            let t = sub(rv, mul(m.normal, dot(rv, m.normal)));
            t = norm(t);
            let jt = -dot(rv, t) / invMassSum;
            jt /= m.contacts.length;
            if (Math.abs(jt) < 1e-6) continue;
            const frictionImpulse = Math.abs(jt) < j * sf
                ? mul(t, jt)
                : mul(t, -j * df);
            applyImpulse(A, mul(frictionImpulse, -1), ra);
            applyImpulse(B, frictionImpulse, rb);
        }
    }

    function applyImpulse(b, impulse, r) {
        if (b.invMass === 0) return;
        b.velocity = add(b.velocity, mul(impulse, b.invMass));
        b.angularVelocity += b.invInertia * crossVV(r, impulse);
    }

    function correct(m, A, B) {
        const sum = A.invMass + B.invMass;
        if (sum === 0) return;
        const c = Math.max(m.penetration - PEN_SLOP, 0) / sum * PEN_PERCENT;
        const corr = mul(m.normal, c);
        A.pos = sub(A.pos, mul(corr, A.invMass));
        B.pos = add(B.pos, mul(corr, B.invMass));
    }

    /* =========================================================
       Simulation step
       ========================================================= */
    function integrateForces(b) {
        if (b.invMass === 0) return;
        b.velocity = add(b.velocity, mul(GRAVITY, DT / 2));
    }
    const MAX_SPEED = 4000; // px/s, guards against tunneling through walls
    function integrateVelocities(b) {
        if (b.invMass === 0) return;
        const sp = len(b.velocity);
        if (sp > MAX_SPEED) b.velocity = mul(b.velocity, MAX_SPEED / sp);
        b.pos = add(b.pos, mul(b.velocity, DT));
        b.angle += b.angularVelocity * DT;
        integrateForces(b);
    }

    function step(bodies) {
        // broad + narrow phase
        const manifolds = [];
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const A = bodies[i], B = bodies[j];
                if (A.invMass === 0 && B.invMass === 0) continue;
                const m = collide(A, B);
                if (m) manifolds.push({ m, A, B });
            }
        }
        bodies.forEach(integrateForces);
        for (let it = 0; it < ITERATIONS; it++) {
            for (const { m, A, B } of manifolds) resolve(m, A, B);
        }
        bodies.forEach(integrateVelocities);
        for (const { m, A, B } of manifolds) correct(m, A, B);
    }

    /* =========================================================
       Page teardown: pick visible elements -> bodies
       ========================================================= */
    const SELECTOR = [
        // interactive / header bits
        '.site-logo', '.mobile-menu-toggle', '.main-nav .nav-link', '.social-link',
        '.lang-btn', '.btn',
        // chunky content blocks
        '.hero-avatar', '.hero-stat', '.card', '.blog-card', '.blog-list-item',
        '.featured-project', '.skills-category', '.experience-card', '.author-box',
        '.stat-card', '.toc', '.quote', '.education-card', '.course-module',
        '.role-card', '.tool-item', '.challenge-item', '.minigame-card', '.blogpost-card',
        // generic content (outermost filter avoids capturing these inside the blocks above)
        'h1', 'h2', 'h3', 'h4', 'p', 'li', 'img', 'blockquote', 'pre',
        '.badge', '.tag', '.skill-tag', '.hero-badge', '.blog-date', '.section-title'
    ].join(',');

    function isVisibleInViewport(el) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        if (r.width > innerWidth * 0.98 && r.height > innerHeight * 0.9) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || +style.opacity === 0) return false;
        // must be at least partly inside the viewport
        return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    }

    function pickElements() {
        const all = Array.from(document.querySelectorAll(SELECTOR)).filter(isVisibleInViewport);
        // keep only outermost matches (drop any element contained in another match)
        const set = new Set(all);
        const chosen = all.filter((el) => {
            let p = el.parentElement;
            while (p) { if (set.has(p)) return false; p = p.parentElement; }
            return true;
        });
        return chosen.slice(0, MAX_BODIES);
    }

    function looksCircular(el, r) {
        if (Math.abs(r.width - r.height) > 6) return false;
        const br = getComputedStyle(el).borderTopLeftRadius;
        if (br.indexOf('%') !== -1) return parseFloat(br) >= 45;
        return parseFloat(br) >= Math.min(r.width, r.height) / 2 * 0.8;
    }

    function elementToBody(el, r) {
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const body = looksCircular(el, r)
            ? makeCircle(cx, cy, Math.min(r.width, r.height) / 2)
            : makeBox(cx, cy, r.width, r.height);
        body.el = el;
        // little initial life so the pile starts tumbling naturally
        body.velocity = V((Math.random() - 0.5) * 120, Math.random() * 40);
        body.angularVelocity = (Math.random() - 0.5) * 2.2;
        body.restitution = 0.18 + Math.random() * 0.12;
        return body;
    }

    /* =========================================================
       Activation
       ========================================================= */
    let running = false;

    function lockScroll() {
        const x = scrollX, y = scrollY;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        const block = (e) => { e.preventDefault(); };
        window.addEventListener('wheel', block, { passive: false });
        window.addEventListener('touchmove', block, { passive: false });
        window.addEventListener('scroll', () => window.scrollTo(x, y));
        window.addEventListener('keydown', (e) => {
            const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
            if (keys.includes(e.key)) e.preventDefault();
        }, { passive: false });
    }

    function freezeElement(el, r) {
        const s = el.style;
        s.position = 'fixed';
        s.left = r.left + 'px';
        s.top = r.top + 'px';
        s.width = r.width + 'px';
        s.height = r.height + 'px';
        s.margin = '0';
        s.zIndex = '999999';
        s.transformOrigin = 'center center';
        s.transition = 'none';
        s.boxSizing = 'border-box';
        s.maxWidth = 'none';
        s.pointerEvents = 'none';
        s.opacity = s.opacity || '1';
    }

    function buildWalls() {
        const W = innerWidth, H = innerHeight, t = 200;
        const floor = makeStatic(makeBox(W / 2, H + t / 2, W * 3, t));
        const left = makeStatic(makeBox(-t / 2, H / 2, t, H * 3));
        const right = makeStatic(makeBox(W + t / 2, H / 2, t, H * 3));
        return [floor, left, right];
    }

    function render(b) {
        if (!b.el) return;
        const dx = b.pos.x - b.initX;
        const dy = b.pos.y - b.initY;
        b.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${b.angle}rad)`;
    }

    function activate() {
        if (running) return;
        running = true;

        const els = pickElements();
        if (!els.length) { running = false; return; }

        // read all rects BEFORE mutating layout
        const rects = els.map((el) => el.getBoundingClientRect());

        lockScroll();

        // Dedicated overlay: falling/fading elements are MOVED here so they no
        // longer depend on the original page, which we then hide entirely. This
        // guarantees nothing is left lingering in the background.
        const overlay = document.createElement('div');
        overlay.id = 'konami-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
            zIndex: '999999', pointerEvents: 'none',
        });
        document.body.appendChild(overlay);

        const dynamics = [];
        els.forEach((el, i) => {
            const r = rects[i];
            const fullyVisible = r.top >= -1 && r.left >= -1
                && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
            freezeElement(el, r);
            overlay.appendChild(el); // reparent into the overlay
            if (fullyVisible) {
                dynamics.push(elementToBody(el, r));
            } else {
                // clipped by a viewport edge -> fade out instead of falling
                el.style.transition = 'opacity 0.5s ease';
                requestAnimationFrame(() => { el.style.opacity = '0'; });
                setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 550);
            }
        });

        // Hide everything left on the original page (unselected containers, text,
        // backgrounds...) so only the overlay and the animated shader remain.
        Array.from(document.body.children).forEach((child) => {
            if (child === overlay || child.id === 'hero-shader' || child.tagName === 'SCRIPT') return;
            child.style.display = 'none';
        });

        if (!dynamics.length) { running = false; return; }
        const walls = buildWalls();
        let bodies = dynamics.concat(walls);

        // Escape reloads to restore the page
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') location.reload();
        });

        let acc = 0;
        let last = performance.now();
        function loop(now) {
            acc += Math.min((now - last) / 1000, 0.05);
            last = now;
            while (acc >= DT) {
                step(bodies);
                acc -= DT;
            }
            for (const b of bodies) render(b);
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    /* =========================================================
       Konami code listener
       ========================================================= */
    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    document.addEventListener('keydown', (e) => {
        // TEST trigger: press § to activate immediately (remove before shipping).
        if (e.key === '§') { activate(); return; }

        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        pos = (k === SEQ[pos]) ? pos + 1 : (k === SEQ[0] ? 1 : 0);
        if (pos === SEQ.length) {
            pos = 0;
            activate();
        }
    });
})();
