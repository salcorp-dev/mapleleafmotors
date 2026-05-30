
// Maple Leaf Motors Inventory API for Cloudflare Workers
// Bindings required:
// 1) INVENTORY_KV: KV namespace
// 2) VEHICLE_IMAGES: R2 bucket
// 3) API_TOKEN: secret text variable
//
// Endpoints:
// GET  /inventory
// POST /inventory       multipart/form-data with "vehicle" JSON and "images" files
// GET  /images/<key>

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/inventory" && request.method === "GET") {
        const raw = await env.INVENTORY_KV.get("inventory");
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

        const raw = await env.INVENTORY_KV.get("inventory");
        const inventory = raw ? JSON.parse(raw) : [];
        const existing = inventory.findIndex(v => v.id === vehicle.id);
        if (existing >= 0) inventory[existing] = { ...inventory[existing], ...vehicle };
        else inventory.unshift(vehicle);

        await env.INVENTORY_KV.put("inventory", JSON.stringify(inventory));
        return json({ ok: true, vehicle, count: inventory.length });
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}
