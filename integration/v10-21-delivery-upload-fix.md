# v10.21 Delivery Upload Fix

Problem:
Submitting Add Delivery Photo could fall back to normal form submit / reload and send the admin back to the main page.

Fix:
- Adds a dedicated delivery/review upload handler directly in dashboard.html.
- Uses capture-phase submit handling with preventDefault + stopImmediatePropagation.
- Uploads directly to the Worker `/clients` endpoint with the admin session token.
- Shows upload status under the form.
- Keeps the user on the Clients section after upload.
- Keeps image preview working.
- Worker now returns a clear error if a delivery upload has no image.

Deploy:
1. Upload website files.
2. Redeploy Worker only if you want the clearer missing-image error.
3. Open `/admin/dashboard.html?fresh=1021`.
4. Hard refresh.
