
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const LIVE_INVENTORY_API="https://maple-leaf-inventory.sal96wpg.workers.dev/inventory";

async function loadConfig(){
  try{
    const res = await fetch('assets/data/config.json', {cache:'no-store'});
    if(!res.ok) throw new Error('No config');
    const config = await res.json();
    return { inventoryApiUrl: config.inventoryApiUrl || LIVE_INVENTORY_API };
  }catch(e){
    return { inventoryApiUrl: LIVE_INVENTORY_API };
  }
}

async function siteData(){
  let fallback = {inventory:[],testimonials:[]};

  try{
    const res = await fetch('assets/data/site-data.json', {cache:'no-store'});
    if(res.ok) fallback = await res.json();
  }catch(e){
    console.warn('Static inventory failed:', e);
  }

  const cfg = await loadConfig();

  if(cfg.inventoryApiUrl){
    try{
      const remote = await fetch(cfg.inventoryApiUrl, {cache:'no-store'});
      if(remote.ok){
        const inventory = await remote.json();
        if(Array.isArray(inventory)){
          fallback.inventory = inventory;
          fallback.remoteInventory = true;
          return fallback;
        }
      }
    }catch(e){
      console.warn('Remote inventory failed, using fallback inventory:', e);
    }
  }

  const local = localStorage.getItem('mlm_site_data');
  if(local){
    try{
      const localData = JSON.parse(local);
      return localData;
    }catch(e){
      console.warn('Local storage inventory failed:', e);
    }
  }

  return fallback;
}

function money(n){return `$${Number(n||0).toLocaleString()}`}
function monthly(price){const p=Number(price||0)*1.12,r=.079/12,m=84;return Math.round(p*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1))}
function biweekly(price){return Math.round(monthly(price)*12/26)}
function nav(){const b=$('#mobileToggle'),l=$('#navLinks');if(b)b.onclick=()=>l.classList.toggle('open')}
function images(v){return (Array.isArray(v.images)&&v.images.length?v.images:[v.image]).filter(Boolean)}
function image(v){return images(v)[0]||''}
function km(v){return Number(v.mileage||v.kilometers||0)}
function title(v){return `${v.year||''} ${v.make||''} ${v.model||''}`.trim()}
function vehicleCard(v, wide=false){
  return `<article class="card vehicle-card ${wide?'wide':''}">
    <a href="vehicle.html?id=${encodeURIComponent(v.id)}"><img src="${image(v)}" alt="${title(v)}"></a>
    <div class="vehicle-body">
      <span class="pill">${v.bodyStyle||'Vehicle'}</span>
      <h3>${title(v)}</h3>
      <div class="vehicle-meta"><span>${km(v).toLocaleString()} km</span><span>${v.drivetrain||v.trim||''}</span></div>
      <div class="price">${money(v.price)}</div>
      <p class="muted">Est. $${biweekly(v.price)}/biweekly OAC</p>
      <div class="vehicle-actions">
        <a class="btn small light" href="vehicle.html?id=${encodeURIComponent(v.id)}">View Details</a>
        <a class="btn small" href="financing.html?vehicle=${encodeURIComponent(v.id)}">Get Approved</a>
      </div>
    </div>
  </article>`;
}

async function renderHome(){
  const d=await siteData();
  const inv=(d.inventory||[]).filter(v=>v.featured!==false&&!v.sold);
  const hero=$('#heroInventory'),feat=$('#featuredInventory'),reviews=$('#reviewsGrid');

  if(hero)hero.innerHTML=inv.slice(0,8).map(v=>`<div class="hero-car">
    <a href="vehicle.html?id=${encodeURIComponent(v.id)}"><img src="${image(v)}" alt="${title(v)}"></a>
    <div class="hero-car-body">
      <span class="pill">Featured</span>
      <h3>${title(v)}</h3>
      <p>${km(v).toLocaleString()} km · ${money(v.price)}</p>
      <a class="btn small" href="vehicle.html?id=${encodeURIComponent(v.id)}">View Vehicle</a>
    </div>
  </div>`).join('');

  if(feat)feat.innerHTML=inv.map(v=>vehicleCard(v)).join('');

  if(reviews)reviews.innerHTML=(d.testimonials||[]).map(r=>`<div class="card" style="padding:22px"><div class="review-stars">★★★★★</div><p>"${r.text}"</p><strong>${r.name}</strong></div>`).join('');

  const remote=$('#remoteInventoryStatus');
  if(remote&&d.remoteInventory)remote.style.display='inline-flex';
}

