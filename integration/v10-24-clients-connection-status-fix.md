# v10.24 Clients Connection Status Fix

Fix:
- The Clients tab no longer stays stuck on "offline/local mode" after upload.
- The direct Clients table renderer now controls the status chip.
- It shows:
  - Website API connected · X deliveries · Y reviews
  - or the exact API error.
- It first tries admin-authenticated GET /clients, then falls back to public GET /clients.
- Refresh From API triggers the direct renderer.
- CORS explicitly allows Authorization.

Deploy:
1. Upload website files.
2. Redeploy Worker from workers/inventory-api-worker.js.
3. Open /admin/dashboard.html?fresh=1024 and hard refresh.
