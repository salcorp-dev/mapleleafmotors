# Maple Leaf Motors v9 — Finance Funnel + True Admin Setup

Adds `/get-approved.html`, public `POST /leads`, admin Finance Leads CRM, CSV export, Our Clients uploads, and real Worker-based admin login/password changes.

## Cloudflare Worker secrets

Keep/add these Worker secrets:

```text
API_TOKEN = MapleLeafWebsite2026SecureToken
ADMIN_PASSWORD = your first strong admin password
ADMIN_SESSION_SECRET = a long random secret string
```

`API_TOKEN` remains for Listing Studio inventory uploads. `ADMIN_PASSWORD` is the first admin password for `/admin/`. After you change it from dashboard Settings, the new password is stored in Cloudflare KV and works across browsers/devices.

## Required bindings

Keep these binding names exactly:

```text
INVENTORY_KV
VEHICLE_IMAGES
```

## Deploy

1. Upload website files to GitHub/Cloudflare Pages.
2. Replace Worker code with `workers/inventory-api-worker.js`.
3. Save/deploy Worker.
4. Test `/inventory`, `/clients`, `/get-approved.html`, and `/admin/`.

## Funnel link with tracking

```text
https://mapleleafmotors.pages.dev/get-approved.html?source=facebook&campaign=bad-credit-suv&placement=feed
```
