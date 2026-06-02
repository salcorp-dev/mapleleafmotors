# v10.15 Restore Inventory / Archive Fix

Problem:
After v10.14, existing vehicles disappeared from public inventory because the public API filtered out anything with `sold` or `status: sold`. Some older imports may use those fields unexpectedly.

Fix:
- Public website now hides only vehicles explicitly archived by admin:
  - `archived: true`
  - or `status: archived`
- Existing vehicles reappear.
- Admin Archive / Mark Sold sets:
  - `archived: true`
  - `sold: true`
  - `status: archived`
- Restoring sets:
  - `archived: false`
  - `sold: false`
  - `status: available`

Deploy:
1. Upload website files.
2. Redeploy Worker from `workers/inventory-api-worker.js`.
3. Open public inventory with `?fresh=1015`.
