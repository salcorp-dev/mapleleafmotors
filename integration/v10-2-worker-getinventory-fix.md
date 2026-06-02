# v10.2 Worker getInventory Fix

This fixes the admin error:

```text
Could not load live inventory: getInventory is not defined
```

Cause:
The deployed Worker has the new `/admin/inventory` endpoint, but the helper function `getInventory(env)` was missing.

Fix:
Redeploy:

```text
workers/inventory-api-worker.js
```

No new Cloudflare variables/secrets are required.
