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
    const ITERATIONS = 18;          // solver iterations (stacking stability)
    const K_BIAS = 0.2;             // Baumgarte position-correction factor
    const K_SLOP = 0.5;             // allowed penetration (px) before correcting
    const MAX_CORRECTION = 12;      // max penetration (px) corrected per step (anti-pop)
    const MIN_MASS = 3000;          // mass clamp keeps big/small bodies within
    const MAX_MASS = 45000;         // ~15x so heavy objects don't crush light ones
    const MAX_BODIES = 140;
    // sleeping: freeze the whole sim once everything is nearly still
    const SLEEP_V = 8;              // px/s
    const SLEEP_W = 0.08;           // rad/s
    const SLEEP_TIME = 0.6;         // s below thresholds before freezing
    // mouse dragging
    const DRAG_STIFF = 0.25;        // fraction of the gap closed per step
    const MAX_DRAG_SPEED = 3500;    // px/s, caps how hard the grab pulls

    // current drag state: { body, anchorLocal } and the live mouse position
    let drag = null;
    const mouseWorld = V(0, 0);

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
        // Clamp mass so a huge card isn't hundreds of times heavier than a small
        // badge (large mass ratios make the solver crush/jitter light bodies).
        const mass = Math.max(MIN_MASS, Math.min(MAX_MASS, w * h));
        const inertia = mass * (w * w + h * h) / 12;
        return baseBody({
            shape: 'poly', vertices, normals,
            pos: V(cx, cy), w, h, mass, inertia,
        });
    }

    function makeCircle(cx, cy, r) {
        const mass = Math.max(MIN_MASS, Math.min(MAX_MASS, Math.PI * r * r));
        const inertia = mass * r * r * 0.5;
        return baseBody({
            shape: 'circle', radius: r,
            pos: V(cx, cy), w: r * 2, h: r * 2, mass, inertia,
        });
    }

    let bodyIdCounter = 0;
    function baseBody(o) {
        return Object.assign({
            id: bodyIdCounter++,
            velocity: V(0, 0),
            angle: 0,
            angularVelocity: 0,
            biasVel: V(0, 0),   // split-impulse pseudo-velocity (position only)
            biasW: 0,
            friction: 0.4,
            invMass: o.mass ? 1 / o.mass : 0,
            invInertia: o.inertia ? 1 / o.inertia : 0,
            el: null,
            initX: o.pos.x,
            initY: o.pos.y,
        }, o);
    }

    function makeStatic(body) {
        body.invMass = 0;
        body.invInertia = 0;
        body.friction = 0.6;
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
        if (d === 0) return { normal: V(1, 0), contacts: [{ point: a.pos, separation: -a.radius }] };
        const normal = mul(n, 1 / d);
        return { normal, contacts: [{ point: add(mul(normal, a.radius), a.pos), separation: -(r - d) }] };
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
            return { normal, contacts: [{ point: sub(c.pos, mul(normal, c.radius)), separation: -c.radius }] };
        }

        const d1 = dot(sub(center, v1), sub(v2, v1));
        const d2 = dot(sub(center, v2), sub(v1, v2));
        const sepOut = -(c.radius - sep); // negative penetration
        if (d1 <= 0) {
            // nearest to vertex v1
            if (lenSq(sub(center, v1)) > c.radius * c.radius) return null;
            const normal = rot(norm(sub(center, v1)), p.angle); // vertex -> circle = poly -> circle
            return { normal, contacts: [{ point: add(rot(v1, p.angle), p.pos), separation: sepOut }] };
        } else if (d2 <= 0) {
            // nearest to vertex v2
            if (lenSq(sub(center, v2)) > c.radius * c.radius) return null;
            const normal = rot(norm(sub(center, v2)), p.angle);
            return { normal, contacts: [{ point: add(rot(v2, p.angle), p.pos), separation: sepOut }] };
        } else {
            // nearest to the face
            if (dot(sub(center, v1), p.normals[face]) > c.radius) return null;
            const normal = rot(p.normals[face], p.angle); // outward = poly -> circle
            return { normal, contacts: [{ point: sub(c.pos, mul(normal, c.radius)), separation: sepOut }] };
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
        for (const p of face) {
            const sep = dot(refNormal, p) - refC;
            if (sep <= 0) contacts.push({ point: p, separation: sep });
        }
        if (contacts.length === 0) return null;
        return { normal, contacts };
    }

    /* =========================================================
       Impulse resolution
       ========================================================= */
    // Apply an impulse P at offset r from a body's center of mass.
    function applyP(b, P, r) {
        if (b.invMass === 0) return;
        b.velocity = add(b.velocity, mul(P, b.invMass));
        b.angularVelocity += b.invInertia * crossVV(r, P);
    }

    // Apply a bias (pseudo-velocity) impulse: corrects position without adding
    // real velocity, so penetration recovery doesn't cause ghost bounces.
    function applyPbias(b, P, r) {
        if (b.invMass === 0) return;
        b.biasVel = add(b.biasVel, mul(P, b.invMass));
        b.biasW += b.invInertia * crossVV(r, P);
    }

    // Pre-step an arbiter: cache contact data, and warm-start by re-applying the
    // accumulated impulses carried over from the previous frame.
    function preStep(arb, invDt) {
        const { A, B, normal } = arb;
        const tangent = V(normal.y, -normal.x);
        for (const c of arb.contacts) {
            c.r1 = sub(c.point, A.pos);
            c.r2 = sub(c.point, B.pos);
            const rn1 = crossVV(c.r1, normal), rn2 = crossVV(c.r2, normal);
            const kN = A.invMass + B.invMass + A.invInertia * rn1 * rn1 + B.invInertia * rn2 * rn2;
            c.massNormal = kN > 0 ? 1 / kN : 0;
            const rt1 = crossVV(c.r1, tangent), rt2 = crossVV(c.r2, tangent);
            const kT = A.invMass + B.invMass + A.invInertia * rt1 * rt1 + B.invInertia * rt2 * rt2;
            c.massTangent = kT > 0 ? 1 / kT : 0;
            // Baumgarte: gently correct only penetration beyond the slop, and
            // cap how much is corrected per step so deep overlaps ease out
            // smoothly instead of popping.
            const corr = Math.max(Math.min(0, c.separation + K_SLOP), -MAX_CORRECTION);
            c.bias = -K_BIAS * invDt * corr;
            // warm start
            const P = add(mul(normal, c.Pn), mul(tangent, c.Pt));
            applyP(A, mul(P, -1), c.r1);
            applyP(B, P, c.r2);
        }
    }

    function applyImpulse(arb) {
        const { A, B, normal, friction } = arb;
        const tangent = V(normal.y, -normal.x);
        for (const c of arb.contacts) {
            // --- real normal impulse (no position bias here -> no ghost bounce) ---
            let dv = sub(
                add(B.velocity, crossSV(B.angularVelocity, c.r2)),
                add(A.velocity, crossSV(A.angularVelocity, c.r1))
            );
            const vn = dot(dv, normal);
            let dPn = c.massNormal * (-vn);
            const Pn0 = c.Pn;
            c.Pn = Math.max(Pn0 + dPn, 0);       // accumulate & clamp >= 0
            dPn = c.Pn - Pn0;
            const Pnv = mul(normal, dPn);
            applyP(A, mul(Pnv, -1), c.r1);
            applyP(B, Pnv, c.r2);

            // --- bias (pseudo-velocity) normal impulse: penetration correction ---
            const dvb = sub(
                add(B.biasVel, crossSV(B.biasW, c.r2)),
                add(A.biasVel, crossSV(A.biasW, c.r1))
            );
            const vnb = dot(dvb, normal);
            let dPnb = c.massNormal * (-vnb + c.bias);
            const Pnb0 = c.Pnb;
            c.Pnb = Math.max(Pnb0 + dPnb, 0);
            dPnb = c.Pnb - Pnb0;
            const Pnbv = mul(normal, dPnb);
            applyPbias(A, mul(Pnbv, -1), c.r1);
            applyPbias(B, Pnbv, c.r2);

            // --- friction impulse (clamped to Coulomb cone of accumulated normal) ---
            dv = sub(
                add(B.velocity, crossSV(B.angularVelocity, c.r2)),
                add(A.velocity, crossSV(A.angularVelocity, c.r1))
            );
            const vt = dot(dv, tangent);
            let dPt = c.massTangent * (-vt);
            const maxPt = friction * c.Pn;
            const Pt0 = c.Pt;
            c.Pt = Math.max(-maxPt, Math.min(maxPt, Pt0 + dPt));
            dPt = c.Pt - Pt0;
            const Ptv = mul(tangent, dPt);
            applyP(A, mul(Ptv, -1), c.r1);
            applyP(B, Ptv, c.r2);
        }
    }

    /* =========================================================
       Simulation step
       ========================================================= */
    const MAX_SPEED = 4000; // px/s, guards against tunneling through walls
    function integrateForces(b) {
        if (b.invMass === 0) return;
        b.velocity = add(b.velocity, mul(GRAVITY, DT));
        // reset the pseudo-velocity used for split-impulse position correction
        b.biasVel = V(0, 0);
        b.biasW = 0;
    }
    function integrateVelocities(b) {
        if (b.invMass === 0) return;
        const sp = len(b.velocity);
        if (sp > MAX_SPEED) b.velocity = mul(b.velocity, MAX_SPEED / sp);
        // position advances by real velocity + bias velocity; the bias part is
        // then discarded (reset next frame) so it never feeds back as a bounce.
        b.pos = add(b.pos, mul(add(b.velocity, b.biasVel), DT));
        b.angle += (b.angularVelocity + b.biasW) * DT;
    }

    // Is world point p inside body b?
    function pointInBody(b, p) {
        if (b.shape === 'circle') return lenSq(sub(p, b.pos)) <= b.radius * b.radius;
        const local = rotT(sub(p, b.pos), b.angle);
        for (let i = 0; i < b.vertices.length; i++) {
            if (dot(b.normals[i], sub(local, b.vertices[i])) > 0) return false;
        }
        return true;
    }

    // Mouse joint: pull the grabbed anchor point toward the cursor by solving a
    // 2x2 effective-mass constraint (lets the body swing/rotate naturally).
    function solveDrag() {
        if (!drag) return;
        const b = drag.body;
        const r = rot(drag.anchorLocal, b.angle);
        const anchor = add(b.pos, r);
        let target = mul(sub(mouseWorld, anchor), DRAG_STIFF / DT);
        const ts = len(target);
        if (ts > MAX_DRAG_SPEED) target = mul(target, MAX_DRAG_SPEED / ts);

        const pointVel = add(b.velocity, crossSV(b.angularVelocity, r));
        const cdot = sub(pointVel, target);

        const im = b.invMass, ii = b.invInertia;
        const k11 = im + ii * r.y * r.y;
        const k12 = -ii * r.x * r.y;
        const k22 = im + ii * r.x * r.x;
        const det = k11 * k22 - k12 * k12;
        if (Math.abs(det) < 1e-9) return;
        const invDet = 1 / det;
        const impulse = V(
            invDet * (k22 * -cdot.x - k12 * -cdot.y),
            invDet * (k11 * -cdot.y - k12 * -cdot.x)
        );
        applyP(b, impulse, r);
    }

    const pairKey = (a, b) => a.id < b.id ? a.id + '_' + b.id : b.id + '_' + a.id;

    function step(bodies, arbiters) {
        const invDt = 1 / DT;
        // broad + narrow phase -> create/update arbiters (with warm starting)
        const live = new Set();
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const A = bodies[i], B = bodies[j];
                if (A.invMass === 0 && B.invMass === 0) continue;
                const m = collide(A, B);
                const key = pairKey(A, B);
                if (!m) { arbiters.delete(key); continue; }
                live.add(key);
                const contacts = m.contacts.map((c) => ({
                    point: c.point, separation: c.separation, Pn: 0, Pt: 0, Pnb: 0,
                }));
                const prev = arbiters.get(key);
                if (prev) {
                    // carry accumulated impulses over by contact index (warm start)
                    for (let k = 0; k < contacts.length && k < prev.contacts.length; k++) {
                        contacts[k].Pn = prev.contacts[k].Pn;
                        contacts[k].Pt = prev.contacts[k].Pt;
                    }
                }
                arbiters.set(key, {
                    A, B, normal: m.normal,
                    friction: Math.sqrt(A.friction * B.friction),
                    contacts,
                });
            }
        }
        for (const key of arbiters.keys()) if (!live.has(key)) arbiters.delete(key);

        bodies.forEach(integrateForces);
        for (const arb of arbiters.values()) preStep(arb, invDt);
        for (let it = 0; it < ITERATIONS; it++) {
            for (const arb of arbiters.values()) applyImpulse(arb);
            solveDrag();
        }
        bodies.forEach(integrateVelocities);
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
        const bodies = dynamics.concat(walls);
        const arbiters = new Map(); // persisted across frames for warm starting

        // Escape reloads to restore the page
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') location.reload();
        });

        let acc = 0;
        let last = performance.now();
        let settleTimer = 0;
        let awake = true;
        function loop(now) {
            const frameDt = Math.min((now - last) / 1000, 0.05);
            last = now;
            acc += frameDt;
            while (acc >= DT) {
                step(bodies, arbiters);
                acc -= DT;
            }
            for (const b of bodies) render(b);

            // Sleep: once everything is nearly still (and not being dragged),
            // freeze the sim to kill micro-jitter and stop burning CPU.
            let moving = !!drag;
            if (!moving) {
                for (const b of dynamics) {
                    if (len(b.velocity) > SLEEP_V || Math.abs(b.angularVelocity) > SLEEP_W) {
                        moving = true; break;
                    }
                }
            }
            settleTimer = moving ? 0 : settleTimer + frameDt;
            if (settleTimer < SLEEP_TIME) {
                requestAnimationFrame(loop);
            } else {
                awake = false; // park the loop; wake() restarts it on interaction
            }
        }
        function wake() {
            if (awake) return;
            awake = true;
            settleTimer = 0;
            acc = 0;
            last = performance.now();
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        // --- mouse / touch dragging ---
        const pointerPos = (e) => {
            const t = e.touches ? e.touches[0] : e;
            return V(t.clientX, t.clientY);
        };
        function grab(e) {
            const p = pointerPos(e);
            // topmost first: dynamics are in DOM/paint order, later = on top
            for (let i = dynamics.length - 1; i >= 0; i--) {
                if (pointInBody(dynamics[i], p)) {
                    mouseWorld.x = p.x; mouseWorld.y = p.y;
                    drag = {
                        body: dynamics[i],
                        anchorLocal: rotT(sub(p, dynamics[i].pos), dynamics[i].angle),
                    };
                    wake();
                    e.preventDefault();
                    return;
                }
            }
        }
        function move(e) {
            if (!drag) return;
            const p = pointerPos(e);
            mouseWorld.x = p.x; mouseWorld.y = p.y;
            e.preventDefault();
        }
        function release() { drag = null; }

        window.addEventListener('mousedown', grab);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', release);
        window.addEventListener('touchstart', grab, { passive: false });
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', release);
    }

    /* =========================================================
       Konami code listener
       ========================================================= */
    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    function feed(token) {
        pos = (token === SEQ[pos]) ? pos + 1 : (token === SEQ[0] ? 1 : 0);
        if (pos === SEQ.length) { pos = 0; activate(); }
    }

    // --- keyboard ---
    document.addEventListener('keydown', (e) => {
        feed(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });

    // --- gamepad (standard mapping): D-pad / sticks for directions, B=1, A=0 ---
    const GP_BUTTONS = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 1: 'b', 0: 'a' };
    const AXIS_TOKENS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const gpPrev = {};
    let gpPolling = false;
    function pollGamepads() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp) continue;
            for (const idx in GP_BUTTONS) {
                const pressed = !!(gp.buttons[idx] && gp.buttons[idx].pressed);
                const id = gp.index + ':b' + idx;
                if (pressed && !gpPrev[id]) feed(GP_BUTTONS[idx]);
                gpPrev[id] = pressed;
            }
            // left stick as a D-pad fallback (edge-triggered)
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, TH = 0.6;
            const dirs = { up: ay < -TH, down: ay > TH, left: ax < -TH, right: ax > TH };
            for (const d in dirs) {
                const id = gp.index + ':a' + d;
                if (dirs[d] && !gpPrev[id]) feed(AXIS_TOKENS[d]);
                gpPrev[id] = dirs[d];
            }
        }
        requestAnimationFrame(pollGamepads);
    }
    window.addEventListener('gamepadconnected', () => {
        if (gpPolling) return;
        gpPolling = true;
        requestAnimationFrame(pollGamepads);
    });
})();