async function renderInventory(){
  if(!$('#inventoryGrid'))return;

  const d=await siteData();
  let all=d.inventory||[],grid=$('#inventoryGrid');

  let makes=[...new Set(all.map(v=>v.make).filter(Boolean))].sort(),
      bodies=[...new Set(all.map(v=>v.bodyStyle).filter(Boolean))].sort();

  $('#makeFilter').innerHTML='<option value="">All makes</option>'+makes.map(x=>`<option>${x}</option>`).join('');
  $('#bodyFilter').innerHTML='<option value="">All body styles</option>'+bodies.map(x=>`<option>${x}</option>`).join('');

  function apply(){
    let q=$('#searchInput').value.toLowerCase(),
        make=$('#makeFilter').value,
        body=$('#bodyFilter').value,
        max=$('#priceFilter').value,
        sort=$('#sortFilter').value;

    let data=all.filter(v=>
      (!q||`${v.year} ${v.make} ${v.model} ${v.trim} ${v.vin||''}`.toLowerCase().includes(q)) &&
      (!make||v.make===make) &&
      (!body||v.bodyStyle===body) &&
      (!max||v.price<=+max)
    );

    if(sort==='newest')data.sort((a,b)=>(b.year||0)-(a.year||0));
    if(sort==='price-low')data.sort((a,b)=>(a.price||0)-(b.price||0));
    if(sort==='price-high')data.sort((a,b)=>(b.price||0)-(a.price||0));

    grid.innerHTML=data.map(v=>vehicleCard(v)).join('')||'<p>No matching vehicles found.</p>';
  }

  ['searchInput','makeFilter','bodyFilter','priceFilter','sortFilter'].forEach(id=>{
    const el=$('#'+id);
    if(el) el.addEventListener('input',apply);
  });
  apply();
}

let galleryImages=[],galleryIndex=0;
function openLightbox(i){galleryIndex=i;const lb=$('#lightbox'),img=$('#lightboxImg');if(!lb||!img)return;img.src=galleryImages[galleryIndex];lb.classList.add('open')}
function moveLightbox(delta){if(!galleryImages.length)return;galleryIndex=(galleryIndex+delta+galleryImages.length)%galleryImages.length;$('#lightboxImg').src=galleryImages[galleryIndex]}
function closeLightbox(){const lb=$('#lightbox');if(lb)lb.classList.remove('open')}

