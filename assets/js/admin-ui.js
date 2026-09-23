/* Maple Leaf Motors — admin UI chrome (pairs with assets/css/admin.css).
   Adds a sticky top bar, profile card, KPI icons, lead avatars, colour-coded
   status pills and a mobile drawer around the existing dashboard. It never
   replaces admin.js logic: navigation still goes through the original tabs. */
(function () {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  const ICONS = {
    leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    approved: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
    car: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 17v-5l2-5h14l2 5v5M3 12h18"/>',
    media: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  };
  const svg = (name, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const TITLES = {
    leads: ['Finance Leads', 'Every request from the website, newest first'],
    pipeline: ['Pipeline', 'Where each lead is in the deal'],
    marketing: ['Marketing', 'Where your leads come from'],
    inventory: ['Live Inventory', 'Vehicles shown on the website'],
    clients: ['Our Clients', 'Delivery photos and customer reviews'],
    accounts: ['Accounts', 'Team logins and roles'],
    settings: ['My Account', 'Password and tracking settings'],
    howitworks: ['How It Works', 'A quick guide to the portal'],
  };

  function user() {
    try { return JSON.parse(sessionStorage.getItem('mlm_admin_user') || 'null') || {}; } catch (e) { return {}; }
  }
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  function init() {
    const shell = $('.admin-shell');
    const main = $('.main');
    if (!shell || !main) return;
    document.body.classList.add('admin-modern');

    buildTopbar(main);
    buildProfileCard();
    kpiIcons();
    syncTitle();
    watchLeads();
    mobileDrawer(shell);
  }

  function buildTopbar(main) {
    const u = user();
    const bar = document.createElement('header');
    bar.className = 'topbar';
    bar.innerHTML = `
      <button class="topbar-menu" type="button" aria-label="Open menu">${svg('menu', 20)}</button>
      <div class="topbar-title"><span class="topbar-crumb">Dashboard</span><strong id="topbarTitle">Finance Leads</strong></div>
      <label class="topbar-search">${svg('search', 16)}<input id="topbarSearch" type="search" placeholder="Search leads by name, phone, email…" autocomplete="off"><kbd>/</kbd></label>
      <a class="topbar-btn" href="../index.html" target="_blank" rel="noopener">${svg('globe', 16)}<span>View site</span></a>
      <div class="topbar-avatar" title="${u.displayName || ''}">${initials(u.displayName || u.username)}</div>`;
    main.insertBefore(bar, main.firstChild);

    const input = $('#topbarSearch', bar);
    input.addEventListener('input', () => {
      const target = $('#leadSearch');
      if (!target) return;
      if (!$('#leads.admin-section.active')) { const tab = $('.tab[data-tab="leads"]'); if (tab) tab.click(); }
      target.value = input.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('keyup', { bubbles: true }));
    });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }

  function buildProfileCard() {
    const bottom = $('.sidebar-bottom');
    if (!bottom) return;
    const u = user();
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <div class="profile-avatar">${initials(u.displayName || u.username)}</div>
      <div class="profile-meta"><strong>${u.displayName || u.username || 'Signed in'}</strong><span>${u.role === 'admin' ? 'Owner · admin' : (u.role || '')}</span></div>`;
    bottom.insertBefore(card, bottom.firstChild);

    // Turn the existing buttons into a compact icon row (same elements, same handlers)
    const row = document.createElement('div');
    row.className = 'profile-actions';
    const site = $('a[href="../index.html"]', bottom);
    const exp = $('#exportAll', bottom);
    const out = $('#logoutAdmin', bottom);
    [[site, 'globe', 'View website'], [exp, 'download', 'Export data'], [out, 'logout', 'Log out']].forEach(([el, icon, label]) => {
      if (!el) return;
      el.innerHTML = `${svg(icon, 16)}<span>${label}</span>`;
      el.title = label;
      row.appendChild(el);
    });
    bottom.appendChild(row);
  }

  function kpiIcons() {
    const map = { totalLeads: ['leads', 'red'], statApproved: ['approved', 'green'], totalVehicles: ['car', 'blue'], mediaCount: ['media', 'amber'] };
    Object.entries(map).forEach(([id, [icon, tone]]) => {
      const num = document.getElementById(id);
      const card = num && num.closest('.stat-card');
      if (!card || card.querySelector('.kpi-icon')) return;
      card.dataset.tone = tone;
      const i = document.createElement('div');
      i.className = 'kpi-icon';
      i.innerHTML = svg(icon, 18);
      card.insertBefore(i, card.firstChild);
    });
  }

  function syncTitle() {
    const apply = () => {
      const sec = $('.admin-section.active');
      const [title, sub] = TITLES[sec ? sec.id : 'leads'] || ['Dashboard', ''];
      const t = $('#topbarTitle');
      if (t) t.textContent = title;
      const h = $('.main-header h1');
      if (h) h.textContent = title;
      const p = $('#adminTimestamp');
      if (p && sub) p.dataset.sub = sub;
      $$('.sidebar-link').forEach(l => l.classList.toggle('active', !!sec && l.dataset.goto === sec.id));
      document.body.classList.remove('drawer-open');
    };
    $$('.admin-section').forEach(s => new MutationObserver(apply).observe(s, { attributes: true, attributeFilter: ['class'] }));
    apply();
  }

  // Avatars on lead rows + colour-coded status selects, re-applied whenever admin.js re-renders
  function decorate() {
    $$('#financeLeadRows > tr').forEach(tr => {
      const cell = tr.cells && tr.cells[0];
      if (!cell || cell.querySelector('.lead-avatar') || cell.colSpan > 1) return;
      const name = (cell.querySelector('strong') || cell).textContent.trim().split('\n')[0];
      const a = document.createElement('span');
      a.className = 'lead-avatar';
      a.textContent = initials(name);
      a.style.setProperty('--h', [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
      cell.insertBefore(a, cell.firstChild);
      cell.classList.add('lead-cell');
    });
    $$('select[data-lead-status], select[data-status]').forEach(sel => {
      sel.classList.add('status-select');
      sel.dataset.value = sel.value.replace(/\s+/g, '-');
      if (!sel.dataset.rmBound) {
        sel.dataset.rmBound = '1';
        sel.addEventListener('change', () => { sel.dataset.value = sel.value.replace(/\s+/g, '-'); });
      }
    });
  }
  function watchLeads() {
    let queued = false;
    const run = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; decorate(); }); };
    new MutationObserver(run).observe($('.main'), { childList: true, subtree: true });
    run();
  }

  function mobileDrawer(shell) {
    const btn = $('.topbar-menu');
    const scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    shell.appendChild(scrim);
    btn && btn.addEventListener('click', () => document.body.classList.toggle('drawer-open'));
    scrim.addEventListener('click', () => document.body.classList.remove('drawer-open'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
