# v10 Live Admin Inventory Manager

This version replaces the old local admin inventory view with a live Cloudflare inventory manager.

## What changed

Admin dashboard now has **Live Inventory Manager**.

It pulls from the same live inventory used by the public site:

```text
GET /admin/inventory
```

It can:

- Refresh live inventory
- Search/filter vehicles
- Edit vehicle details
- Toggle featured
- Mark sold / available
- Delete vehicle from public inventory

## Worker endpoints added

```text
GET /admin/inventory
PATCH /admin/inventory/<id>
DELETE /admin/inventory/<id>
```

These require the admin session token from the true `/admin/` login.

## Setup

Update the Cloudflare Worker with:

```text
workers/inventory-api-worker.js
```

No new Cloudflare secrets or bindings are required if v9 was already set up.

Keep:

```text
INVENTORY_KV
VEHICLE_IMAGES
API_TOKEN
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Upload website files to GitHub/Cloudflare Pages after replacing the Worker code.
