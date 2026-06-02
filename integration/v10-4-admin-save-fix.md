# v10.4 Admin Save Fix

Fixes issue where clicking Save Vehicle in the Live Inventory editor appears to do nothing.

Changes:
- Added a direct DOM binding patch for the live inventory manager.
- Save button now shows "Saving..." while updating.
- Success alert appears when saved.
- Errors show in an alert instead of silently failing.
- Refreshes live inventory after save.
- Added cache busting to admin.js: `admin.js?v=10.4`

No new Cloudflare secrets are required.

Deploy:
1. Upload website files to Cloudflare Pages/GitHub root.
2. Redeploy Worker only if your Worker does not already have `/admin/inventory` PATCH/DELETE endpoints.
