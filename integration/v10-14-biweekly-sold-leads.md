# v10.14 Saved Biweekly, Sold Archive, Lead Attachment

Changes:
1. Public biweekly display no longer uses any default/fallback calculation.
   - It only shows a payment if `biweeklyPayment` exists from the admin calculator.
   - If no admin calculator value is saved, no biweekly estimate is shown.

2. Sold/archive vehicles disappear from the public website.
   - Public `/inventory` filters out `sold`, `archived`, `status: sold`, and `status: archived`.
   - Admin `/admin/inventory` still shows all vehicles.

3. Finance Leads can be attached to inventory.
   - Finance lead rows now include an Attached Vehicle dropdown.
   - Saving a lead stores attachedVehicleId, attachedVehicleTitle, attachedVehiclePrice, and attachedVehicleStock.

Deploy:
1. Upload website files.
2. Redeploy Worker from `workers/inventory-api-worker.js`.
3. Hard refresh `/admin/dashboard.html?fresh=1014`.
