# v10.22 Clients Table Actions

Fixes:
- Uploaded delivery photos now appear in the Delivery Photos table after upload/refresh.
- Adds Delivery actions:
  - Edit
  - Archive / Restore
  - Delete
- Adds Review actions:
  - Edit
  - Archive / Restore
  - Delete

Worker:
- Public `/clients` hides archived entries.
- Admin `/clients` with admin token returns all entries, including archived.
- Adds `PATCH /clients/deliveries/<id>` and `PATCH /clients/testimonials/<id>`.
