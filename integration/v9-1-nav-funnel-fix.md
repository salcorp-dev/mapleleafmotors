# v9.1 Nav + Funnel Fix

Changes:
- Removed duplicate approval links from the main nav.
- The old Financing nav item now says `Financing`.
- The single active approval funnel link is `Get Approved` → `/get-approved.html`.
- Rebuilt `/get-approved.html` using the same site nav/header structure as the rest of the site.
- Refined the funnel layout so it looks cleaner and less disconnected.
- Kept the Worker/admin/lead funnel backend code intact.
- Ensured `assets/data/config.json` includes `leadsApiUrl`.

Upload these files to GitHub/Cloudflare Pages. Worker code only needs to be redeployed if you have not already deployed the v9 Worker.
