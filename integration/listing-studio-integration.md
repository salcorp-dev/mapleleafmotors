# Listing Studio Integration

Later, replace sample inventory by exporting this shape from Listing Studio:

{
  "vehicle": {
    "id": "2021-honda-civic-ex",
    "year": 2021,
    "make": "Honda",
    "model": "Civic",
    "trim": "EX",
    "price": 24995,
    "mileage": 61000,
    "bodyStyle": "Sedan",
    "featured": true,
    "sold": false,
    "images": ["https://..."],
    "features": ["Heated Seats", "Backup Camera"],
    "description": "..."
  }
}

The current admin import accepts this JSON.
For real publishing, connect the Edge extension button to a Cloudflare Worker or Supabase endpoint.
