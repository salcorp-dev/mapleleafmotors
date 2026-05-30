const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];

async function loadConfig(){
  try{
    const res = await fetch('assets/data/config.json', {cache:'no-store'});
    if(!res.ok) throw new Error('No config');
    return await res.json();
  }catch(e){
    return { inventoryApiUrl: "" };
  }
}

async function siteData(){
  let fallback = {inventory:[],testimonials:[]};

  try{
    const res = await fetch('assets/data/site-data.json', {cache:'no-store'});
    if(res.ok){
      fallback = await res.json();
    }
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

function monthly(price){const p=Number(price||0)*1.12,r=.079/12,m=84;return Math.round(p*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1))}
function biweekly(price){return Math.round(monthly(price)*12/26)}
function nav(){const b=$('#mobileToggle'),l=$('#navLinks');if(b)b.onclick=()=>l.classList.toggle('open')}
function images(v){return (Array.isArray(v.images)&&v.images.length?v.images:[v.image]).filter(Boolean)}
function image(v){return images(v)[0]||''}
function vehicleCard(v, wide=false){return `<article class="card vehicle-card ${wide?'wide':''}"><img src="${image(v)}" alt="${v.year} ${v.make} ${v.model}"><div class="vehicle-body"><span class="pill">${v.bodyStyle||'Vehicle'}</span><h3>${v.year} ${v.make} ${v.model}</h3><div class="vehicle-meta"><span>${Number(v.mileage||v.kilometers||0).toLocaleString()} km</span><span>${v.trim||''}</span></div><div class="price">$${Number(v.price||0).toLocaleString()}</div><p class="muted">Est. $${biweekly(v.price)}/biweekly OAC</p><div class="vehicle-actions"><a class="btn small light" href="vehicle.html?id=${encodeURIComponent(v.id)}">View</a><a class="btn small" href="financing.html?vehicle=${encodeURIComponent(v.id)}">Get Approved</a></div></div></article>`}

async function renderHome(){
  const d=await siteData();
  const inv=(d.inventory||[]).filter(v=>v.featured!==false&&!v.sold);
  const hero=$('#heroInventory'),feat=$('#featuredInventory'),reviews=$('#reviewsGrid');

  if(hero)hero.innerHTML=inv.slice(0,8).map(v=>`<div class="hero-car"><img src="${image(v)}"><div class="hero-car-body"><span class="pill">Featured</span><h3>${v.year} ${v.make} ${v.model}</h3><p>${Number(v.mileage||v.kilometers||0).toLocaleString()} km · $${Number(v.price||0).toLocaleString()}</p><a class="btn small" href="vehicle.html?id=${v.id}">View Vehicle</a></div></div>`).join('');

  if(feat)feat.innerHTML=inv.map(v=>vehicleCard(v)).join('');

  if(reviews)reviews.innerHTML=(d.testimonials||[]).map(r=>`<div class="card"><div class="review-stars">★★★★★</div><p>"${r.text}"</p><strong>${r.name}</strong></div>`).join('');

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
      (!q||`${v.year} ${v.make} ${v.model} ${v.trim}`.toLowerCase().includes(q)) &&
      (!make||v.make===make) &&
      (!body||v.bodyStyle===body) &&
      (!max||v.price<=+max)
    );

    if(sort==='newest')data.sort((a,b)=>(b.year||0)-(a.year||0));
    if(sort==='price-low')data.sort((a,b)=>(a.price||0)-(b.price||0));
    if(sort==='price-high')data.sort((a,b)=>(b.price||0)-(a.price||0));

    grid.innerHTML=data.map(v=>vehicleCard(v)).join('')||'<p>No matching vehicles found.</p>';
  }

  ['searchInput','makeFilter','bodyFilter','priceFilter','sortFilter'].forEach(id=>$('#'+id).addEventListener('input',apply));
  apply();
}

let galleryImages=[],galleryIndex=0;

function openLightbox(i){
  galleryIndex=i;
  const lb=$('#lightbox');
  const img=$('#lightboxImg');
  if(!lb||!img)return;
  img.src=galleryImages[galleryIndex];
  lb.classList.add('open');
}

function moveLightbox(delta){
  galleryIndex=(galleryIndex+delta+galleryImages.length)%galleryImages.length;
  $('#lightboxImg').src=galleryImages[galleryIndex];
}

