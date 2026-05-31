const ADMIN_SESSION_KEY = 'mlm_admin_session';
const STATUSES = ['NEW LEAD','CONTACTED','APPLICATION SENT','DEALERTRACK SUBMITTED','APPROVED','VEHICLE SELECTED','DELIVERED','LOST'];

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
    if (!$('#vehicleRows')) return;
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
        const id = btn.dataset.deliveryDelete;
        try {
          if (id && !/^\d+$/.test(id)) await deleteClientFromApi(config, 'deliveries', id);
          data.deliveries.splice(Number(btn.dataset.localIndex), 1);
          await syncClientsFromApi(false);
        } catch (e) {
          alert('Delete failed: ' + e.message);
        }
      };
    });

    $$('[data-testimonial-delete]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this review?')) return;
        const id = btn.dataset.testimonialDelete;
        try {
          if (id && !/^\d+$/.test(id)) await deleteClientFromApi(config, 'testimonials', id);
          data.testimonials.splice(Number(btn.dataset.localIndex), 1);
          await syncClientsFromApi(false);
        } catch (e) {
          alert('Delete failed: ' + e.message);
        }
      };
    });
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

  refresh();
  syncClientsFromApi(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  await protect();
  await login();
  tabs();
  dashboard();
});
