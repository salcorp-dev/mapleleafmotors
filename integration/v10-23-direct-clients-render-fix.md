# v10.23 Direct Clients Render Fix

This bypasses the older admin renderer for the Our Clients tables.

Fixes:
- Delivery uploads show in the Delivery Photos table.
- Reviews show in the Reviews table.
- Edit / Archive / Restore / Delete buttons are bound directly.
- Refresh From API reloads the tables.
- Upload success triggers table refresh.

Important:
- Redeploy the Worker because Edit/Archive needs PATCH /clients/deliveries/<id> and PATCH /clients/testimonials/<id>.
