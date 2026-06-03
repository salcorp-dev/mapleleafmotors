# v11.2 Clients Wall + Remove Get Approved Button

Changes:
- Removed the nav Start Approval / Get Approved button.
- Fixed homepage Our Clients delivery wall by adding the missing `esc()` helper in app.js.
- Clients fetch now has a fallback clients API URL even when config loading fails.
- Homepage client wall no longer depends on the nav preview existing first.
