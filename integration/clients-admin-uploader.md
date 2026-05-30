# Our Clients Admin Uploader

This version adds an admin uploader for the `Our Clients` page.

## Files changed

- `admin/dashboard.html`
- `assets/js/admin.js`
- `assets/data/config.json`
- `clients.html`
- `workers/inventory-api-worker.js`

## How it works

The admin dashboard now has an **Our Clients** tab.

You can upload:

- Delivery photos
- Client names
- Vehicle names
- Optional customer quotes
- Customer reviews/testimonials
- Star ratings

The public `clients.html` page now tries to load client uploads from:

```text
https://maple-leaf-inventory.sal96wpg.workers.dev/clients
```

If the Worker is not updated yet, it falls back to local/static data.

## Cloudflare Worker update required

To make uploads public for all visitors, update your Worker code with:

```text
workers/inventory-api-worker.js
```

The same existing bindings are used:

```text
INVENTORY_KV
VEHICLE_IMAGES
API_TOKEN
```

No new KV or R2 binding is required.

## Admin API token

In the admin dashboard, open:

```text
admin/dashboard.html
```

Go to:

```text
Our Clients
```

Paste your existing Worker API token and click **Save Token**.

Your current token from earlier setup was:

```text
MapleLeafWebsite2026SecureToken
```

It is saved in your browser localStorage only, not inside the public config file.

## Important note

This is still a static admin page. Anyone with the admin password and API token can upload. For a future production system, use a protected backend/admin login instead of putting admin logic in browser JavaScript.
