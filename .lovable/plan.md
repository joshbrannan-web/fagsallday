

# Default Active Round to Betting Tab

## Problem
When a player starts a tournament round, the active round screen defaults to the **Tournament** tab because the code defaults to `'tournament'` when a `tournamentGroupId` is present and no `preferredTab` is specified.

## Change

**`src/components/ActiveRound.tsx`** — Line 70: Change the default from `'tournament'` to `'betting'` so the initial view always opens on the Betting tab.

```typescript
// Before
preferredTab || (tournamentGroupId ? 'tournament' : 'betting')

// After
preferredTab || 'betting'
```

**1 file, 1 line changed.**

