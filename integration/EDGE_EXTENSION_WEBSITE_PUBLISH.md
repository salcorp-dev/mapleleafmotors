
# Edge Extension Integration Plan

Your existing Edge extension already posts to Facebook Marketplace and Facebook wall.

Do not replace that workflow.

Add one new button:

Post to Website Inventory

## Best integration

The extension already talks to:

http://localhost:7865

So the cleanest path is:

1. Listing Studio prepares vehicle data and processed photos.
2. Edge extension displays the current vehicle session.
3. New button calls the local server:
   GET http://localhost:7865/api/website-payload
4. Extension sends that payload to the website API:
   POST https://your-worker-domain.workers.dev/inventory

## Payload shape

{
  "vehicle": {
    "id": "2021-honda-civic-ex-61000",
    "year": 2021,
    "make": "Honda",
    "model": "Civic",
    "trim": "EX",
    "price": 24995,
    "mileage": 61000,
    "bodyStyle": "Sedan",
    "featured": true,
    "sold": false,
    "images": ["https://..."],
    "features": ["Heated Seats", "Backup Camera"],
    "description": "..."
  }
}

## Static limitation

Cloudflare Pages alone cannot permanently save new inventory.
You need one of:

- Cloudflare Worker + KV/D1/R2
- Supabase
- Firebase
- custom backend

This package includes:
workers/inventory-api-worker.js

## Popup.js button logic to add later

async function postToWebsiteInventory() {
  const payloadRes = await fetch(serverUrl + "/api/website-payload");
  const payload = await payloadRes.json();

  const res = await fetch("https://YOUR-WORKER.workers.dev/inventory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_API_TOKEN"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Website publish failed");
  alert("Posted to website inventory.");
}

