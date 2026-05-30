// Maple Leaf Motors Inventory + Client Media API for Cloudflare Workers
// Bindings required:
// 1) INVENTORY_KV: KV namespace
// 2) VEHICLE_IMAGES: R2 bucket
// 3) API_TOKEN: secret text variable
//
// Endpoints:
// GET    /inventory
// POST   /inventory       multipart/form-data with "vehicle" JSON and "images" files
// GET    /clients
// POST   /clients         multipart/form-data or JSON for delivery photos / testimonials
// DELETE /clients/<type>/<id>   type = deliveries or testimonials
// GET    /images/<key>

const INVENTORY_KEY = "inventory";
const CLIENTS_KEY = "clients_data";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/inventory" && request.method === "GET") {
        const raw = await env.INVENTORY_KV.get(INVENTORY_KEY);
        return json(raw ? JSON.parse(raw) : []);
      }

      if (url.pathname === "/inventory" && request.method === "POST") {
        await requireAuth(request, env);

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

      if (url.pathname === "/clients" && request.method === "GET") {
        const clients = await getClients(env);
        return json(clients);
      }

      if (url.pathname === "/clients" && request.method === "POST") {
        await requireAuth(request, env);

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

      if (url.pathname.startsWith("/clients/") && request.method === "DELETE") {
        await requireAuth(request, env);

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

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message || String(err) }, err.status || 500);
    }
  }
};

async function getClients(env) {
  const raw = await env.INVENTORY_KV.get(CLIENTS_KEY);
  const clients = raw ? JSON.parse(raw) : {};
  return {
    deliveries: Array.isArray(clients.deliveries) ? clients.deliveries : [],
    testimonials: Array.isArray(clients.testimonials) ? clients.testimonials : []
  };
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.API_TOKEN || auth !== `Bearer ${env.API_TOKEN}`) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}
