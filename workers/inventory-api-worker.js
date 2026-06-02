// Maple Leaf Motors Inventory + Clients + Real Admin Auth API for Cloudflare Workers
//
// Required bindings:
// - INVENTORY_KV: KV namespace
// - VEHICLE_IMAGES: R2 bucket
// - API_TOKEN: secret text variable for Listing Studio / inventory uploads
// - ADMIN_PASSWORD: secret text variable for initial admin login
// - ADMIN_SESSION_SECRET: secret text variable used to sign admin sessions
// Optional email notification secrets:
// - RESEND_API_KEY: Resend API key
// - LEAD_NOTIFY_EMAIL: email address that receives new lead alerts
// - LEAD_FROM_EMAIL: verified sender, e.g. Maple Leaf Motors <leads@yourdomain.com>
//
// Public:
// GET /inventory
// GET /clients
// GET /images/<key>
//
// Listing Studio:
// POST /inventory              Authorization: Bearer <API_TOKEN>
//
// Admin auth:
// POST /admin/login            { password }
// GET  /admin/session          Authorization: Bearer <session>
// POST /admin/change-password  Authorization: Bearer <session>
//
// Admin clients:
// POST   /clients              Authorization: Bearer <admin-session>
// DELETE /clients/deliveries/<id> or /clients/testimonials/<id>
//                              Authorization: Bearer <admin-session>

