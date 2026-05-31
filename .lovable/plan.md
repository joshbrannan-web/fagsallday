## Hide existing registrations list while creating new

In `src/pages/TournamentRegistrationAdmin.tsx`, when `showCreateForm` is true, render only the `RegistrationConfigForm` and hide both the "No registration pages yet" empty-state card and the list of existing config cards below it.

Change the conditional around line 554 so the `configs.map(...)` block (and the empty-state) only renders when `!showCreateForm`. The "New" button at the top continues to toggle the form open/closed.

No other files or logic change.