async function renderVehicle(){
  if(!$('#vehicleDetail'))return;

  const d=await siteData();
  const id=new URLSearchParams(location.search).get('id');
  const v=(d.inventory||[]).find(x=>x.id===id)||d.inventory?.[0];

  if(!v){
    $('#vehicleDetail').innerHTML='<div class="card" style="padding:28px"><h2>Vehicle not found</h2><p class="lead">This vehicle may have been removed or sold.</p><a class="btn" href="inventory.html">Back to Inventory</a></div>';
    return;
  }

  galleryImages=images(v);
  const featureHtml=(v.features||[]).slice(0,10).map(f=>`<div class="check">${f}</div>`).join('');
  const photoCount = galleryImages.length;

  $('#vehicleDetail').innerHTML=`<div class="vehicle-layout">
    <div class="vehicle-media-card">
      <div class="gallery-main">
        <img id="mainVehicleImage" src="${galleryImages[0]||''}" alt="${title(v)}">
        <div class="gallery-count">${photoCount} photo${photoCount===1?'':'s'}</div>
      </div>
      <div class="thumb-row">${galleryImages.map((src,i)=>`<img src="${src}" class="${i===0?'active':''}" data-thumb="${i}" alt="Vehicle photo ${i+1}">`).join('')}</div>
    </div>

    <aside class="card vehicle-info-card">
      <span class="pill">${v.bodyStyle||'Vehicle'}</span>
      <h1>${title(v)}</h1>
      <div class="detail-price">${money(v.price)}</div>
      <p class="muted">Est. $${biweekly(v.price)}/biweekly OAC</p>

      <div class="detail-facts">
        <div class="fact"><span>Kilometres</span><strong>${km(v).toLocaleString()} km</strong></div>
        <div class="fact"><span>Drivetrain</span><strong>${v.drivetrain||'Ask us'}</strong></div>
        <div class="fact"><span>Transmission</span><strong>${v.transmission||'Ask us'}</strong></div>
        <div class="fact"><span>Fuel</span><strong>${v.fuel||'Ask us'}</strong></div>
      </div>

      <div class="description-box">${v.description||'Contact Maple Leaf Motors for more details about this vehicle.'}</div>

      ${featureHtml?`<div class="check-grid">${featureHtml}</div>`:''}

      <br>
      <div class="cta-stack">
        <a class="btn" href="financing.html?vehicle=${encodeURIComponent(v.id)}">Start Approval</a>
        <a class="btn light" href="tel:12049630348">Call (204) 963-0348</a>
        <a class="btn light" href="inventory.html">Back to Inventory</a>
      </div>
    </aside>
  </div>

  <div class="lightbox" id="lightbox">
    <button class="lightbox-close" id="lightboxClose">×</button>
    <button class="lightbox-btn lightbox-prev" id="lightboxPrev">‹</button>
    <img id="lightboxImg" src="">
    <button class="lightbox-btn lightbox-next" id="lightboxNext">›</button>
  </div>`;

  const main=$('#mainVehicleImage');
  if(main) main.onclick=()=>openLightbox(0);

  $$('[data-thumb]').forEach(t=>t.onclick=()=>{
    const i=Number(t.dataset.thumb);
    galleryIndex=i;
    $('#mainVehicleImage').src=galleryImages[i];
    $$('[data-thumb]').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
  });

  $('#lightboxClose').onclick=closeLightbox;
  $('#lightboxPrev').onclick=()=>moveLightbox(-1);
  $('#lightboxNext').onclick=()=>moveLightbox(1);
  $('#lightbox').onclick=e=>{if(e.target.id==='lightbox')closeLightbox()};
  document.addEventListener('keydown',e=>{
    if(!$('#lightbox')?.classList.contains('open'))return;
    if(e.key==='Escape')closeLightbox();
    if(e.key==='ArrowLeft')moveLightbox(-1);
    if(e.key==='ArrowRight')moveLightbox(1);
  });
}

function saveLead(d){
  d.createdAt=new Date().toISOString();
  d.status='NEW LEAD';
  d.notes=[];
  let leads=JSON.parse(localStorage.getItem('mlm_leads')||'[]');
  leads.unshift(d);
  localStorage.setItem('mlm_leads',JSON.stringify(leads));
}

function wizard(){
  const f=$('#approvalWizard');
  if(!f)return;
  let step=0,data={},steps=$$('.step',f);
  function show(){steps.forEach((e,i)=>e.classList.toggle('active',i===step));$('#progressFill').style.width=((step+1)/steps.length*100)+'%'}
  $$('.option',f).forEach(o=>o.onclick=()=>{const p=o.closest('.step');$$('.option',p).forEach(x=>x.classList.remove('selected'));o.classList.add('selected');data[p.dataset.name]=o.dataset.value});
  $$('.next',f).forEach(b=>b.onclick=()=>{if(step<steps.length-1){step++;show()}});
  $$('.back',f).forEach(b=>b.onclick=()=>{if(step>0){step--;show()}});
  f.onsubmit=e=>{e.preventDefault();Object.assign(data,Object.fromEntries(new FormData(f).entries()));data.type='Approval Request';saveLead(data);f.innerHTML='<div class="card" style="padding:28px"><h2>Request received.</h2><p class="lead">A Maple Leaf Motors specialist will contact you shortly.</p><a class="btn" href="inventory.html">Browse Inventory</a></div>'};
  show();
}

function forms(){
  $$('[data-lead-form]').forEach(f=>f.onsubmit=e=>{
    e.preventDefault();
    let d=Object.fromEntries(new FormData(f).entries());
    d.type=f.dataset.leadForm;
    saveLead(d);
    f.innerHTML='<div class="card" style="padding:28px"><h3>Request received.</h3><p class="muted">A specialist will follow up soon.</p></div>';
  });
}

document.addEventListener('DOMContentLoaded',()=>{nav();renderHome();renderInventory();renderVehicle();wizard();forms()});
