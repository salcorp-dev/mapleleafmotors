const ADMIN_SESSION_KEY = 'mlm_admin_session';
const STATUSES = ['NEW LEAD','CONTACTED','APPLICATION SENT','DEALERTRACK SUBMITTED','APPROVED','NEEDS COSIGNER','VEHICLE SELECTED','DELIVERED','LOST'];

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

let CONFIG_CACHE = null;

async function loadConfig() {
  if (CONFIG_CACHE) return CONFIG_CACHE;
  try {
    const res = await fetch('../assets/data/config.json', { cache: 'no-store' });
    if (res.ok) {
      CONFIG_CACHE = await res.json();
      return CONFIG_CACHE;
    }
  } catch (e) {}
  CONFIG_CACHE = {
    adminApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/admin',
    clientsApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/clients'
  };
  return CONFIG_CACHE;
}

function adminToken() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function setAdminToken(token) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
  sessionStorage.setItem('mlm_admin', 'yes');
}

function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem('mlm_admin');
}

async function adminRequest(path, options = {}) {
  const config = await loadConfig();
  const base = (config.adminApiUrl || 'https://maple-leaf-inventory.sal96wpg.workers.dev/admin').replace(/\/$/, '');
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${adminToken()}`
  };

  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }

  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(data.error || `Admin request failed (${res.status})`);
  }

  return data;
}

async function verifyAdminSession() {
  if (!adminToken()) return false;
  try {
    await adminRequest('/session', { method: 'GET' });
    return true;
  } catch (e) {
    clearAdminToken();
    return false;
  }
}

async function loadData() {
  const local = localStorage.getItem('mlm_site_data');
  if (local) return JSON.parse(local);
  const res = await fetch('../assets/data/site-data.json');
  return await res.json();
}

function saveData(d) {
  localStorage.setItem('mlm_site_data', JSON.stringify(d));
}

function leads() {
  return JSON.parse(localStorage.getItem('mlm_leads') || '[]');
}

function saveLeads(l) {
  localStorage.setItem('mlm_leads', JSON.stringify(l));
}

async function protect() {
  if (!location.pathname.includes('dashboard')) return;
  const ok = await verifyAdminSession();
  if (!ok) location.href = 'index.html';
}

async function login() {
  const f = $('#loginForm');
  if (!f) return;

  f.onsubmit = async e => {
    e.preventDefault();
    const password = $('#password').value;
    const msg = $('#msg');

    try {
      const config = await loadConfig();
      const base = (config.adminApiUrl || 'https://maple-leaf-inventory.sal96wpg.workers.dev/admin').replace(/\/$/, '');
      if (msg) msg.textContent = 'Checking password...';

      const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.token) {
        throw new Error(data.error || 'Wrong password.');
      }

      setAdminToken(data.token);
      location.href = 'dashboard.html';
    } catch (err) {
      if (msg) msg.textContent = err.message || 'Login failed.';
    }
  };
}

function tabs() {
  $$('.tab').forEach(t => {
    t.onclick = () => {
      $$('.tab').forEach(x => x.classList.remove('active'));
      $$('.admin-section').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const section = $('#' + t.dataset.tab);
      if (section) section.classList.add('active');
      if (t.dataset.tab === 'leads') loadFinanceLeads();
      if (t.dataset.tab === 'inventory') loadLiveInventory();
    };
  });

  $$('.sidebar-link[data-goto]').forEach(link => {
    link.onclick = e => {
      e.preventDefault();
      const tab = $(`.tab[data-tab="${link.dataset.goto}"]`);
      if (tab) tab.click();
    };
  });
}

function readFiles(files) {
  return Promise.all([...files].map(file => new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, data: r.result, type: file.type, size: file.size, createdAt: new Date().toISOString() });
    r.readAsDataURL(file);
  })));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function fetchClientsFromApi(config) {
  if (!config.clientsApiUrl) return null;
  try {
    const res = await fetch(config.clientsApiUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function postClientToApi(config, formData) {
  if (!config.clientsApiUrl) throw new Error('Missing clients API URL.');
  const res = await fetch(config.clientsApiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken()}` },
    body: formData
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.error) throw new Error(payload.error || `Upload failed (${res.status})`);
  return payload;
}

