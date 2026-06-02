# v10.11 Live Calculator + Save Fix

Fixes:
- Calculator now updates immediately when vehicle price, term, APR, or down payment changes.
- Removed dependency on the old Calculate button.
- Save Vehicle recalculates before saving.
- Save Vehicle now includes monthlyPayment, biweeklyPayment, weeklyPayment, financeRate, financeTermMonths, taxRate, downPayment, and paymentNote.
- Save request has a 20 second timeout so it will not stay stuck on Saving forever.

Deploy:
1. Upload website files.
2. Redeploy Worker from workers/inventory-api-worker.js.
3. Open /admin/dashboard.html?fresh=1011 and hard refresh.
