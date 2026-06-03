
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const LIVE_INVENTORY_API = "https://maple-leaf-inventory.sal96wpg.workers.dev/inventory";

async function loadConfig() {
  try {
    const res = await fetch('assets/data/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No config');
    const config = await res.json();
    return { inventoryApiUrl: config.inventoryApiUrl || LIVE_INVENTORY_API, clientsApiUrl: config.clientsApiUrl || 'https://maple-leaf-inventory.sal96wpg.workers.dev/clients' };
  } catch (e) {
    return { inventoryApiUrl: LIVE_INVENTORY_API, clientsApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/clients' };
  }
}

async function siteData() {
  let fallback = { inventory: [], testimonials: [], deliveries: [] };

  try {
    const res = await fetch('assets/data/site-data.json', { cache: 'no-store' });
    if (res.ok) fallback = await res.json();
  } catch (e) {
    console.warn('Static site data failed:', e);
  }

  const cfg = await loadConfig();

  if (cfg.inventoryApiUrl) {
    try {
      const remote = await fetch(cfg.inventoryApiUrl, { cache: 'no-store' });
      if (remote.ok) {
        const payload = await remote.json();
        const inventory = Array.isArray(payload) ? payload : (Array.isArray(payload.inventory) ? payload.inventory : []);
        if (Array.isArray(inventory)) {
          fallback.inventory = inventory;
          fallback.remoteInventory = true;
        }
      }
    } catch (e) {
      console.warn('Remote vehicle examples failed, using fallback inventory:', e);
    }
  }

  if (cfg.clientsApiUrl || true) {
    try {
      const res = await fetch((cfg.clientsApiUrl || 'https://maple-leaf-inventory.sal96wpg.workers.dev/clients'), { cache: 'no-store' });
      if (res.ok) {
        const clients = await res.json();
        if (Array.isArray(clients.deliveries)) fallback.deliveries = clients.deliveries.filter(x => x.archiveHidden !== true);
        if (Array.isArray(clients.testimonials)) fallback.testimonials = clients.testimonials.filter(x => x.archiveHidden !== true);
        fallback.remoteClients = true;
      }
    } catch (e) {
      console.warn('Remote clients failed, using fallback clients:', e);
    }
  }

  const local = localStorage.getItem('mlm_site_data');
  if (local && !fallback.inventory.length && !fallback.deliveries.length) {
    try {
      const localData = JSON.parse(local);
      return localData;
    } catch (e) {
      console.warn('Local storage site data failed:', e);
    }
  }

  return fallback;
}

// ── Helpers ──
function money(n) { return `$${Number(n || 0).toLocaleString()}`; }
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
function isPublicVehicle(v) {
  return v?.archiveHidden !== true;
}
function monthly(vehicle) {
  return vehicle && typeof vehicle === 'object' ? Math.round(Number(vehicle.monthlyPayment || 0)) : 0;
}
function biweekly(vehicle) {
  return vehicle && typeof vehicle === 'object' ? Math.round(Number(vehicle.biweeklyPayment || 0)) : 0;
}
function paymentLine(v, detail = false) {
  const b = biweekly(v);
  if (!b) return '';
  const term = Number(v.financeTermMonths || 0);
  const rate = Number(v.financeRate || 0);
  const meta = [term ? `${term} mo` : '', rate ? `@ ${rate}%` : ''].filter(Boolean).join(' ');
  const cls = detail ? 'payment-est' : 'price-monthly';
  return `<div class="${cls}">Est. <strong>$${b.toLocaleString()}/biweekly</strong>${meta ? `<br>${meta}` : ''}</div>`;
}
function images(v) { return (Array.isArray(v.images) && v.images.length ? v.images : [v.image]).filter(Boolean); }
function image(v) { return images(v)[0] || ''; }
function km(v) { return Number(v.mileage || v.kilometers || 0); }
function title(v) { return `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(); }

function exampleTitle(v) {
  const type = v.bodyStyle || v.model || v.make || 'Vehicle';
  if (/truck/i.test(type) || /ram|f-150|silverado|sierra/i.test(title(v))) return 'Truck Options';
  if (/suv|utility|escape|rogue|tucson|santa fe|terrain|equinox/i.test(type + ' ' + title(v))) return 'SUV Options';
  if (/van|caravan|sienna|odyssey/i.test(type + ' ' + title(v))) return 'Family Van Options';
  if (/luxury|mercedes|bmw|audi|lexus|acura/i.test(title(v))) return 'Luxury Options';
  return 'Car Options';
}
function exampleMeta(v) {
  const b = biweekly(v);
  const parts = [];
  if (b) parts.push(`Est. from $${b.toLocaleString()}/biweekly`);
  if (v.bodyStyle) parts.push(v.bodyStyle);
  if (v.drivetrain) parts.push(v.drivetrain);
  return parts.join(' · ') || 'Payment options vary by approval';
}
function disclaimerText() {
  return 'Vehicle photos and categories are examples only. Availability, pricing, payments, and approvals vary by lender requirements, dealer availability, province, credit profile, income, down payment, and trade-in.';
}

function matchingUrl(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const qs = query.toString();
  return `financing.html${qs ? `?${qs}` : ''}#approval`;
}


// ── Navigation ──
function nav() {
  const b = $('#mobileToggle'), l = $('#navLinks');
  if (b) b.onclick = () => l.classList.toggle('open');
  // Close menu on outside click
  document.addEventListener('click', e => {
    if (l && l.classList.contains('open') && !l.contains(e.target) && !b.contains(e.target)) {
      l.classList.remove('open');
    }
  });
}

// ── Vehicle Card (grid) ──
function vehicleCard(v) {
  return `<article class="vehicle-card vehicle-example-card">
    <a href="financing.html#approval" class="vehicle-card-img-wrap" style="display:block;">
      <img src="${image(v)}" alt="${exampleTitle(v)}" loading="lazy">
      <div class="vehicle-card-badge">
        <span class="pill">Example only</span>
      </div>
    </a>
    <div class="vehicle-body">
      <div class="vehicle-title">${exampleTitle(v)}</div>
      <div class="vehicle-meta">${exampleMeta(v)}</div>
      <div class="price-block">
        <div class="price">${v.price ? 'From ' + money(v.price) : 'Matched to your budget'}</div>
        ${paymentLine(v)}
      </div>
      <p class="vehicle-example-note">${disclaimerText()}</p>
      <div class="vehicle-actions">
        <a class="btn btn-outline btn-sm" href="financing.html#approval">Check My Options</a>
        <a class="btn btn-sm" href="financing.html#approval">Get Matched</a>
      </div>
    </div>
  </article>`;
}

// ── Hero car card ──
function heroCarCard(v) {
  return `<div class="hero-car">
    <a href="financing.html#approval" class="hero-car-img-wrap" style="display:block;">
      <img src="${image(v)}" alt="${exampleTitle(v)}" loading="lazy">
    </a>
    <div class="hero-car-body">
      <span class="pill pill-dark">Example vehicle type</span>
      <h3>${exampleTitle(v)}</h3>
      <div class="hero-car-meta">${exampleMeta(v)}</div>
      <a class="btn btn-sm" href="financing.html#approval">Get Matched →</a>
    </div>
  </div>`;
}


function clientSlideCard(d, i = 0) {
  const imgs = deliveryImages(d);
  const img = imgs[0] || 'assets/images/maple-leaf-motors-logo.png';
  const quote = d.quote || d.text || 'Real customers, real deliveries. Thank you for trusting Maple Leaf Motors.';
  const client = d.clientName || d.name || 'Happy Customer';
  const vehicle = d.vehicle || 'Recent Vehicle Delivery';
  return `<article class="delivery-showcase-card ${i === 0 ? 'active' : ''}" data-delivery-card="${i}">
    <div class="delivery-quote-side">
      <span class="delivery-kicker">Recent delivery</span>
      <h3>${esc(vehicle)}</h3>
      <blockquote>“${esc(quote)}”</blockquote>
      <div class="delivery-person">
        <strong>${esc(client)}</strong>
        <span>${esc(vehicle)}</span>
      </div>
      <div class="delivery-actions">
        <a class="btn" href="financing.html#approval">Start Matching</a>
        <span>Canada-wide vehicle matching support</span>
      </div>
    </div>
    <div class="delivery-photo-side">
      <img src="${esc(img)}" alt="${esc(vehicle)} delivery photo" loading="lazy">
      <div class="delivery-photo-badge">Customer Delivery</div>
    </div>
  </article>`;
}

function renderDeliveryShowcase(deliveries) {
  const showcase = $('#homeDeliveryShowcase');
  if (!showcase) return;

  const items = (deliveries || []).filter(x => isVisibleDelivery(x) && deliveryImages(x).length);
  if (!items.length) {
    showcase.innerHTML = `<article class="delivery-showcase-card active delivery-empty">
      <div class="delivery-quote-side">
        <span class="delivery-kicker">Our Clients</span>
        <h3>Customer delivery photos will appear here.</h3>
        <blockquote>“Upload delivery photos and quotes in the admin portal, and they will display in this large homepage proof section.”</blockquote>
        <div class="delivery-actions">
          <a class="btn" href="financing.html#approval">Start Matching</a>
          <span>Real delivery proof will rotate here automatically.</span>
        </div>
      </div>
      <div class="delivery-photo-side delivery-placeholder">
        <div>
          <strong>Delivery Photo</strong>
          <span>Admin uploads appear here</span>
        </div>
      </div>
    </article>`;
    return;
  }

  showcase.innerHTML = `
    <div class="delivery-showcase-track">
      ${items.slice(0, 10).map((item, i) => clientSlideCard(item, i)).join('')}
    </div>
    ${items.length > 1 ? `<div class="delivery-showcase-dots">
      ${items.slice(0, 10).map((_, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-delivery-dot="${i}" aria-label="Show delivery ${i + 1}"></button>`).join('')}
    </div>` : ''}`;

  const cards = $$('.delivery-showcase-card', showcase);
  const dots = $$('[data-delivery-dot]', showcase);
  let current = 0;

  function show(index) {
    if (!cards.length) return;
    current = (index + cards.length) % cards.length;
    cards.forEach((card, i) => card.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => show(Number(dot.dataset.deliveryDot || 0)));
  });

  if (cards.length > 1) {
    setInterval(() => {
      if (document.hidden) return;
      show(current + 1);
    }, 5200);
  }
}

function deliveryImages(d) {
  if (!d || typeof d !== 'object') return [];
  const out = [];
  const add = value => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === 'object') {
      add(value.url || value.src || value.data || value.image || value.photo || value.photoUrl || value.imageUrl);
      return;
    }
    const text = String(value).trim();
    if (text) out.push(text);
  };
  add(d.images);
  add(d.image);
  add(d.photo);
  add(d.photoUrl);
  add(d.imageUrl);
  add(d.url);
  add(d.src);
  return [...new Set(out)];
}

function isVisibleDelivery(d) {
  if (!d || typeof d !== 'object') return false;
  const status = String(d.status || '').toLowerCase();
  return d.archiveHidden !== true && d.archived !== true && status !== 'archived';
}

function renderHomepageNavigationPreview(d, inv) {
  const navPreview = $('#homeNavPreview');
  if (navPreview) {
    navPreview.innerHTML = `
    <a class="home-nav-card" href="financing.html#approval">
      <span>Start Here</span>
      <strong>Tell us what you need</strong>
      <small>Fast Canada-wide matching request.</small>
    </a>
    <a class="home-nav-card" href="${matchingUrl({ type: 'car' })}">
      <span>Cars</span>
      <strong>Sedans & hatchbacks</strong>
      <small>Commuter cars, budget-friendly options, and daily drivers.</small>
    </a>
    <a class="home-nav-card" href="${matchingUrl({ type: 'suv' })}">
      <span>SUVs</span>
      <strong>Family SUVs</strong>
      <small>AWD, family space, crossovers, and larger options.</small>
    </a>
    <a class="home-nav-card" href="${matchingUrl({ type: 'truck' })}">
      <span>Trucks</span>
      <strong>Pickup options</strong>
      <small>4x4, work trucks, towing, and larger vehicle options.</small>
    </a>
    <a class="home-nav-card" href="contact.html">
      <span>Contact</span>
      <strong>Talk to our team</strong>
      <small>Questions before applying? Reach out.</small>
    </a>`;
  }
  renderDeliveryShowcase(d.deliveries || []);
}

// ── Render Homepage ──
async function renderHome() {
  const d = await siteData();
  const inv = (d.inventory || []).filter(v => isPublicVehicle(v) && v.featured !== false);
  renderHomepageNavigationPreview(d, inv);

  // Hero carousel
  const hero = $('#heroInventory');
  if (hero) {
    hero.innerHTML = inv.slice(0, 8).map(heroCarCard).join('');
    // Dots
    const dots = $('#heroDots');
    if (dots && inv.length > 1) {
      const count = Math.min(inv.length, 8);
      dots.innerHTML = Array.from({ length: count }, (_, i) =>
        `<span class="${i === 0 ? 'active' : ''}" data-dot="${i}"></span>`
      ).join('');
      // Sync dots with scroll
      hero.addEventListener('scroll', () => {
        const idx = Math.round(hero.scrollLeft / hero.offsetWidth * 1.25);
        $$('[data-dot]', dots).forEach((d, i) => d.classList.toggle('active', i === idx));
      }, { passive: true });
      $$('[data-dot]', dots).forEach(dot => {
        dot.addEventListener('click', () => {
          const i = Number(dot.dataset.dot);
          const cards = $$('.hero-car', hero);
          if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        });
      });
    }
  }

  // Featured inventory horizontal scroll
  const feat = $('#featuredInventory');
  if (feat) feat.innerHTML = inv.map(vehicleCard).join('');

  // Reviews
  const reviews = $('#reviewsGrid');
  if (reviews) {
    reviews.innerHTML = (d.testimonials || []).map(r => `
      <div class="review-card">
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"${r.text}"</p>
        <div class="review-author">${r.name}</div>
        <div class="review-verified">Verified buyer</div>
      </div>`).join('');
  }

  if (reviews && !reviews.innerHTML.trim()) {
    reviews.innerHTML = `
      <div class="review-card">
        <div class="review-stars">Vehicle Matching</div>
        <p class="review-text">Tell us what you are looking for and we will help narrow down realistic next steps.</p>
        <div class="review-author">Simple request</div>
        <div class="review-verified">No sensitive info on the public form</div>
      </div>
      <div class="review-card">
        <div class="review-stars">Canada-Wide</div>
        <p class="review-text">Winnipeg-based support for customers across provinces and many credit situations.</p>
        <div class="review-author">Flexible support</div>
        <div class="review-verified">Approval subject to lender requirements</div>
      </div>
      <div class="review-card">
        <div class="review-stars">Real Follow-Up</div>
        <p class="review-text">Your request goes to the team so they can contact you about options that fit your situation.</p>
        <div class="review-author">Fast contact</div>
        <div class="review-verified">Phone, text, or email with consent</div>
      </div>`;
  }

  // Stats
  const statEl = $('#statVehicles');
  if (statEl) statEl.textContent = inv.length || '—';

  // Remote badge
  const remote = $('#remoteInventoryStatus');
  if (remote && d.remoteInventory) remote.style.display = 'inline-flex';
}

// ── Render Inventory Page ──
async function renderInventory() {
  if (!$('#inventoryGrid')) return;

  const d = await siteData();
  let all = (d.inventory || []).filter(isPublicVehicle);
  const grid = $('#inventoryGrid');

  // Populate filters
  const makes = [...new Set(all.map(v => v.make).filter(Boolean))].sort();
  const bodies = [...new Set(all.map(v => v.bodyStyle).filter(Boolean))].sort();

  $('#makeFilter').innerHTML = '<option value="">All makes</option>' + makes.map(x => `<option>${x}</option>`).join('');
  $('#bodyFilter').innerHTML = '<option value="">All body styles</option>' + bodies.map(x => `<option>${x}</option>`).join('');

  // Remote badge
  const remote = $('#remoteInventoryStatus');
  if (remote && d.remoteInventory) remote.style.display = 'inline-flex';

  function apply() {
    const q = $('#searchInput').value.toLowerCase();
    const make = $('#makeFilter').value;
    const body = $('#bodyFilter').value;
    const max = $('#priceFilter').value;
    const sort = $('#sortFilter').value;

    let data = all.filter(v =>
      (!q || `${v.year} ${v.make} ${v.model} ${v.trim} ${v.vin || ''}`.toLowerCase().includes(q)) &&
      (!make || v.make === make) &&
      (!body || v.bodyStyle === body) &&
      (!max || v.price <= +max)
    );

    if (sort === 'newest') data.sort((a, b) => (b.year || 0) - (a.year || 0));
    if (sort === 'price-low') data.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'price-high') data.sort((a, b) => (b.price || 0) - (a.price || 0));

    // Count
    const countEl = $('#inventoryCount');
    if (countEl) countEl.innerHTML = `<strong>${data.length}</strong> example${data.length !== 1 ? 's' : ''} shown`;

    grid.innerHTML = data.map(v => vehicleCard(v)).join('') ||
      `<div class="no-results"><h3>No examples found</h3><p>Start a matching request and we will look for realistic vehicle options for you.</p><a class="btn" href="financing.html#approval">Start Matching</a></div>`;
  }

  ['searchInput', 'makeFilter', 'bodyFilter', 'priceFilter', 'sortFilter'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('input', apply);
  });
  apply();
}

// ── Lightbox ──
let galleryImages = [], galleryIndex = 0;

function openLightbox(i) {
  galleryIndex = i;
  const lb = $('#lightbox'), img = $('#lightboxImg'), counter = $('#lightboxCounter');
  if (!lb || !img) return;
  img.src = galleryImages[galleryIndex];
  if (counter) counter.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function moveLightbox(delta) {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex + delta + galleryImages.length) % galleryImages.length;
  const img = $('#lightboxImg');
  const counter = $('#lightboxCounter');
  if (img) img.src = galleryImages[galleryIndex];
  if (counter) counter.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
}

function closeLightbox() {
  const lb = $('#lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Render Vehicle Detail Page ──
async function renderVehicle() {
  if (!$('#vehicleDetail')) return;

  const d = await siteData();
  const id = new URLSearchParams(location.search).get('id');
  const publicInv = (d.inventory || []).filter(isPublicVehicle);
  const v = publicInv.find(x => x.id === id) || publicInv[0];

  if (!v) {
    $('#vehicleDetail').innerHTML = `<div class="card" style="padding:40px;text-align:center;">
      <h2>Vehicle Not Found</h2>
      <p class="lead" style="margin:16px 0 24px;">This vehicle may have been removed or sold.</p>
      <a class="btn" href="financing.html#approval">Start Matching</a>
    </div>`;
    return;
  }

  galleryImages = images(v);
  const photoCount = galleryImages.length;

  // Features HTML
  const featureHtml = (v.features || []).slice(0, 12).map(f =>
    `<div class="feature-chip">${f}</div>`
  ).join('');

  // Trim badge
  const trimBadge = v.trim ? `<span class="trim-badge">${v.trim}</span>` : '';

  // Description
  const desc = v.description || 'Contact Maple Leaf Motors for more details about this vehicle.';

  // Update page title
  document.title = `${title(v)} | Maple Leaf Motors`;

  $('#vehicleDetail').innerHTML = `
    <div class="vehicle-breadcrumb">
      <a href="index.html">Home</a>
      <span>›</span>
      <a href="financing.html#approval">Vehicle Examples</a>
      <span>›</span>
      <span style="color:var(--ink);">${title(v)}</span>
    </div>

    <div class="vehicle-layout">
      <!-- Media -->
      <div class="vehicle-media-card">
        <div class="gallery-main">
          <img id="mainVehicleImage" src="${galleryImages[0] || ''}" alt="${title(v)}">
          ${galleryImages.length > 1 ? `
          <button class="gallery-overlay-btn gallery-prev" id="galleryPrev">‹</button>
          <button class="gallery-overlay-btn gallery-next" id="galleryNext">›</button>
          ` : ''}
          <div class="gallery-count">📷 ${photoCount} photo${photoCount === 1 ? '' : 's'}</div>
          <div class="gallery-zoom-hint">🔍 Tap to expand</div>
        </div>
        ${galleryImages.length > 1 ? `
        <div class="thumb-row">
          ${galleryImages.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}" data-thumb="${i}" alt="Photo ${i + 1}" loading="lazy">`).join('')}
        </div>` : ''}
      </div>

      <!-- Info Panel -->
      <aside class="vehicle-info-card">
        <span class="pill">${v.bodyStyle || 'Vehicle'}</span>
        <div class="vehicle-title-block">
          <h1>${title(v)}</h1>
          ${trimBadge}
        </div>

        <div class="price-display">
          <div class="main-price">${money(v.price)}</div>
          ${paymentLine(v, true)}
        </div>

        <div class="detail-facts">
          <div class="fact"><span>Kilometres</span><strong>${km(v).toLocaleString()} km</strong></div>
          <div class="fact"><span>Drivetrain</span><strong>${v.drivetrain || 'Ask us'}</strong></div>
          <div class="fact"><span>Transmission</span><strong>${v.transmission || 'Ask us'}</strong></div>
          <div class="fact"><span>Fuel Type</span><strong>${v.fuel || 'Ask us'}</strong></div>
          ${v.year ? `<div class="fact"><span>Year</span><strong>${v.year}</strong></div>` : ''}
          ${v.color || v.colour ? `<div class="fact"><span>Colour</span><strong>${v.color || v.colour}</strong></div>` : ''}
        </div>

        ${desc ? `
        <div class="description-section">
          <h4>About This Vehicle</h4>
          <div class="description-box">${desc}</div>
        </div>` : ''}

        ${featureHtml ? `
        <div class="features-section">
          <h4>Key Features</h4>
          <div class="features-grid">${featureHtml}</div>
        </div>` : ''}

        <p class="vehicle-example-note">${disclaimerText()}</p>
        <div class="cta-stack">
          <a class="btn btn-full btn-lg" href="financing.html?vehicle=${encodeURIComponent(v.id)}#approval">Start Matching →</a>
          <a class="btn btn-full btn-outline" href="tel:12045092668">📞 Call 204-509-2668</a>
          <a class="btn btn-ghost btn-full" href="financing.html#approval" style="text-align:center;">See What I Qualify For</a>
        </div>
        <p class="cta-note">No sensitive info collected · All credit situations welcome</p>
      </aside>
    </div>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
      <button class="lightbox-close" id="lightboxClose">✕</button>
      <button class="lightbox-btn lightbox-prev" id="lightboxPrev">‹</button>
      <div class="lightbox-img-wrap">
        <img id="lightboxImg" src="" alt="Vehicle photo">
      </div>
      <button class="lightbox-btn lightbox-next" id="lightboxNext">›</button>
      <div class="lightbox-counter" id="lightboxCounter">1 / ${photoCount}</div>
    </div>
  `;

  // Gallery interactions
  const main = $('#mainVehicleImage');
  let currentIdx = 0;

  function setMainImage(i) {
    currentIdx = i;
    if (main) {
      main.style.opacity = '.5';
      setTimeout(() => { main.src = galleryImages[i]; main.style.opacity = '1'; }, 80);
    }
    $$('[data-thumb]').forEach(x => x.classList.toggle('active', Number(x.dataset.thumb) === i));
  }

  if (main) main.onclick = () => openLightbox(currentIdx);

  $$('[data-thumb]').forEach(t => t.onclick = () => setMainImage(Number(t.dataset.thumb)));

  const gPrev = $('#galleryPrev');
  const gNext = $('#galleryNext');
  if (gPrev) gPrev.onclick = (e) => { e.preventDefault(); setMainImage((currentIdx - 1 + galleryImages.length) % galleryImages.length); };
  if (gNext) gNext.onclick = (e) => { e.preventDefault(); setMainImage((currentIdx + 1) % galleryImages.length); };

  $('#lightboxClose').onclick = closeLightbox;
  $('#lightboxPrev').onclick = () => moveLightbox(-1);
  $('#lightboxNext').onclick = () => moveLightbox(1);
  $('#lightbox').onclick = e => { if (e.target.id === 'lightbox') closeLightbox(); };

  document.addEventListener('keydown', e => {
    if (!$('#lightbox')?.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
  });

  // Touch swipe on main image
  let touchStartX = 0;
  if (main) {
    main.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) setMainImage((currentIdx + (dx < 0 ? 1 : -1) + galleryImages.length) % galleryImages.length);
    });
  }

  // Render similar vehicles below the detail
  renderSimilarVehicles(v, d);
}

