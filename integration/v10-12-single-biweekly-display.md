# v10.12 Single Biweekly Display

Fixes duplicate biweekly display on public vehicle pages/cards.

Keeps the cleaner existing style:

```text
Est. $153/biweekly
```

Removes/hides the extra pill beside the price:

```text
Biweekly $153
```

Also patches the public JS to prefer the admin-saved `biweeklyPayment` value when available.