const INVENTORY_KEY = "inventory";
const CLIENTS_KEY = "clients_data";
const LEADS_KEY = "finance_leads_v1";
const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash_v1";
const ADMIN_PASSWORD_SALT_KEY = "admin_password_salt_v1";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      // ─────────────────────────────────────────────
      // Public endpoints
      // ─────────────────────────────────────────────
      if (url.pathname === "/inventory" && request.method === "GET") {
        const inventory = await getInventory(env);
        const publicInventory = inventory.filter(v => v.archiveHidden !== true);
        return json(publicInventory);
      }

      if (url.pathname === "/clients" && request.method === "GET") {
        const clients = await getClients(env);
        const auth = request.headers.get("Authorization") || "";
        let isAdmin = false;
        if (auth) {
          try { await requireAdminSession(request, env); isAdmin = true; } catch (e) { isAdmin = false; }
        }
        if (isAdmin) return json(clients);

        return json({
          deliveries: clients.deliveries.filter(x => x.archiveHidden !== true),
          testimonials: clients.testimonials.filter(x => x.archiveHidden !== true)
        });
      }



      if (url.pathname === "/leads" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const input = body.lead || body;
        const lead = cleanLead(input, request);
        const leads = await getLeads(env);
        leads.unshift(lead);
        await env.INVENTORY_KV.put(LEADS_KEY, JSON.stringify(leads));
        return json({ ok: true, leadId: lead.id });
      }

      if (url.pathname.startsWith("/images/") && request.method === "GET") {
        const key = decodeURIComponent(url.pathname.replace("/images/", ""));
        const obj = await env.VEHICLE_IMAGES.get(key);
        if (!obj) return json({ error: "Image not found" }, 404);
        return new Response(obj.body, {
          headers: {
            "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
            ...corsHeaders()
          }
        });
      }

      // ─────────────────────────────────────────────
      // Real backend admin auth
      // ─────────────────────────────────────────────
      if (url.pathname === "/admin/login" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const password = String(body.password || "");
        const ok = await checkAdminPassword(env, password);
        if (!ok) return json({ ok: false, error: "Invalid password" }, 401);

        const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
        const token = await signSession(env, { role: "admin", exp: expiresAt });

        return json({
          ok: true,
          token,
          expiresAt,
          expiresInSeconds: SESSION_TTL_SECONDS
        });
      }

      if (url.pathname === "/admin/session" && request.method === "GET") {
        await requireAdminSession(request, env);
        return json({ ok: true, role: "admin" });
      }

      if (url.pathname === "/admin/change-password" && request.method === "POST") {
        await requireAdminSession(request, env);

        const body = await request.json().catch(() => ({}));
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");

        if (!(await checkAdminPassword(env, currentPassword))) {
          return json({ ok: false, error: "Current password is incorrect" }, 401);
        }

        if (newPassword.length < 12) {
          return json({ ok: false, error: "New password must be at least 12 characters" }, 400);
        }

        await saveAdminPassword(env, newPassword);
        return json({ ok: true });
      }



      if (url.pathname === "/admin/leads" && request.method === "GET") {
        await requireAdminSession(request, env);
        return json({ ok: true, leads: await getLeads(env) });
      }

      if (url.pathname.startsWith("/admin/leads/") && request.method === "PATCH") {
        await requireAdminSession(request, env);
        const id = decodeURIComponent(url.pathname.replace("/admin/leads/", ""));
        const body = await request.json().catch(() => ({}));
        const leads = await getLeads(env);
        const index = leads.findIndex(x => x.id === id);
        if (index < 0) return json({ error: "Lead not found" }, 404);
        if (Object.prototype.hasOwnProperty.call(body, "status")) leads[index].status = body.status;
        if (Object.prototype.hasOwnProperty.call(body, "notes")) leads[index].notes = body.notes;
        if (Object.prototype.hasOwnProperty.call(body, "assignedTo")) leads[index].assignedTo = body.assignedTo;
        if (Object.prototype.hasOwnProperty.call(body, "attachedVehicleId")) leads[index].attachedVehicleId = body.attachedVehicleId;
        if (Object.prototype.hasOwnProperty.call(body, "attachedVehicleTitle")) leads[index].attachedVehicleTitle = body.attachedVehicleTitle;
        if (Object.prototype.hasOwnProperty.call(body, "attachedVehiclePrice")) leads[index].attachedVehiclePrice = Number(body.attachedVehiclePrice || 0);
        if (Object.prototype.hasOwnProperty.call(body, "attachedVehicleStock")) leads[index].attachedVehicleStock = body.attachedVehicleStock;
        leads[index].updatedAt = new Date().toISOString();
        await env.INVENTORY_KV.put(LEADS_KEY, JSON.stringify(leads));
        return json({ ok: true, lead: leads[index] });
      }

      if (url.pathname.startsWith("/admin/leads/") && request.method === "DELETE") {
        await requireAdminSession(request, env);
        const id = decodeURIComponent(url.pathname.replace("/admin/leads/", ""));
        const leads = await getLeads(env);
        const next = leads.filter(x => x.id !== id);
        await env.INVENTORY_KV.put(LEADS_KEY, JSON.stringify(next));
        return json({ ok: true, deleted: leads.length - next.length, leads: next });
      }

      // ─────────────────────────────────────────────
      // Inventory write endpoint, kept for Listing Studio
      // ─────────────────────────────────────────────

      // Admin live inventory management
      if (url.pathname === "/admin/inventory" && request.method === "GET") {
        await requireAdminSession(request, env);
        return json({ ok: true, inventory: await getInventory(env) });
      }

      if (url.pathname.startsWith("/admin/inventory/") && request.method === "PATCH") {
        await requireAdminSession(request, env);

        const id = decodeURIComponent(url.pathname.replace("/admin/inventory/", ""));
        const body = await request.json().catch(() => ({}));
        const inventory = await getInventory(env);
        const index = inventory.findIndex(v => String(v.id) === String(id));

        if (index < 0) return json({ error: "Vehicle not found" }, 404);

        const allowed = [
          "title", "year", "make", "model", "trim", "price", "mileage", "kilometers",
          "bodyStyle", "transmission", "fuel", "drivetrain", "vin", "stockNumber",
          "exteriorColor", "interiorColor", "description", "features", "featured",
          "sold", "archived", "archiveHidden", "status",
          "monthlyPayment", "biweeklyPayment", "weeklyPayment", "financeTermMonths", "financeRate", "taxRate", "downPayment", "paymentNote"
        ];

        const updates = {};
        for (const k of allowed) {
          if (Object.prototype.hasOwnProperty.call(body, k)) updates[k] = body[k];
        }

        if (Object.prototype.hasOwnProperty.call(updates, "price")) updates.price = Number(updates.price || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "mileage")) updates.mileage = Number(updates.mileage || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "kilometers")) updates.kilometers = Number(updates.kilometers || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "year")) updates.year = Number(updates.year || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "monthlyPayment")) updates.monthlyPayment = Number(updates.monthlyPayment || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "biweeklyPayment")) updates.biweeklyPayment = Number(updates.biweeklyPayment || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "weeklyPayment")) updates.weeklyPayment = Number(updates.weeklyPayment || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "financeTermMonths")) updates.financeTermMonths = Number(updates.financeTermMonths || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "financeRate")) updates.financeRate = Number(updates.financeRate || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "taxRate")) updates.taxRate = Number(updates.taxRate || 0);
        if (Object.prototype.hasOwnProperty.call(updates, "downPayment")) updates.downPayment = Number(updates.downPayment || 0);
        if (typeof updates.features === "string") {
          updates.features = updates.features.split(",").map(x => x.trim()).filter(Boolean);
        }

        updates.updatedAt = new Date().toISOString();
        inventory[index] = { ...inventory[index], ...updates };

        await env.INVENTORY_KV.put(INVENTORY_KEY, JSON.stringify(inventory));
        return json({ ok: true, vehicle: inventory[index], inventory });
      }

      if (url.pathname.startsWith("/admin/inventory/") && request.method === "DELETE") {
        await requireAdminSession(request, env);

        const id = decodeURIComponent(url.pathname.replace("/admin/inventory/", ""));
        const inventory = await getInventory(env);
        const next = inventory.filter(v => String(v.id) !== String(id));

        if (next.length === inventory.length) return json({ error: "Vehicle not found" }, 404);

        await env.INVENTORY_KV.put(INVENTORY_KEY, JSON.stringify(next));
        return json({ ok: true, deleted: 1, inventory: next });
      }

      if (url.pathname === "/inventory" && request.method === "POST") {
        await requireInventoryToken(request, env);

        const contentType = request.headers.get("Content-Type") || "";
        let vehicle;
        let files = [];

        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          vehicle = JSON.parse(form.get("vehicle") || "{}");
          files = form.getAll("images").filter(Boolean);
        } else {
          const body = await request.json();
          vehicle = body.vehicle || body;
        }

        if (!vehicle.id) vehicle.id = makeSlug(`${vehicle.year || ""}-${vehicle.make || ""}-${vehicle.model || ""}-${Date.now()}`);
        vehicle.images = Array.isArray(vehicle.images) ? vehicle.images : [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const safeName = makeSlug(file.name || `photo-${i + 1}.jpg`);
          const ext = extensionFromType(file.type) || ".jpg";
          const key = `vehicles/${vehicle.id}/${Date.now()}-${i}-${safeName}${safeName.endsWith(ext) ? "" : ext}`;
          await env.VEHICLE_IMAGES.put(key, file.stream(), {
            httpMetadata: { contentType: file.type || "image/jpeg" }
          });
          vehicle.images.push(`${url.origin}/images/${key}`);
        }

        vehicle.updatedAt = new Date().toISOString();

        const raw = await env.INVENTORY_KV.get(INVENTORY_KEY);
        const inventory = raw ? JSON.parse(raw) : [];
        const existing = inventory.findIndex(v => v.id === vehicle.id);
        if (existing >= 0) inventory[existing] = { ...inventory[existing], ...vehicle };
        else inventory.unshift(vehicle);

        await env.INVENTORY_KV.put(INVENTORY_KEY, JSON.stringify(inventory));
        return json({ ok: true, vehicle, count: inventory.length });
      }

      // ─────────────────────────────────────────────
      // Admin client uploads
      // ─────────────────────────────────────────────
      if (url.pathname === "/clients" && request.method === "POST") {
        await requireAdminSession(request, env);

        const contentType = request.headers.get("Content-Type") || "";
        let entry = {};
        let files = [];

        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          const type = String(form.get("type") || "").trim();
          entry = {
            type,
            id: String(form.get("id") || "").trim(),
            clientName: String(form.get("clientName") || "").trim(),
            vehicle: String(form.get("vehicle") || "").trim(),
            quote: String(form.get("quote") || "").trim(),
            name: String(form.get("name") || "").trim(),
            text: String(form.get("text") || "").trim(),
            rating: Number(form.get("rating") || 5),
            createdAt: String(form.get("createdAt") || new Date().toISOString())
          };
          files = form.getAll("images").filter(Boolean);
        } else {
          const body = await request.json();
          entry = body.entry || body;
        }

        const clients = await getClients(env);
        const type = String(entry.type || "").toLowerCase();

        if (type === "delivery" || type === "deliveries") {
          if (!files.length && (!Array.isArray(entry.images) || !entry.images.length)) return json({ error: "Please upload at least one delivery image." }, 400);
          entry.id = entry.id || `delivery-${Date.now()}`;
          entry.images = Array.isArray(entry.images) ? entry.images : [];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const safeName = makeSlug(file.name || `delivery-${i + 1}.jpg`);
            const ext = extensionFromType(file.type) || ".jpg";
            const key = `clients/deliveries/${entry.id}/${Date.now()}-${i}-${safeName}${safeName.endsWith(ext) ? "" : ext}`;
            await env.VEHICLE_IMAGES.put(key, file.stream(), {
              httpMetadata: { contentType: file.type || "image/jpeg" }
            });
            entry.images.push(`${url.origin}/images/${key}`);
          }

          const clean = {
            id: entry.id,
            clientName: entry.clientName || "",
            vehicle: entry.vehicle || "",
            quote: entry.quote || "",
            rating: Number(entry.rating || 5),
            images: entry.images || [],
            createdAt: entry.createdAt || new Date().toISOString(),
            archiveHidden: entry.archiveHidden === true,
            updatedAt: new Date().toISOString()
          };

          const existing = clients.deliveries.findIndex(x => x.id === clean.id);
          if (existing >= 0) clients.deliveries[existing] = { ...clients.deliveries[existing], ...clean };
          else clients.deliveries.unshift(clean);

          await env.INVENTORY_KV.put(CLIENTS_KEY, JSON.stringify(clients));
          return json({ ok: true, type: "delivery", entry: clean, clients });
        }

        if (type === "testimonial" || type === "testimonials" || type === "review") {
          entry.id = entry.id || `review-${Date.now()}`;
          const clean = {
            id: entry.id,
            name: entry.name || entry.clientName || "Anonymous",
            text: entry.text || entry.quote || "",
            rating: Number(entry.rating || 5),
            createdAt: entry.createdAt || new Date().toISOString(),
            archiveHidden: entry.archiveHidden === true,
            updatedAt: new Date().toISOString()
          };

          const existing = clients.testimonials.findIndex(x => x.id === clean.id);
          if (existing >= 0) clients.testimonials[existing] = { ...clients.testimonials[existing], ...clean };
          else clients.testimonials.unshift(clean);

          await env.INVENTORY_KV.put(CLIENTS_KEY, JSON.stringify(clients));
          return json({ ok: true, type: "testimonial", entry: clean, clients });
        }

        return json({ error: "Unknown client entry type. Use delivery or testimonial." }, 400);
      }


      if (url.pathname.startsWith("/clients/") && request.method === "PATCH") {
        await requireAdminSession(request, env);

        const parts = url.pathname.split("/").filter(Boolean);
        const type = parts[1];
        const id = decodeURIComponent(parts[2] || "");
        if (!["deliveries", "testimonials"].includes(type) || !id) {
          return json({ error: "Use PATCH /clients/deliveries/<id> or /clients/testimonials/<id>" }, 400);
        }

        const body = await request.json().catch(() => ({}));
        const updates = body.entry || body || {};
        const clients = await getClients(env);
        const index = clients[type].findIndex(x => x.id === id);
        if (index < 0) return json({ error: "Client entry not found" }, 404);

        const allowed = ["clientName", "vehicle", "quote", "name", "text", "rating", "archiveHidden", "archived", "status"];
        const clean = {};
        for (const k of allowed) {
          if (Object.prototype.hasOwnProperty.call(updates, k)) clean[k] = updates[k];
        }
        if (Object.prototype.hasOwnProperty.call(clean, "rating")) clean.rating = Number(clean.rating || 5);

        clients[type][index] = {
          ...clients[type][index],
          ...clean,
          updatedAt: new Date().toISOString()
        };

        await env.INVENTORY_KV.put(CLIENTS_KEY, JSON.stringify(clients));
        return json({ ok: true, message: "client entry updated", type, entry: clients[type][index], clients });
      }

      if (url.pathname.startsWith("/clients/") && request.method === "DELETE") {
        await requireAdminSession(request, env);

        const parts = url.pathname.split("/").filter(Boolean);
        const type = parts[1];
        const id = decodeURIComponent(parts[2] || "");
        if (!["deliveries", "testimonials"].includes(type) || !id) {
          return json({ error: "Use DELETE /clients/deliveries/<id> or /clients/testimonials/<id>" }, 400);
        }

        const clients = await getClients(env);
        const before = clients[type].length;
        clients[type] = clients[type].filter(x => x.id !== id);
        await env.INVENTORY_KV.put(CLIENTS_KEY, JSON.stringify(clients));

        return json({ ok: true, deleted: before - clients[type].length, clients });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message || String(err) }, err.status || 500);
    }
  }
};

