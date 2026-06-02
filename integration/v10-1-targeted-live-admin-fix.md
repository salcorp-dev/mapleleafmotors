# v10.1 Targeted Live Admin Inventory Fix

This build directly replaces the dashboard's old Add Vehicle / Current Inventory section with a live inventory manager.

Admin page should now show:

```text
Live Inventory Manager
Refresh Live Inventory
View Public Inventory
```

Worker endpoints required:

```text
GET /admin/inventory
PATCH /admin/inventory/<id>
DELETE /admin/inventory/<id>
```

Deploy `workers/inventory-api-worker.js` and upload the website files to Cloudflare Pages/GitHub root.