async function deleteClientFromApi(config, type, id) {
  if (!config.clientsApiUrl) throw new Error('Missing clients API URL.');
  const base = config.clientsApiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/${type}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken()}` }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.error) throw new Error(payload.error || `Delete failed (${res.status})`);
  return payload;
}


let FINANCE_LEADS = [];
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
async function loadFinanceLeads(){if(!$('#financeLeadRows'))return;try{const res=await adminRequest('/leads',{method:'GET'});FINANCE_LEADS=Array.isArray(res.leads)?res.leads:[];renderFinanceLeads()}catch(err){$('#financeLeadRows').innerHTML=`<tr><td colspan="5">Could not load leads: ${escapeHtml(err.message)}</td></tr>`}}
function filteredFinanceLeads(){const q=($('#leadSearch')?.value||'').toLowerCase().trim();const status=$('#leadStatusFilter')?.value||'';return FINANCE_LEADS.filter(l=>{const t=[l.firstName,l.lastName,l.phone,l.email,l.city,l.vehicleType,l.creditSituation,l.incomeType,l.budget].join(' ').toLowerCase();return(!q||t.includes(q))&&(!status||l.status===status)})}
function renderFinanceLeads(){if(!$('#financeLeadRows'))return;$('#leadStatTotal').textContent=FINANCE_LEADS.length;$('#leadStatNew').textContent=FINANCE_LEADS.filter(l=>l.status==='NEW LEAD').length;$('#leadStatApproved').textContent=FINANCE_LEADS.filter(l=>l.status==='APPROVED').length;const rows=filteredFinanceLeads();$('#financeLeadRows').innerHTML=rows.map(l=>`<tr class="${l.status==='NEW LEAD'?'lead-row-new':''}"><td><strong>${escapeHtml(l.firstName)} ${escapeHtml(l.lastName)}</strong><br><a href="tel:${escapeHtml(l.phone)}">${escapeHtml(l.phone)}</a><br><a href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a><br><small>${escapeHtml(l.city)}, ${escapeHtml(l.province)}</small></td><td><b>${escapeHtml(l.vehicleType)}</b><br>Credit: ${escapeHtml(l.creditSituation)}<br>Income: ${escapeHtml(l.incomeType)}<br>Budget: ${escapeHtml(l.budget)}<br>Best time: ${escapeHtml(l.bestTime)} / ${escapeHtml(l.contactPreference)}</td><td><span class="badge-source">${escapeHtml(l.source||'website')}</span><br><small>${escapeHtml((l.createdAt||'').replace('T',' ').slice(0,16))}</small><br>${l.campaign?`<small>Campaign: ${escapeHtml(l.campaign)}</small><br>`:''}${l.placement?`<small>Placement: ${escapeHtml(l.placement)}</small>`:''}</td><td><select data-lead-status="${escapeHtml(l.id)}">${STATUSES.map(s=>`<option ${l.status===s?'selected':''}>${s}</option>`).join('')}</select><textarea class="lead-note-box" data-lead-notes="${escapeHtml(l.id)}" placeholder="Internal notes">${escapeHtml(l.notes||'')}</textarea><button class="btn small light" data-save-lead="${escapeHtml(l.id)}">Save</button></td><td><button class="btn small light" data-delete-lead="${escapeHtml(l.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No finance leads yet.</td></tr>';$$('[data-save-lead]').forEach(btn=>{btn.onclick=async()=>{const id=btn.dataset.saveLead;const status=$(`[data-lead-status="${CSS.escape(id)}"]`).value;const notes=$(`[data-lead-notes="${CSS.escape(id)}"]`).value;try{await adminRequest(`/leads/${encodeURIComponent(id)}`,{method:'PATCH',json:{status,notes}});await loadFinanceLeads()}catch(e){alert('Could not save lead: '+e.message)}}});$$('[data-delete-lead]').forEach(btn=>{btn.onclick=async()=>{if(!confirm('Delete this lead?'))return;try{await adminRequest(`/leads/${encodeURIComponent(btn.dataset.deleteLead)}`,{method:'DELETE'});await loadFinanceLeads()}catch(e){alert('Could not delete lead: '+e.message)}}})}
function exportLeadsCsv(){const rows=[['Created','Status','First Name','Last Name','Phone','Email','City','Province','Vehicle Type','Credit Situation','Income Type','Budget','Best Time','Contact Preference','Notes','Source','Campaign','Adset','Placement','FBCLID']];FINANCE_LEADS.forEach(l=>rows.push([l.createdAt,l.status,l.firstName,l.lastName,l.phone,l.email,l.city,l.province,l.vehicleType,l.creditSituation,l.incomeType,l.budget,l.bestTime,l.contactPreference,l.notes,l.source,l.campaign,l.adset,l.placement,l.fbclid]));const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'});const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=`maple-leaf-finance-leads-${new Date().toISOString().slice(0,10)}.csv`;x.click()}


let LIVE_INVENTORY = [];

async function loadLiveInventory() {
  if (!document.querySelector('#liveInventoryRows')) return;
  try {
    const res = await adminRequest('/inventory', { method: 'GET' });
    LIVE_INVENTORY = Array.isArray(res.inventory) ? res.inventory : [];
    setLiveInventoryStatus(true, `${LIVE_INVENTORY.length} live vehicle${LIVE_INVENTORY.length === 1 ? '' : 's'}`);
    renderLiveInventory();
  } catch (err) {
    setLiveInventoryStatus(false, 'Could not load live inventory');
    const rows = document.querySelector('#liveInventoryRows');
    if (rows) rows.innerHTML = `<tr><td colspan="6">Could not load live inventory: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function setLiveInventoryStatus(ok, msg) {
  const el = document.querySelector('#liveInventoryStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('warn', !ok);
}

function filteredLiveInventory() {
  const q = (document.querySelector('#liveInventorySearch')?.value || '').toLowerCase().trim();
  const filter = document.querySelector('#liveInventoryFilter')?.value || '';

  return LIVE_INVENTORY.filter(v => {
    const text = [
      v.title, v.year, v.make, v.model, v.trim, v.vin, v.stockNumber,
      v.bodyStyle, v.drivetrain, v.transmission
    ].join(' ').toLowerCase();

    const sold = !!v.sold || String(v.status || '').toLowerCase() === 'sold';
    const featured = !!v.featured;

    if (q && !text.includes(q)) return false;
    if (filter === 'available' && sold) return false;
    if (filter === 'sold' && !sold) return false;
    if (filter === 'featured' && !featured) return false;
    return true;
  });
}

function vehicleTitle(v) {
  return v.title || [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Untitled vehicle';
}

function vehicleKm(v) {
  return Number(v.mileage || v.kilometers || 0);
}

function vehicleImage(v) {
  if (Array.isArray(v.images) && v.images.length) return v.images[0];
  if (v.image) return v.image;
  return '';
}

function renderLiveInventory() {
  const rows = document.querySelector('#liveInventoryRows');
  if (!rows) return;

  const arr = filteredLiveInventory();

  rows.innerHTML = arr.map(v => {
    const sold = !!v.sold || String(v.status || '').toLowerCase() === 'sold';
    const img = vehicleImage(v);
    return `
      <tr>
        <td>${img ? `<img class="inventory-thumb" src="${escapeHtml(img)}" alt="">` : `<div class="inventory-thumb"></div>`}</td>
        <td>
          <strong>${escapeHtml(vehicleTitle(v))}</strong><br>
          <small>${escapeHtml(v.vin || '')}</small>
        </td>
        <td>
          ${vehicleKm(v).toLocaleString()} km<br>
          <small>${escapeHtml([v.bodyStyle, v.drivetrain, v.transmission].filter(Boolean).join(' · '))}</small>
        </td>
        <td><strong>$${Number(v.price || 0).toLocaleString()}</strong></td>
        <td>
          ${sold ? '<span class="status-chip warn">Sold</span>' : '<span class="status-chip ok">Available</span>'}
          ${v.featured ? '<br><span class="status-chip">Featured</span>' : ''}
        </td>
        <td>
          <button class="btn small light" data-edit-live="${escapeHtml(v.id)}">Edit</button>
          <button class="btn small light" data-toggle-sold="${escapeHtml(v.id)}">${sold ? 'Mark Available' : 'Mark Sold'}</button>
          <button class="btn small light" data-delete-live="${escapeHtml(v.id)}">Delete</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6">No live vehicles found.</td></tr>';

  document.querySelectorAll('[data-edit-live]').forEach(btn => {
    btn.onclick = () => openVehicleEdit(btn.dataset.editLive);
  });

  document.querySelectorAll('[data-toggle-sold]').forEach(btn => {
    btn.onclick = async () => {
      const v = LIVE_INVENTORY.find(x => String(x.id) === String(btn.dataset.toggleSold));
      if (!v) return;
      const sold = !!v.sold || String(v.status || '').toLowerCase() === 'sold';
      try {
        await adminRequest(`/inventory/${encodeURIComponent(v.id)}`, {
          method: 'PATCH',
          json: { sold: !sold, status: !sold ? 'sold' : 'available' }
        });
        await loadLiveInventory();
      } catch (err) {
        alert('Could not update vehicle: ' + err.message);
      }
    };
  });

  document.querySelectorAll('[data-delete-live]').forEach(btn => {
    btn.onclick = async () => {
      const v = LIVE_INVENTORY.find(x => String(x.id) === String(btn.dataset.deleteLive));
      if (!v) return;
      if (!confirm(`Delete ${vehicleTitle(v)} from the live website inventory?`)) return;
      try {
        await adminRequest(`/inventory/${encodeURIComponent(v.id)}`, { method: 'DELETE' });
        await loadLiveInventory();
      } catch (err) {
        alert('Could not delete vehicle: ' + err.message);
      }
    };
  });
}

function openVehicleEdit(id) {
  const v = LIVE_INVENTORY.find(x => String(x.id) === String(id));
  if (!v) return;

  const modal = document.querySelector('#vehicleEditModal');
  const form = document.querySelector('#vehicleEditForm');
  if (!modal || !form) return;

  form.elements.id.value = v.id || '';
  form.elements.year.value = v.year || '';
  form.elements.make.value = v.make || '';
  form.elements.model.value = v.model || '';
  form.elements.trim.value = v.trim || '';
  form.elements.price.value = v.price || '';
  form.elements.mileage.value = v.mileage || v.kilometers || '';
  form.elements.bodyStyle.value = v.bodyStyle || '';
  form.elements.drivetrain.value = v.drivetrain || '';
  form.elements.transmission.value = v.transmission || '';
  form.elements.fuel.value = v.fuel || '';
  form.elements.vin.value = v.vin || '';
  form.elements.stockNumber.value = v.stockNumber || '';
  form.elements.exteriorColor.value = v.exteriorColor || '';
  form.elements.interiorColor.value = v.interiorColor || '';
  form.elements.description.value = v.description || '';
  form.elements.features.value = Array.isArray(v.features) ? v.features.join(', ') : (v.features || '');
  form.elements.featured.checked = !!v.featured;
  form.elements.sold.checked = !!v.sold || String(v.status || '').toLowerCase() === 'sold';

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeVehicleEdit() {
  const modal = document.querySelector('#vehicleEditModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function bindLiveInventoryControls() {
  const refresh = document.querySelector('#refreshLiveInventory');
  if (refresh) refresh.onclick = loadLiveInventory;

  const search = document.querySelector('#liveInventorySearch');
  if (search) search.oninput = renderLiveInventory;

  const filter = document.querySelector('#liveInventoryFilter');
  if (filter) filter.onchange = renderLiveInventory;

  const close = document.querySelector('#closeVehicleEdit');
  if (close) close.onclick = closeVehicleEdit;

  const cancel = document.querySelector('#cancelVehicleEdit');
  if (cancel) cancel.onclick = closeVehicleEdit;

  const modal = document.querySelector('#vehicleEditModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeVehicleEdit();
    });
  }

  const form = document.querySelector('#vehicleEditForm');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();

      const fd = new FormData(form);
      const id = fd.get('id');

      const payload = {
        year: fd.get('year'),
        make: fd.get('make'),
        model: fd.get('model'),
        trim: fd.get('trim'),
        price: fd.get('price'),
        mileage: fd.get('mileage'),
        kilometers: fd.get('mileage'),
        bodyStyle: fd.get('bodyStyle'),
        drivetrain: fd.get('drivetrain'),
        transmission: fd.get('transmission'),
        fuel: fd.get('fuel'),
        vin: fd.get('vin'),
        stockNumber: fd.get('stockNumber'),
        exteriorColor: fd.get('exteriorColor'),
        interiorColor: fd.get('interiorColor'),
        description: fd.get('description'),
        features: fd.get('features'),
        featured: form.elements.featured.checked,
        sold: form.elements.sold.checked,
        status: form.elements.sold.checked ? 'sold' : 'available'
      };

      try {
        await adminRequest(`/inventory/${encodeURIComponent(id)}`, { method: 'PATCH', json: payload });
        closeVehicleEdit();
        await loadLiveInventory();
        alert('Vehicle updated.');
      } catch (err) {
        alert('Could not save vehicle: ' + err.message);
      }
    };
  }
}


