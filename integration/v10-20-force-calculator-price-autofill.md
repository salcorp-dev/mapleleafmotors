# v10.20 Force Calculator Price Autofill

Fix:
- Adds a fallback script that force-fills the Payment Calculator's Vehicle Price field whenever the edit modal opens.
- Works even if the modal is opened by the older admin.js handler instead of the direct inventory handler.
- Uses the main vehicle price field first, then falls back to the loaded live inventory array.
- Triggers payment recalculation immediately after autofilling.
