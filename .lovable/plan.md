

# Plan: Persist Tournament Tab When Navigating Away and Back

## Problem
The `activeTab` state in `ActiveRound.tsx` is initialized to `'betting'` every time the component mounts (line 64). When a player navigates to the tournament scorecard or home page and returns, the component remounts and resets to the betting tab, losing the tournament view.

## Fix

### `src/components/ActiveRound.tsx` — line 64

Change the `activeTab` initializer to default to `'tournament'` when a `tournamentGroupId` is present in the route state. This way, tournament-mode rounds always open to the tournament tab.

```tsx
// Before
const [activeTab, setActiveTab] = useState<'betting' | 'tournament'>('betting');

// After
const [activeTab, setActiveTab] = useState<'betting' | 'tournament'>(
  tournamentGroupId ? 'tournament' : 'betting'
);
```

Since `tournamentGroupId` is derived from `location.state` (line 42) which is already resolved before this `useState` call, this is safe to use as the initial value.

| File | Change |
|---|---|
| `src/components/ActiveRound.tsx` | Default `activeTab` to `'tournament'` when `tournamentGroupId` exists |

1 line changed, 0 database changes.

