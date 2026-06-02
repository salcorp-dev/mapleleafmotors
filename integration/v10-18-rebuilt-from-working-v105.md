# v10.18 Rebuilt from last working v10.5

Base:
- Started from `maple-leaf-motors-v10-5-direct-save-fix`.

Added carefully:
1. Payment calculator in Live Inventory editor
   - Auto updates without a Calculate button.
   - 12% Manitoba tax.
   - Standard amortization.
   - APR options: 2.9, 4.9, 5.9, 6.9, 7, 8.9, 9.9, 10.9, 12.9, 14.9.
   - Term options: 36, 48, 60, 72, 84, 96.
   - Saves monthlyPayment and biweeklyPayment.

2. Public biweekly display
   - No default/fallback payment calculation.
   - Public pages only show a biweekly payment if `biweeklyPayment` was saved from admin.
   - OAC removed.

3. Archive / sold behavior
   - Public Worker `/inventory` only hides `archiveHidden: true`.
   - Existing vehicles are not hidden by old `sold`, `status`, or `archived` fields.
   - Admin Archive / Mark Sold sets `archiveHidden: true`.

4. Attach finance leads to inventory
   - Finance Leads rows now include an Attached Vehicle dropdown.
   - Worker saves attachedVehicleId, attachedVehicleTitle, attachedVehiclePrice, attachedVehicleStock.

Deploy:
1. Upload website files.
2. Redeploy `workers/inventory-api-worker.js`.
3. Open `/admin/dashboard.html?fresh=1018` and hard refresh.
