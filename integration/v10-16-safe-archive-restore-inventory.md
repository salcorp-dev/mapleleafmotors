# v10.16 Safe Archive Flag / Restore Inventory

This fixes the disappearing inventory issue.

Cause:
Older vehicles may have legacy `sold`, `status`, or `archived` fields, so filtering by those fields can hide everything.

Fix:
- Public inventory now hides only vehicles with the new field:
  `archiveHidden: true`
- Existing vehicles with older sold/status/archived fields show again.
- Future admin Archive / Mark Sold sets:
  - archiveHidden: true
  - archived: true
  - sold: true
  - status: archived
- Restoring clears archiveHidden by setting it false.

Deploy:
1. Upload website files.
2. Redeploy Worker from `workers/inventory-api-worker.js`.
3. Open:
   `/inventory.html?fresh=1016`
4. Hard refresh.