// ── Similar Vehicles ──
function renderSimilarVehicles(current, d) {
  const container = $('#similarVehicles');
  if (!container) return;

  const all = (d.inventory || []).filter(v => isPublicVehicle(v) && v.id !== current.id);

  // Score by similarity: same body style, same make, similar price range
  function score(v) {
    let s = 0;
    if (v.bodyStyle && v.bodyStyle === current.bodyStyle) s += 3;
    if (v.make && v.make === current.make) s += 2;
    const priceDiff = Math.abs(Number(v.price || 0) - Number(current.price || 0));
    if (priceDiff < 5000) s += 2;
    else if (priceDiff < 10000) s += 1;
    if (v.featured) s += 1;
    return s;
  }

  const similar = all
    .map(v => ({ v, s: score(v) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(x => x.v);

  if (!similar.length) {
    container.closest('.similar-section')?.remove();
    return;
  }

  container.innerHTML = similar.map(vehicleCard).join('');
}


function saveLead(d) {
  d.createdAt = new Date().toISOString();
  d.status = 'NEW LEAD';
  d.notes = [];
  let leads = JSON.parse(localStorage.getItem('mlm_leads') || '[]');
  leads.unshift(d);
  localStorage.setItem('mlm_leads', JSON.stringify(leads));
}

// ── Approval Wizard ──
function wizard() {
  const f = $('#approvalWizard');
  if (!f) return;
  let step = 0, data = {}, steps = $$('.step', f);

  function show() {
    steps.forEach((e, i) => e.classList.toggle('active', i === step));
    const fill = $('#progressFill');
    if (fill) fill.style.width = ((step + 1) / steps.length * 100) + '%';
    window.scrollTo({ top: f.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }

  // Pre-fill vehicle if coming from vehicle page
  const vid = new URLSearchParams(location.search).get('vehicle');
  if (vid) data.vehicle = vid;

  $$('.option', f).forEach(o => o.onclick = () => {
    const p = o.closest('.step');
    $$('.option', p).forEach(x => x.classList.remove('selected'));
    o.classList.add('selected');
    data[p.dataset.name] = o.dataset.value;
  });

  $$('.next', f).forEach(b => b.onclick = () => { if (step < steps.length - 1) { step++; show(); } });
  $$('.back', f).forEach(b => b.onclick = () => { if (step > 0) { step--; show(); } });

  f.onsubmit = e => {
    e.preventDefault();
    Object.assign(data, Object.fromEntries(new FormData(f).entries()));
    data.type = 'Vehicle Matching Request';
    saveLead(data);
    f.innerHTML = `<div style="text-align:center;padding:48px 20px;">
      <div style="font-size:48px;margin-bottom:20px;">✅</div>
      <h2>Request Received</h2>
      <p class="lead" style="margin:14px 0 28px;">A Maple Leaf Motors specialist will contact you shortly to discuss your options.</p>
      <a class="btn btn-lg" href="financing.html#approval">Start Matching →</a>
    </div>`;
  };

  show();
}

// ── Generic Lead Forms ──
function forms() {
  $$('[data-lead-form]').forEach(f => f.onsubmit = e => {
    e.preventDefault();
    let d = Object.fromEntries(new FormData(f).entries());
    d.type = f.dataset.leadForm;
    saveLead(d);
    f.innerHTML = `<div style="text-align:center;padding:32px 16px;">
      <div style="font-size:40px;margin-bottom:14px;">✅</div>
      <h3 style="margin-bottom:8px;">Message Received</h3>
      <p style="color:var(--muted);font-family:var(--font-ui);">A specialist will follow up with you soon.</p>
    </div>`;
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  nav();
  renderHome();
  renderInventory();
  renderVehicle();
  wizard();
  forms();
});
