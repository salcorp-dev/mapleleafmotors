/* Maple Leaf Motors — real highway footage background.
   Fixed behind all content. Two <video> copies crossfade at the loop point so the
   drone clip never visibly jumps. Phones get a lighter file; Save-Data and
   reduced-motion users get the still poster only.
   Performance: colour grading is baked into the video file (no CSS filter), the
   loop check rides the video's own timeupdate event (no per-frame JS), and the
   scroll fade only touches a composited opacity once per animation frame.
   Footage: Pexels video 8783028 (Pexels License — free to use, no attribution required). */
(function () {
  'use strict';

  const BASE = 'assets/video/';
  const FADE = 1.2; // seconds of crossfade before the clip ends

  function init() {
    const wrap = document.createElement('div');
    wrap.id = 'mlm-bg-scene';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.backgroundImage = `url("${BASE}highway-poster.jpg")`;
    document.body.insertBefore(wrap, document.body.firstChild);

    // Footage is vivid in the hero and softens as you read on
    let queued = false;
    const fade = () => {
      queued = false;
      wrap.style.opacity = String(1 - Math.min(scrollY / (innerHeight * 0.9), 1) * 0.62);
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(fade); } }, { passive: true });
    fade();

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = navigator.connection || {};
    const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    if (reduce || lowData) return;

    const src = BASE + (innerWidth < 768 ? 'highway-mobile.mp4' : 'highway.mp4');
    const vids = [0, 1].map(i => {
      const v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.preload = i === 0 ? 'auto' : 'metadata';
      v.src = src;
      v.style.opacity = i === 0 ? '1' : '0';
      wrap.appendChild(v);
      return v;
    });

    let active = 0;
    let fading = false;
    vids[0].addEventListener('playing', () => wrap.classList.add('is-playing'), { once: true });
    vids[0].play().catch(() => {});

    vids.forEach((v, i) => v.addEventListener('timeupdate', () => {
      if (i !== active || fading || !v.duration || v.currentTime < v.duration - FADE) return;
      fading = true;
      const next = vids[1 - active];
      next.currentTime = 0;
      next.play().catch(() => {});
      next.style.opacity = '1';
      v.style.opacity = '0';
      setTimeout(() => { v.pause(); active = 1 - active; fading = false; }, FADE * 1000);
    }));

    // Pause when the tab is hidden to save battery
    document.addEventListener('visibilitychange', () => {
      const cur = vids[active];
      if (document.hidden) cur.pause(); else cur.play().catch(() => {});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
