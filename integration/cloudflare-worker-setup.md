# Cloudflare Worker Setup for Website Inventory

This v6 website can read live inventory from a Cloudflare Worker.

## 1. Deploy the Worker

Use:

`workers/inventory-api-worker.js`

Required bindings:

- KV namespace: `INVENTORY_KV`
- R2 bucket: `VEHICLE_IMAGES`
- Secret: `API_TOKEN`

## 2. Test Worker

Open:

`https://YOUR-WORKER.workers.dev/inventory`

You should see:

`[]`

or an inventory JSON array.

## 3. Connect website to Worker

Edit:

`assets/data/config.json`

Set:

```json
{
  "inventoryApiUrl": "https://YOUR-WORKER.workers.dev/inventory"
}
```

Commit to GitHub.

Cloudflare Pages will redeploy.

## 4. Connect Edge Extension

In the Edge extension settings:

Website API URL:
`https://YOUR-WORKER.workers.dev/inventory`

Website API Token:
The same `API_TOKEN` from the Worker secret.

Then click:

`Post to Website Inventory`
