# True Admin Auth Setup

This version removes the hardcoded admin password and removes the API token from the admin page.

## What is true now

The admin page no longer checks a password inside the public JavaScript.

Instead:

1. `/admin/index.html` sends the password to the Cloudflare Worker.
2. The Worker checks it against the `ADMIN_PASSWORD` secret or the changed password stored in KV.
3. The Worker returns a signed 12-hour admin session token.
4. The admin dashboard uses that temporary session token to upload/delete Our Clients content.
5. The API token remains only for Listing Studio inventory uploads.

## Cloudflare Worker secrets required

In Cloudflare, open:

```text
Workers & Pages
maple-leaf-inventory
Settings
Variables
```

Keep your existing secret:

```text
API_TOKEN = MapleLeafWebsite2026SecureToken
```

Add these two new secrets:

```text
ADMIN_PASSWORD = your strong admin login password
ADMIN_SESSION_SECRET = a long random secret string
```

Example for `ADMIN_SESSION_SECRET`:

```text
mlm-session-2026-change-this-to-a-long-random-string-64chars
```

## Update Worker code

Copy and deploy:

```text
workers/inventory-api-worker.js
```

## Update website files

Upload the ZIP contents to GitHub/Cloudflare Pages as usual.

Make sure this file is live:

```text
/assets/data/config.json
```

It should include:

```json
{
  "clientsApiUrl": "https://maple-leaf-inventory.sal96wpg.workers.dev/clients",
  "adminApiUrl": "https://maple-leaf-inventory.sal96wpg.workers.dev/admin"
}
```

## Change password from dashboard

After logging in:

```text
Admin Dashboard
Settings
Admin Login Password
```

Changing the password saves it in Cloudflare KV, so it applies across browsers/devices.

## Important limitation

This protects the API actions. The static HTML files under `/admin/` can still be opened by anyone, but they cannot log in or upload/delete without the Worker-approved session token.
