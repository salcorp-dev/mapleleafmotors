# v12.5 Direct Delivery Render Fix

Fixes homepage customer delivery section not showing after a photo was uploaded.

Change:
- Adds an independent direct homepage renderer in index.html.
- It fetches /clients directly from the configured clientsApiUrl.
- It renders the big two-column delivery showcase even if app.js renderHome fails or old code does not populate the section.
- Uses quote/client/vehicle/images from admin delivery uploads.
- Adds no-cache query strings so browser caching does not hide new uploads.

Worker redeploy:
- Not required if /clients already works and returns deliveries.
- Only upload website files.
