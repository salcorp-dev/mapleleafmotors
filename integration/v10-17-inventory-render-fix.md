# v10.17 Inventory Render Fix

Fixes public inventory not showing after v10.16.

Main fix:
- `assets/js/app.js` had `await siteData()` inside non-async render functions.
- That causes a public JavaScript syntax error, so inventory/cards never render.
- v10.17 restores:
  - `async function renderHome()`
  - `async function renderInventory()`
  - `async function renderVehicle()`

Other safeguards:
- Public inventory hides only `archiveHidden: true`.
- Public site accepts Worker inventory response as either an array or `{ inventory: [...] }`.
- Biweekly display remains saved-only from admin calculator.
