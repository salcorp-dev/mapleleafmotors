# v9.5 Funnel JS Conflict Fix

The funnel was not clickable because the funnel JavaScript used a global `const $`, which can conflict with the main site `app.js` global constants.

Fix:
- Wrapped `assets/js/funnel.js` in an isolated function scope.
- Renamed helper variables internally.
- Added cache busting on get-approved page: `funnel.js?v=9.5`.
- Selection now shows visibly and Continue moves to the next step.

No Worker/settings changes required.
