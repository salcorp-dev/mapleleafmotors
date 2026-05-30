
const ADMIN_PASSWORD = 'MapleLeaf2026';
const STATUSES = ['NEW LEAD','CONTACTED','APPLICATION SENT','DEALERTRACK SUBMITTED','APPROVED','VEHICLE SELECTED','DELIVERED','LOST'];
const CLIENTS_TOKEN_KEY = 'mlm_clients_api_token';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

async function loadConfig() {
  try {
    const res = await fetch('../assets/data/config.json', { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) {}
  return {
    clientsApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/clients'
  };
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

function protect() {
  if (location.pathname.includes('dashboard') && sessionStorage.getItem('mlm_admin') !== 'yes') {
    location.href = 'index.html';
  }
}

function login() {
  const f = $('#loginForm');
  if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    if ($('#password').value === ADMIN_PASSWORD) {
      sessionStorage.setItem('mlm_admin', 'yes');
      location.href = 'dashboard.html';
    } else {
      $('#msg').textContent = 'Wrong password.';
    }
  };
}

function tabs() {
  $$('.tab').forEach(t => {
    t.onclick = () => {
      $$('.tab').forEach(x => x.classList.remove('active'));
      $$('.admin-section').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('#' + t.dataset.tab).classList.add('active');
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

async function postClientToApi(config, token, formData) {
  if (!config.clientsApiUrl || !token) throw new Error('Missing API URL or API token.');
  const res = await fetch(config.clientsApiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.error) throw new Error(payload.error || `Upload failed (${res.status})`);
  return payload;
}

async function deleteClientFromApi(config, token, type, id) {
  if (!config.clientsApiUrl || !token) throw new Error('Missing API URL or API token.');
  const base = config.clientsApiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/${type}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.error) throw new Error(payload.error || `Delete failed (${res.status})`);
  return payload;
}

async function dashboard() {
  if (!$('#leadRows')) return;

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
      setClientStatus(true, 'Connected to website API');
      if (showAlert) alert('Client uploads refreshed from website API.');
      refresh();
      return true;
    }
    setClientStatus(false, 'Offline/local mode');
    if (showAlert) alert('Could not reach clients API. Using local browser data.');
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
    $('#totalLeads').textContent = leads().length;
    $('#totalVehicles').textContent = data.inventory.length;
    $('#mediaCount').textContent = (data.media.length || 0) + (data.deliveries || []).reduce((n, x) => n + ((x.images || []).length), 0);
    renderLeads();
    renderPipeline();
    renderInventory();
    renderClients();
  }

  function renderLeads() {
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
    let l = leads();
    $('#kanban').innerHTML = STATUSES.map(s => `
      <div class="lane">
        <strong>${s}</strong>
        ${l.filter(x => x.status === s).map(x => `<div class="lead-mini"><b>${escapeHtml(x.firstName || x.name || 'Lead')}</b><br><span>${escapeHtml(x.phone || '')}</span></div>`).join('')}
      </div>
    `).join('');
  }

  function renderInventory() {
    $('#vehicleRows').innerHTML = data.inventory.map((v, i) => `
      <tr>
        <td>${escapeHtml(v.year)} ${escapeHtml(v.make)} ${escapeHtml(v.model)}</td>
        <td>$${Number(v.price || 0).toLocaleString()}</td>
        <td>${Number(v.mileage || 0).toLocaleString()} km</td>
        <td>${v.featured ? 'Yes' : 'No'}</td>
        <td><button class="btn small light" data-del="${i}">Delete</button></td>
      </tr>
    `).join('');

    $$('[data-del]').forEach(b => {
      b.onclick = () => {
        if (confirm('Delete vehicle?')) {
          data.inventory.splice(+b.dataset.del, 1);
          refresh();
        }
      };
    });
  }

  function renderClients() {
    const deliveryRows = $('#deliveryRows');
    const testimonialRows = $('#testimonialRows');
    if (!deliveryRows || !testimonialRows) return;

    const deliveries = data.deliveries || [];
    const testimonials = data.testimonials || [];

    deliveryRows.innerHTML = deliveries.map((d, i) => `
      <tr>
        <td>${escapeHtml(d.clientName || 'Client')}</td>
        <td>${escapeHtml(d.vehicle || '')}</td>
        <td>${(d.images || []).length}</td>
        <td><button class="btn small light" data-delivery-delete="${escapeHtml(d.id || i)}" data-local-index="${i}">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="4">No delivery photos uploaded yet.</td></tr>';

    testimonialRows.innerHTML = testimonials.map((t, i) => `
      <tr>
        <td>${escapeHtml(t.name || 'Client')}</td>
        <td>${'★'.repeat(Number(t.rating || 5))}</td>
        <td>${escapeHtml((t.text || '').slice(0, 70))}${(t.text || '').length > 70 ? '…' : ''}</td>
        <td><button class="btn small light" data-testimonial-delete="${escapeHtml(t.id || i)}" data-local-index="${i}">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="4">No reviews uploaded yet.</td></tr>';

    $$('[data-delivery-delete]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this delivery photo entry?')) return;
        const token = localStorage.getItem(CLIENTS_TOKEN_KEY) || '';
        const id = btn.dataset.deliveryDelete;
        try {
          if (token && id && !/^\d+$/.test(id)) await deleteClientFromApi(config, token, 'deliveries', id);
          data.deliveries.splice(Number(btn.dataset.localIndex), 1);
          await syncClientsFromApi(false);
        } catch (e) {
          data.deliveries.splice(Number(btn.dataset.localIndex), 1);
          refresh();
          alert('Deleted locally. API delete did not complete: ' + e.message);
        }
      };
    });

    $$('[data-testimonial-delete]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this review?')) return;
        const token = localStorage.getItem(CLIENTS_TOKEN_KEY) || '';
        const id = btn.dataset.testimonialDelete;
        try {
          if (token && id && !/^\d+$/.test(id)) await deleteClientFromApi(config, token, 'testimonials', id);
          data.testimonials.splice(Number(btn.dataset.localIndex), 1);
          await syncClientsFromApi(false);
        } catch (e) {
          data.testimonials.splice(Number(btn.dataset.localIndex), 1);
          refresh();
          alert('Deleted locally. API delete did not complete: ' + e.message);
        }
      };
    });
  }

  $('#vehicleForm').onsubmit = async e => {
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

  $('#importData').onchange = async e => {
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

  $('#exportAll').onclick = () => {
    let blob = new Blob([JSON.stringify({ siteData: data, leads: leads() }, null, 2)], { type: 'application/json' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'maple-leaf-motors-export.json';
    a.click();
  };

  // Clients admin setup
  const tokenInput = $('#clientsApiToken');
  if (tokenInput) tokenInput.value = localStorage.getItem(CLIENTS_TOKEN_KEY) || '';

  const saveToken = $('#saveClientsToken');
  if (saveToken) {
    saveToken.onclick = () => {
      localStorage.setItem(CLIENTS_TOKEN_KEY, tokenInput.value.trim());
      alert('API token saved in this browser.');
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

      const localImages = await readFiles($('#adminDeliveryImages').files);
      const localEntry = {
        id: 'delivery-' + Date.now(),
        clientName: fd.get('clientName') || '',
        vehicle: fd.get('vehicle') || '',
        quote: fd.get('quote') || '',
        rating: Number(fd.get('rating') || 5),
        images: localImages.map(x => x.data),
        createdAt: new Date().toISOString()
      };

      const token = localStorage.getItem(CLIENTS_TOKEN_KEY) || '';
      try {
        const uploaded = await postClientToApi(config, token, fd);
        data.deliveries.unshift(uploaded.entry || localEntry);
        await syncClientsFromApi(false);
        alert('Delivery uploaded to the website API.');
      } catch (err) {
        data.deliveries.unshift(localEntry);
        saveData(data);
        refresh();
        alert('Saved locally only. To publish publicly, update the Worker and save the API token. Details: ' + err.message);
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

      const localEntry = {
        id: 'review-' + Date.now(),
        name: fd.get('name') || '',
        text: fd.get('text') || '',
        rating: Number(fd.get('rating') || 5),
        createdAt: new Date().toISOString()
      };

      const token = localStorage.getItem(CLIENTS_TOKEN_KEY) || '';
      try {
        const uploaded = await postClientToApi(config, token, fd);
        data.testimonials.unshift(uploaded.entry || localEntry);
        await syncClientsFromApi(false);
        alert('Review uploaded to the website API.');
      } catch (err) {
        data.testimonials.unshift(localEntry);
        saveData(data);
        refresh();
        alert('Saved locally only. To publish publicly, update the Worker and save the API token. Details: ' + err.message);
      }

      testimonialForm.reset();
      refresh();
    };
  }

  refresh();
  syncClientsFromApi(false);
}

document.addEventListener('DOMContentLoaded', () => {
  protect();
  login();
  tabs();
  dashboard();
});
