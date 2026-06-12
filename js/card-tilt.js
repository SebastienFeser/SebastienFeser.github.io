/**
 * 3D tilt on cards: each card leans toward the cursor for a parallax feel.
 *
 * Desktop only: skipped on touch / coarse pointers and with
 * prefers-reduced-motion, where cards keep their normal hover behavior.
 */
(function () {
    const finePointer = window.matchMedia && matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduce) return;

    const MAX = 8; // max tilt in degrees

    document.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('mousemove', (ev) => {
            const r = card.getBoundingClientRect();
            const px = (ev.clientX - r.left) / r.width - 0.5;
            const py = (ev.clientY - r.top) / r.height - 0.5;
            card.style.transform =
                `perspective(800px) rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
})();
