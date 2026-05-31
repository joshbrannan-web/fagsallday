## Goal
Restructure `/tournament-admin` so it presents two clearly separated paths — **Registrations** and **Tournaments** — each with its own "view list" and "create new" entry point.

## Changes (UI only, `src/pages/TournamentAdmin.tsx`)

Replace the current single-column layout (one Registrations button + tournament list + floating "+") with two side-by-side section cards on desktop, stacked on mobile.

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  📋 Registrations       │  │  🏆 Tournaments         │
│  Collect signups for    │  │  Run live tournaments   │
│  upcoming events        │  │  with groups & scoring  │
│                         │  │                         │
│  [ View Registrations ] │  │  [ View Tournaments ]   │
│  [ + Create New        ]│  │  [ + Create New        ]│
└─────────────────────────┘  └─────────────────────────┘
```

- **Registrations card**
  - "View Registrations" → `/tournament-admin/registrations`
  - "Create New Registration" → `/tournament-admin/registrations` with a query flag (e.g. `?new=1`) OR navigate there and auto-open the existing create form. Simplest: navigate to `/tournament-admin/registrations?new=1` and have `TournamentRegistrationAdmin` read the param and set `showCreateForm` on mount.
- **Tournaments card**
  - "View Tournaments" → new route/section showing the existing tournament list (move current list rendering to `/tournament-admin/tournaments`)
  - "Create New Tournament" → `/tournament-admin/create` (existing route)

## Routing
- Add route `/tournament-admin/tournaments` rendering a list page that uses the existing `useTournaments` + `TournamentCard` (extract current list block from `TournamentAdmin.tsx` into a small new page `TournamentList.tsx`).
- Keep `/tournament-admin/create` and `/tournament-admin/registrations` as-is.

## Small follow-ups
- Remove the floating "+" FAB from the landing page (no longer needed; each card has its own create button).
- `TournamentRegistrationAdmin` reads `?new=1` and opens the create form automatically.

## Out of scope
No backend, schema, or business-logic changes. Pure presentation + routing.
