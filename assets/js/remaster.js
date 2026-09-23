/* Maple Leaf Motors — Remaster interactions (pairs with assets/css/remaster.css).
   Progressive enhancement only: every page still works if this file fails. */
(function () {
  'use strict';
  const root = document.documentElement;
  root.classList.add('rm-js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  // One rAF-throttled scroll loop shared by every scroll effect
  const scrollJobs = [];
  let scrollQueued = false;
  function onScroll(job) {
    scrollJobs.push(job);
    job();
  }
  addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; scrollJobs.forEach(j => j()); });
  }, { passive: true });

  function init() {
    progressRail();
    navState();
    marquee();
    splitHeadline();
    arrows();
    eyebrowNumbers();
    spotlight();
    tilt();
    reveals();
    wordmark();
  }

  // Thin red progress line across the top of the viewport
  function progressRail() {
    const bar = document.createElement('div');
    bar.className = 'rm-progress';
    document.body.appendChild(bar);
    let max = 1;
    const measure = () => { max = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);
    onScroll(() => { bar.style.transform = `scaleX(${Math.min(1, scrollY / max)})`; });
  }

  function navState() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let on = null;
    onScroll(() => {
      const next = scrollY > 24;
      if (next !== on) { on = next; nav.classList.toggle('rm-scrolled', next); }
    });
  }

  // Scrolling ribbon of situations we help with, directly under the homepage hero
  function marquee() {
    const hero = document.querySelector('header.hero');
    if (!hero) return;
    const items = ['All Credit Welcome', 'New to Canada', 'Self-Employed', 'Rebuilding Credit', 'Consumer Proposal',
      'Pension Income', 'Cars · SUVs · Trucks', 'Boats · Campers · Bikes', 'Manitoba to Ontario', 'Open 7 Days'];
    const row = items.map(t => `<span>${t}</span>`).join('');
    const el = document.createElement('div');
    el.className = 'rm-marquee';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="rm-marquee-track">${row}${row}</div>`;
    hero.insertAdjacentElement('afterend', el);
  }

  // Wrap each headline word so it can rise into view
  function splitHeadline() {
    if (reduceMotion) return;
    $$('.hero-copy h1, .funnel-title, .policy-page h1, .section > .container > h1').forEach(h => {
      if (h.dataset.rmSplit) return;
      h.dataset.rmSplit = '1';
      let i = 0;
      const wrap = node => {
        Array.from(node.childNodes).forEach(child => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const w = document.createElement('span');
              w.className = 'rm-w';
              w.innerHTML = `<span style="--i:${i++}"></span>`;
              w.firstChild.textContent = part;
              frag.appendChild(w);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) {
            wrap(child);
          }
        });
      };
      wrap(h);
      h.classList.add('rm-words');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('rm-in')));
    });
  }

  // Turn trailing "→" into an animated arrow
  function arrows() {
    $$('a, button, strong').forEach(el => {
      const last = el.lastChild;
      if (!last || last.nodeType !== 3 || !/→\s*$/.test(last.textContent)) return;
      last.textContent = last.textContent.replace(/\s*→\s*$/, ' ');
      const a = document.createElement('span');
      a.className = 'rm-arrow';
      a.textContent = '→';
      el.appendChild(a);
    });
  }

  function eyebrowNumbers() {
    $$('.section .section-head .eyebrow, .delivery-showcase-head .eyebrow').forEach((e, i) => {
      e.dataset.rmNum = String(i + 1).padStart(2, '0');
    });
  }

  // Cursor-following glow + edge light on glass cards
  function spotlight() {
    if (!canHover) return;
    const cards = $$('.card, .feature-card, .review-card, .vehicle-card, .vehicle-category-card, .home-process-card, .hero-approval-card, .lead-promise-card, .funnel-form-card, .funnel-hero-card, .financing-situation-card, .approval-band, .contact-info-item, .policy-card');
    cards.forEach(c => c.classList.add('rm-spot'));
    let last = null;
    let queued = false;
    document.addEventListener('pointermove', e => {
      last = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const c = last.target.closest && last.target.closest('.rm-spot');
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${last.clientX - r.left}px`);
        c.style.setProperty('--my', `${last.clientY - r.top}px`);
      });
    }, { passive: true });
  }

  function tilt() {
    if (!canHover || reduceMotion) return;
    $$('.vehicle-category-card, .hero-approval-card').forEach(card => {
      card.classList.add('rm-tilt');
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', `${x * 7}deg`);
        card.style.setProperty('--rx', `${-y * 7}deg`);
        card.classList.add('rm-tilting');
      });
      card.addEventListener('pointerleave', () => card.classList.remove('rm-tilting'));
    });
  }

  // Scroll reveals for anything the page's own GSAP code doesn't already animate
  function reveals() {
    const gsapOwned = '.home-process-card, .feature-card, .review-card, .vehicle-card, .vehicle-category-card, .delivery-showcase-section, .approval-band, .disclosure-card, .check, .hero-copy *, .hero-approval-card';
    const targets = $$('.section-head, .section .card, .contact-info-item, .financing-situation-card, .policy-card, .funnel-hero-card, .funnel-form-card, .vehicle-approval-band, .footer-grid, .rm-marquee')
      .filter(el => !el.matches(gsapOwned));
    const observed = targets.concat($$('.home-process-grid'));
    if (!('IntersectionObserver' in window) || reduceMotion) {
      observed.forEach(el => el.classList.add('rm-in'));
      return;
    }
    targets.forEach(el => {
      el.setAttribute('data-rm-reveal', '');
      const sibs = el.parentElement ? Array.from(el.parentElement.children) : [];
      el.style.setProperty('--rm-d', `${Math.min(sibs.indexOf(el), 5) * 90}ms`);
    });
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('rm-in');
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    observed.forEach(el => io.observe(el));
  }

  // Giant outlined brand wordmark in the footer that lights up under the cursor
  function wordmark() {
    const container = document.querySelector('.footer .container');
    if (!container || container.querySelector('.rm-wordmark')) return;
    const w = document.createElement('div');
    w.className = 'rm-wordmark';
    w.setAttribute('aria-hidden', 'true');
    w.textContent = 'MAPLE LEAF MOTORS';
    container.appendChild(w);
    if (!canHover) return;
    w.addEventListener('pointermove', e => {
      const r = w.getBoundingClientRect();
      w.style.setProperty('--mx', `${e.clientX - r.left}px`);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
