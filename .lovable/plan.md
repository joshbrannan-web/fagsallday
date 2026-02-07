

## Fix: Recent Rounds Status Labels in Setup Wizard

### Problem

The Recent Rounds section in the Setup Wizard uses a simple ternary that only checks for `COMPLETE` and falls back to "In Progress" for everything else. This means `LOCKED` rounds incorrectly show as "In Progress."

### Change

**File: `src/components/SetupWizard.tsx`** (lines 931-933)

Replace the two-state ternary with a helper that handles all statuses:

| Status | Label | Color |
|--------|-------|-------|
| `ACTIVE` | Active | Yellow |
| `COMPLETE` | Complete | Green |
| `LOCKED` | Locked | Blue |
| `SETUP` | Setup | Gray (unlikely to appear) |

**Current code (lines 931-933):**
```tsx
<span className={round.status === 'COMPLETE' ? 'text-green-600' : 'text-yellow-600'}>
  {round.status === 'COMPLETE' ? 'Complete' : 'In Progress'}
</span>
```

**New code:**
```tsx
<span className={
  round.status === 'LOCKED' ? 'text-blue-600' :
  round.status === 'COMPLETE' ? 'text-green-600' :
  round.status === 'ACTIVE' ? 'text-yellow-600' :
  'text-muted-foreground'
}>
  {round.status === 'LOCKED' ? 'Locked' :
   round.status === 'COMPLETE' ? 'Complete' :
   round.status === 'ACTIVE' ? 'Active' :
   round.status}
</span>
```

This is a single 2-line edit in one file. No other changes needed.