async function dashboard() {
  if (!$('#leadRows')) return;

  const ok = await verifyAdminSession();
  if (!ok) {
    location.href = 'index.html';
    return;
  }

  let data = await loadData();
  let config = await loadConfig();

  data.inventory = data.inventory || [];
  data.media = data.media || [];
  data.deliveries = data.deliveries || [];
  data.testimonials = data.testimonials || [];

  async function syncClientsFromApi(showAlert = false) {
    const clients = await fetchClientsFromApi(config);
    if (clients) {
      data.deliveries = Array.isArray(clients.deliveries) ? clients.deliveries : [];
      data.testimonials = Array.isArray(clients.testimonials) ? clients.testimonials : [];
      saveData(data);
      setClientStatus(true, 'Website API connected');
      if (showAlert) alert('Client uploads refreshed from website API.');
      refresh();
      return true;
    }
    setClientStatus(false, 'Offline/local mode');
    if (showAlert) alert('Could not reach clients API. Make sure the Worker was updated with /clients.');
    return false;
  }

  function setClientStatus(ok, msg) {
    const el = $('#clientsApiStatus');
    if (!el) return;
    el.textContent = ok ? 'Website API connected' : msg;
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('warn', !ok);
  }

  function refresh() {
    saveData(data);
    if ($('#totalLeads')) $('#totalLeads').textContent = leads().length;
    if ($('#totalVehicles')) $('#totalVehicles').textContent = data.inventory.length;
    if ($('#mediaCount')) $('#mediaCount').textContent = (data.media.length || 0) + (data.deliveries || []).reduce((n, x) => n + ((x.images || []).length), 0);
    renderLeads();
    renderPipeline();
    renderInventory();
    renderClients();
  }

  function renderLeads() {
    if (!$('#leadRows')) return;
    let arr = leads();
    $('#leadRows').innerHTML = arr.map((x, i) => `
      <tr>
        <td>${escapeHtml(x.firstName || x.name || '')} ${escapeHtml(x.lastName || '')}</td>
        <td>${escapeHtml(x.phone || '')}</td>
        <td>${escapeHtml(x.type || '')}</td>
        <td><select data-status="${i}">${STATUSES.map(s => `<option ${x.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      </tr>
    `).join('');

    $$('[data-status]').forEach(s => {
      s.onchange = () => {
        let l = leads();
        l[+s.dataset.status].status = s.value;
        saveLeads(l);
        refresh();
      };
    });
  }

  function renderPipeline() {
    if (!$('#kanban')) return;
    let l = leads();
    $('#kanban').innerHTML = STATUSES.map(s => `
      <div class="lane">
        <strong>${s}</strong>
        ${l.filter(x => x.status === s).map(x => `<div class="lead-mini"><b>${escapeHtml(x.firstName || x.name || 'Lead')}</b><br><span>${escapeHtml(x.phone || '')}</span></div>`).join('')}
      </div>
    `).join('');
  }

  function renderInventory() {
    // Live inventory is managed through renderLiveInventory().
  }

  const vehicleForm = $('#vehicleForm');
  if (vehicleForm) {
    vehicleForm.onsubmit = async e => {
      e.preventDefault();
      let v = Object.fromEntries(new FormData(e.target).entries());
      v.id = v.id || 'veh-' + Date.now();
      v.year = +v.year;
      v.price = +v.price;
      v.mileage = +v.mileage;
      v.featured = !!v.featured;
      v.sold = !!v.sold;
      v.features = (v.features || '').split(',').map(x => x.trim()).filter(Boolean);

      let files = $('#vehicleImages').files;
      if (files.length) {
        let imgs = await readFiles(files);
        data.media.unshift(...imgs);
        v.images = imgs.map(x => x.data);
      }

      data.inventory.unshift(v);
      e.target.reset();
      refresh();
    };
  }

  const importData = $('#importData');
  if (importData) {
    importData.onchange = async e => {
      let f = e.target.files[0];
      if (!f) return;
      let imported = JSON.parse(await f.text());
      if (imported.vehicle) data.inventory.unshift(imported.vehicle);
      else if (imported.inventory) data.inventory = imported.inventory;
      else if (Array.isArray(imported)) data.inventory = imported;
      else if (imported.siteData) data = imported.siteData;

      data.deliveries = data.deliveries || [];
      data.testimonials = data.testimonials || [];
      refresh();
    };
  }

  const exportAll = $('#exportAll');
  if (exportAll) {
    exportAll.onclick = () => {
      let blob = new Blob([JSON.stringify({ siteData: data, leads: leads() }, null, 2)], { type: 'application/json' });
      let a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'maple-leaf-motors-export.json';
      a.click();
    };
  }

  const refreshBtn = $('#refreshClientsData');
  if (refreshBtn) refreshBtn.onclick = () => syncClientsFromApi(true);

  const deliveryFileInput = $('#adminDeliveryImages');
  const preview = $('#adminDeliveryPreview');
  if (deliveryFileInput && preview) {
    deliveryFileInput.addEventListener('change', async () => {
      preview.innerHTML = '';
      [...deliveryFileInput.files].forEach(file => {
        const r = new FileReader();
        r.onload = () => {
          const img = document.createElement('img');
          img.src = r.result;
          preview.appendChild(img);
        };
        r.readAsDataURL(file);
      });
    });
  }

  const deliveryForm = $('#adminDeliveryForm');
  if (deliveryForm) {
    deliveryForm.onsubmit = async e => {
      e.preventDefault();

      const fd = new FormData(deliveryForm);
      fd.append('type', 'delivery');
      fd.append('createdAt', new Date().toISOString());

      try {
        const uploaded = await postClientToApi(config, fd);
        data.deliveries.unshift(uploaded.entry);
        await syncClientsFromApi(false);
        alert('Delivery uploaded to the Our Clients page.');
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }

      deliveryForm.reset();
      if (preview) preview.innerHTML = '';
      refresh();
    };
  }

  const testimonialForm = $('#adminTestimonialForm');
  if (testimonialForm) {
    testimonialForm.onsubmit = async e => {
      e.preventDefault();

      const fd = new FormData(testimonialForm);
      fd.append('type', 'testimonial');
      fd.append('createdAt', new Date().toISOString());

      try {
        const uploaded = await postClientToApi(config, fd);
        data.testimonials.unshift(uploaded.entry);
        await syncClientsFromApi(false);
        alert('Review uploaded to the Our Clients page.');
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }

      testimonialForm.reset();
      refresh();
    };
  }

  const passwordForm = $('#adminPasswordForm');
  if (passwordForm) {
    passwordForm.onsubmit = async e => {
      e.preventDefault();
      const currentPassword = $('#currentAdminPassword').value;
      const newPassword = $('#newAdminPassword').value;
      const confirmPassword = $('#confirmAdminPassword').value;

      if (newPassword !== confirmPassword) {
        alert('New password and confirm password do not match.');
        return;
      }

      if (newPassword.length < 12) {
        alert('Use a stronger password with at least 12 characters.');
        return;
      }

      try {
        await adminRequest('/change-password', {
          method: 'POST',
          json: { currentPassword, newPassword }
        });
        passwordForm.reset();
        alert('Admin password changed successfully. Use the new password next time you log in.');
      } catch (err) {
        alert('Password change failed: ' + err.message);
      }
    };
  }


  bindLiveInventoryControls();
  await loadLiveInventory();

  if ($('#refreshFinanceLeads')) $('#refreshFinanceLeads').onclick = loadFinanceLeads;
  if ($('#exportFinanceLeads')) $('#exportFinanceLeads').onclick = exportLeadsCsv;
  if ($('#leadSearch')) $('#leadSearch').oninput = renderFinanceLeads;
  if ($('#leadStatusFilter')) $('#leadStatusFilter').onchange = renderFinanceLeads;
  await loadFinanceLeads();
  refresh();
  syncClientsFromApi(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  await protect();
  await login();
  tabs();
  dashboard();
});
