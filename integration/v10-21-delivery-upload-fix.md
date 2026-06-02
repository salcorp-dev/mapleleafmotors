# v10.21 Delivery Upload Fix

Fixes delivery photo upload returning to the admin main page.

Changes:
- Adds a dedicated delivery/review upload handler in dashboard.html.
- Prevents default form reload.
- Uploads directly to Worker /clients using the admin session.
- Shows upload status under the form.
- Keeps the Clients tab open after upload.
- Keeps preview working.
