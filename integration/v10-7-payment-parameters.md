# v10.7 Payment Calculator Parameters

Updated the Live Inventory editor calculator to use:

- 12% Manitoba tax added to vehicle price before payment calculation
- Standard amortization formula
- Default interest rate: 7% APR
- Optional interest rate: 2.9% APR
- Default term: 84 months
- Term options: 36, 48, 60, 72, 84, 96 months
- Shows monthly and biweekly payments
- Rounds payments to nearest dollar
- Biweekly = monthly × 12 ÷ 26

Deploy website files. Worker can remain from v10.6 if already deployed with the payment fields, but this ZIP also includes the Worker file.
