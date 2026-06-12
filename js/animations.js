/**
 * Scroll-driven animations:
 *   1. Counters: numbers count up from 0 when they scroll into view.
 *   2. Reveal: sections and cards fade/slide in as they enter the viewport.
 *
 * Degrades gracefully: with prefers-reduced-motion or without
 * IntersectionObserver, counters show their final value and nothing is hidden.
 */
(function () {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasIO = 'IntersectionObserver' in window;

    /* ---- 1. Animated counters ---- */
    const counters = document.querySelectorAll('.counter');

    function finalValue(el) {
        el.textContent = el.dataset.target + (el.dataset.suffix || '');
    }

    function animateCounter(el) {
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
    }

    if (counters.length) {
        if (reduce || !hasIO) {
            counters.forEach(finalValue);
        } else {
            const cObs = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (!e.isIntersecting) return;
                    animateCounter(e.target);
                    cObs.unobserve(e.target);
                });
            }, { threshold: 0.5 });
            counters.forEach((c) => cObs.observe(c));
        }
    }

    /* ---- 2. Reveal on scroll ---- */
    // Skip entirely if reduced motion or no observer: leave content visible.
    if (reduce || !hasIO) return;

    const rObs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                rObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('section:not(.hero-enhanced), .card').forEach((el) => {
        el.classList.add('reveal');
        rObs.observe(el);
    });
})();
