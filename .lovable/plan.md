

## Plan: Scorecard Par Totals, Unlock Round, and Settlement Plan in Share

Three features to implement:

---

### Feature 1: Show Total Par for F9, B9, and 18 in the Scorecard

Currently the scorecard header columns for "F9"/"B9" and "18" only show labels. We will add the total par from the course data underneath each label.

**File: `src/components/Scorecard.tsx`**

Update the header row (around line 923-924) to include par totals:

- Calculate `front9Par` = sum of `par` for holes 1-9
- Calculate `back9Par` = sum of `par` for holes 10-18
- Calculate `totalPar` = front9Par + back9Par
- Display the appropriate par under the F9/B9 and 18 column headers, using the same `text-[10px]` style as the per-hole par labels

The header cells will look like:

```
F9              18
par 36          par 72
```

---

### Feature 2: Unlock a Locked Round

Allow users to unlock a previously locked round so they can make edits again. This transitions the round from `LOCKED` back to `COMPLETE`.

**File: `src/hooks/useRounds.tsx`**

Add an `unlockRound` function:
```typescript
const unlockRound = async (roundId: string) => {
  return updateRound(roundId, { status: 'COMPLETE' });
};
```

**File: `src/contexts/AppContext.tsx`**

Add `unlockRound: () => void` to the `AppState` interface.

**File: `src/App.tsx`**

- Destructure `unlockRound` (reusing `dbLockRound` pattern but for unlock)
- Actually, we can add a new `dbUnlockRound` from `useRounds` and wire it through context
- Wire `unlockRound` in the value object, handling both authenticated and local users

**File: `src/components/RoundSummary.tsx`**

- When the round is `LOCKED`, show an "Unlock Round" button (with an `Unlock` icon) in the footer area
- Clicking it shows a confirmation prompt, then calls `unlockRound()`
- After unlocking, the round goes back to `COMPLETE` status, re-enabling course and amount editing

---

### Feature 3: Settlement Plan in the Share Message

When the user shares round results, append a "Settlement Plan" section that tells each player who they need to pay and how much. The algorithm minimizes the number of transactions.

**Algorithm: Minimum Transactions Settlement**

Given player balances (e.g., Josh: +$45, Mike: +$20, Dave: -$30, Tom: -$35):

1. Separate players into creditors (positive balance) and debtors (negative balance)
2. Sort creditors descending by amount owed to them
3. Sort debtors descending by amount they owe (most negative first)
4. Greedily match: the largest debtor pays the largest creditor up to the minimum of what they owe / are owed, then adjust balances and repeat
5. This produces the minimum number of transactions needed

**Example:**

```
Results:
  Josh: +$45
  Mike: +$20
  Dave: -$30
  Tom:  -$35

Settlement:
  Tom pays Josh $35
  Dave pays Josh $10
  Dave pays Mike $20
```

Without optimization, Tom would need to pay both Josh and Mike, and Dave would also need to pay both. With the greedy approach, we get 3 transactions (the theoretical minimum for 2 creditors and 2 debtors), and we match the largest debtor (Tom, -$35) with the largest creditor (Josh, +$45) first, settling Tom completely in one payment. Then Dave's remaining $30 is split: $10 to finish off Josh's balance, and $20 to Mike.

**File: `src/services/gameEngine.ts`**

Add a new utility function:

```typescript
export const calculateSettlement = (
  playerAmounts: { name: string; amount: number }[]
): { from: string; to: string; amount: number }[] => {
  // Filter out zero balances
  const creditors = playerAmounts
    .filter(p => p.amount > 0)
    .map(p => ({ ...p }))
    .sort((a, b) => b.amount - a.amount);
  
  const debtors = playerAmounts
    .filter(p => p.amount < 0)
    .map(p => ({ name: p.name, amount: Math.abs(p.amount) }))
    .sort((a, b) => b.amount - a.amount);
  
  const transactions: { from: string; to: string; amount: number }[] = [];
  
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    transactions.push({
      from: debtors[i].name,
      to: creditors[j].name,
      amount: payment
    });
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  
  return transactions;
};
```

**File: `src/components/RoundSummary.tsx`**

Update the `handleShare` function to append the settlement plan after the existing share text:

```
--- Who Pays Who ---
Tom pays Josh $35
Dave pays Josh $10
Dave pays Mike $20
```

This section only appears if there are actual non-zero balances (i.e., money changed hands). Players at $0 are excluded from the settlement.

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/components/Scorecard.tsx` | Add par totals to F9/B9 and 18 header columns |
| `src/services/gameEngine.ts` | Add `calculateSettlement` utility function |
| `src/hooks/useRounds.tsx` | Add `unlockRound` function |
| `src/contexts/AppContext.tsx` | Add `unlockRound` to AppState interface |
| `src/App.tsx` | Wire `unlockRound` through context for both auth and local users |
| `src/components/RoundSummary.tsx` | Add Unlock button for locked rounds; add settlement plan to share text |

