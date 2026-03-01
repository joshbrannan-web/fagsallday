

## Tournament Mode Routing

Yes, using a sub-route is the right approach. Since this is a single-page app using HashRouter, the tournament routes will be:

- `fagsallday.com/#/tournament` — Tournament list / join
- `fagsallday.com/#/tournament/:id` — Dashboard & leaderboard
- `fagsallday.com/#/tournament/:id/round/:roundId` — Scorecard
- `fagsallday.com/#/tournament/:id/setup-round` — Super user round setup

This keeps tournament mode as part of the same app (shared auth, shared components like course search and scorecard) while being a distinct section. The join link shared with players would look like:

```text
fagsallday.com/#/tournament/join?code=ABC123
```

No separate deployment or subdomain needed — it all lives within the existing app and routes.

The plan in `.lovable/plan.md` already reflects this structure. Ready to proceed with implementation when you approve.