function closeLightbox(){
  const lb=$('#lightbox');
  if(lb)lb.classList.remove('open');
}

async function renderVehicle(){
  if(!$('#vehicleDetail'))return;

  const d=await siteData();
  const id=new URLSearchParams(location.search).get('id');
  const v=(d.inventory||[]).find(x=>x.id===id)||d.inventory?.[0];

  if(!v)return;

  galleryImages=images(v);
  const featureHtml=(v.features||[]).map(f=>`<div class="check">${f}</div>`).join('');

  $('#vehicleDetail').innerHTML=`<div class="grid-2"><div><div class="gallery-main"><img id="mainVehicleImage" src="${galleryImages[0]||''}" alt="${v.year} ${v.make} ${v.model}"></div><div class="thumb-row">${galleryImages.map((src,i)=>`<img src="${src}" class="${i===0?'active':''}" data-thumb="${i}" alt="Vehicle photo ${i+1}">`).join('')}</div></div><div class="card"><span class="pill">${v.bodyStyle||'Vehicle'}</span><h1>${v.year} ${v.make} ${v.model}</h1><p class="lead">${v.trim||''}</p><div class="price">$${Number(v.price||0).toLocaleString()}</div><p>Est. $${biweekly(v.price)}/biweekly OAC · ${Number(v.mileage||v.kilometers||0).toLocaleString()} km</p><p>${v.description||''}</p><div class="check-grid">${featureHtml}</div><br><a class="btn" href="financing.html?vehicle=${v.id}">Get Approved</a> <a class="btn light" href="tel:12049630348">Call Now</a></div></div><div class="lightbox" id="lightbox"><button class="lightbox-close" id="lightboxClose">×</button><button class="lightbox-btn lightbox-prev" id="lightboxPrev">‹</button><img id="lightboxImg" src=""><button class="lightbox-btn lightbox-next" id="lightboxNext">›</button></div>`;

  $('#mainVehicleImage').onclick=()=>openLightbox(0);

  $$('[data-thumb]').forEach(t=>t.onclick=()=>{
    const i=Number(t.dataset.thumb);
    $('#mainVehicleImage').src=galleryImages[i];
    $$('[data-thumb]').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
  });

  $('#lightboxClose').onclick=closeLightbox;
  $('#lightboxPrev').onclick=()=>moveLightbox(-1);
  $('#lightboxNext').onclick=()=>moveLightbox(1);
  $('#lightbox').onclick=e=>{if(e.target.id==='lightbox')closeLightbox()};

  document.addEventListener('keydown',e=>{
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

  function show(){
    steps.forEach((e,i)=>e.classList.toggle('active',i===step));
    $('#progressFill').style.width=((step+1)/steps.length*100)+'%';
  }

  $$('.option',f).forEach(o=>o.onclick=()=>{
    const p=o.closest('.step');
    $$('.option',p).forEach(x=>x.classList.remove('selected'));
    o.classList.add('selected');
    data[p.dataset.name]=o.dataset.value;
  });

  $$('.next',f).forEach(b=>b.onclick=()=>{
    if(step<steps.length-1){
      step++;
      show();
    }
  });

  $$('.back',f).forEach(b=>b.onclick=()=>{
    if(step>0){
      step--;
      show();
    }
  });

  f.onsubmit=e=>{
    e.preventDefault();
    Object.assign(data,Object.fromEntries(new FormData(f).entries()));
    data.type='Approval Request';
    saveLead(data);
    f.innerHTML='<div class="card"><h2>Request received.</h2><p class="lead">A Maple Leaf Motors specialist will contact you shortly.</p><a class="btn" href="inventory.html">Browse Inventory</a></div>';
  };

  show();
}

function forms(){
  $$('[data-lead-form]').forEach(f=>f.onsubmit=e=>{
    e.preventDefault();
    let d=Object.fromEntries(new FormData(f).entries());
    d.type=f.dataset.leadForm;
    saveLead(d);
    f.innerHTML='<div class="card"><h3>Request received.</h3><p class="muted">A specialist will follow up soon.</p></div>';
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  nav();
  renderHome();
  renderInventory();
  renderVehicle();
  wizard();
  forms();
});
