
// Cloudflare Worker starter for future website inventory publishing.
// Bind a KV namespace as INVENTORY_KV and set a secret env var API_TOKEN.
// POST /inventory with Authorization: Bearer <API_TOKEN>
// Body: { vehicle: { id, year, make, model, price, mileage, images, features, description } }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    if (url.pathname === "/inventory" && request.method === "GET") {
      const raw = await env.INVENTORY_KV.get("inventory");
      return json(raw ? JSON.parse(raw) : []);
    }

    if (url.pathname === "/inventory" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      if (auth !== `Bearer ${env.API_TOKEN}`) return json({ error: "Unauthorized" }, 401);

      const body = await request.json();
      const vehicle = body.vehicle || body;
      if (!vehicle.id) vehicle.id = "veh-" + Date.now();

      const raw = await env.INVENTORY_KV.get("inventory");
      const inventory = raw ? JSON.parse(raw) : [];
      const existing = inventory.findIndex(v => v.id === vehicle.id);
      if (existing >= 0) inventory[existing] = vehicle;
      else inventory.unshift(vehicle);

      await env.INVENTORY_KV.put("inventory", JSON.stringify(inventory));
      return json({ ok: true, vehicle, count: inventory.length });
    }

    return json({ error: "Not found" }, 404);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...cors() }
  });
}
