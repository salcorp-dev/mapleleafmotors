# v10.6 Payment Calculator Editor

Adds a biweekly payment calculator to the Live Inventory edit modal.

Fields:
- Interest rate %
- Term months
- Tax rate %
- Down payment
- Monthly payment
- Biweekly payment
- Weekly payment
- Payment note

Defaults:
- 7% interest
- 84 months
- 12% tax
- $0 down

Worker PATCH /admin/inventory/<id> now saves:
- monthlyPayment
- biweeklyPayment
- weeklyPayment
- financeTermMonths
- financeRate
- taxRate
- downPayment
- paymentNote

Deploy:
1. Upload website files.
2. Redeploy Worker from workers/inventory-api-worker.js.
