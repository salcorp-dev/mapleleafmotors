# v9.6 Checkbox + Email Notifications

## Fixed

- The final consent checkbox on `/get-approved.html` is now clickable.
- The label toggles the checkbox.
- Added cache busting: `assets/js/funnel.js?v=9.6`

## Email notifications

The Worker now supports optional email notifications using Resend.

Add these Cloudflare Worker secrets if you want email alerts:

```text
RESEND_API_KEY = your Resend API key
LEAD_NOTIFY_EMAIL = the email address that receives lead alerts
LEAD_FROM_EMAIL = Maple Leaf Motors <leads@yourdomain.com>
```

`LEAD_FROM_EMAIL` must be a sender/domain accepted by Resend. For quick testing, you can try:

```text
Maple Leaf Motors <onboarding@resend.dev>
```

but for production, verify your own domain/sender in Resend.

Existing required secrets remain:

```text
API_TOKEN
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Existing required bindings remain:

```text
INVENTORY_KV
VEHICLE_IMAGES
```

If the email send fails, the lead still saves to Cloudflare KV and appears in the admin dashboard.