// ─────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────


// v10.2 required data helpers
async function getInventory(env) {
  const raw = await env.INVENTORY_KV.get(INVENTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveInventory(env, inventory) {
  await env.INVENTORY_KV.put(INVENTORY_KEY, JSON.stringify(Array.isArray(inventory) ? inventory : []));
}

async function getClients(env) {
  const raw = await env.INVENTORY_KV.get(CLIENTS_KEY);
  const clients = raw ? JSON.parse(raw) : {};
  return {
    deliveries: Array.isArray(clients.deliveries) ? clients.deliveries : [],
    testimonials: Array.isArray(clients.testimonials) ? clients.testimonials : []
  };
}



async function getLeads(env) {
  const raw = await env.INVENTORY_KV.get(LEADS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function cleanLead(input, request) {
  const now = new Date().toISOString();
  const id = `lead-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const text = (v, max = 500) => String(v || "").trim().slice(0, max);
  const lead = {
    id, status: "NEW LEAD",
    firstName: text(input.firstName, 80), lastName: text(input.lastName, 80),
    phone: text(input.phone, 40), email: text(input.email, 120),
    city: text(input.city, 80), province: text(input.province, 80),
    vehicleType: text(input.vehicleType, 80), creditSituation: text(input.creditSituation, 120),
    incomeType: text(input.incomeType, 100), budget: text(input.budget, 80),
    bestTime: text(input.bestTime, 80), contactPreference: text(input.contactPreference, 80),
    notes: text(input.notes, 1000), consent: !!input.consent,
    source: text(input.source || "website", 100), campaign: text(input.campaign, 160),
    adset: text(input.adset, 160), placement: text(input.placement, 120), fbclid: text(input.fbclid, 250),
    pageUrl: text(input.pageUrl, 500), ipHint: request.headers.get("CF-Connecting-IP") || "",
    userAgent: text(request.headers.get("User-Agent"), 250),
    createdAt: now, updatedAt: now, assignedTo: ""
  };
  if (!lead.firstName || !lead.phone || !lead.email || !lead.consent) {
    const err = new Error("Missing required lead fields");
    err.status = 400;
    throw err;
  }
  return lead;
}

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

async function requireInventoryToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.API_TOKEN || auth !== `Bearer ${env.API_TOKEN}`) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

async function requireAdminSession(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = await verifySession(env, token);

  if (!payload || payload.role !== "admin") {
    const err = new Error("Admin login required");
    err.status = 401;
    throw err;
  }

  return payload;
}

async function checkAdminPassword(env, password) {
  if (!password) return false;

  const savedHash = await env.INVENTORY_KV.get(ADMIN_PASSWORD_HASH_KEY);
  const savedSalt = await env.INVENTORY_KV.get(ADMIN_PASSWORD_SALT_KEY);

  if (savedHash && savedSalt) {
    const testHash = await sha256(`${savedSalt}:${password}`);
    return timingSafeEqual(testHash, savedHash);
  }

  return !!env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD;
}

async function saveAdminPassword(env, password) {
  const salt = crypto.randomUUID();
  const hash = await sha256(`${salt}:${password}`);
  await env.INVENTORY_KV.put(ADMIN_PASSWORD_SALT_KEY, salt);
  await env.INVENTORY_KV.put(ADMIN_PASSWORD_HASH_KEY, hash);
}

async function signSession(env, payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = await hmac(env.ADMIN_SESSION_SECRET || env.API_TOKEN || env.ADMIN_PASSWORD, body);
  return `${body}.${sig}`;
}

async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;

  const [body, sig] = token.split(".");
  const expected = await hmac(env.ADMIN_SESSION_SECRET || env.API_TOKEN || env.ADMIN_PASSWORD, body);
  if (!timingSafeEqual(sig, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(atobUrl(body));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hmac(secret, value) {
  if (!secret) secret = "fallback-change-this-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bufferToBase64Url(sig);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bufferToHex(digest);
}

function timingSafeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extensionFromType(type) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return ".jpg";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

function base64url(value) {
  const raw = typeof value === "string" ? value : String(value);
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function atobUrl(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return decodeURIComponent(escape(atob(value)));
}

function bufferToBase64Url(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
