

# Fix: Surface participant linking errors to the user

## Problem
When `insertRoundParticipants` fails, the error is silently logged to console. The round owner has no idea that linked players won't be able to see the round.

## Fix
**File:** `src/hooks/useRounds.tsx` (line 59-61)

Add a toast warning when the upsert fails:

```typescript
if (error) {
  console.error('Error inserting round participants:', error);
  toast.warning('Some players may not see this round in their account. You can reshare the round link.');
}
```

Import `toast` from `sonner` at the top of the file (if not already imported).

One file, ~2 lines changed.

