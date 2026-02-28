

## Plan: Update Share Text Headers and Add Total Payouts Section

Two changes to `buildShareText` in `src/components/RoundSummary.tsx`:

### 1. Add "--- Game $$ Payouts ---" header before player results (line 320)
Change the return template to insert the new header before the results block.

### 2. Add "--- Total Payouts ---" section before "Who Pays Who" (lines 308-318)
After the green fee section and before settlement, insert a new section showing each player's net position (game P&L + green fee adjustments) using `finalAmounts`.

### Updated return (line 320):
```typescript
return `🏌️ ${currentRound.course.name} - ${roundDate}\n\n--- Game $$ Payouts ---\n\n${results}\n\nMoney Shot by F&Gs All Day${gameBreakdown}${greenFeeText}${totalPayoutsText}${settlementText}`;
```

### New "Total Payouts" block (after line 306):
Only shown when green fees are included (otherwise the game payouts already tell the full story):
```typescript
let totalPayoutsText = '';
if (greenFee) {
  const totalLines = sortedPlayers.map(p => 
    `${p.name} net: ${formatMoney(finalAmounts[p.id] || 0)}`
  ).join('\n');
  totalPayoutsText = `\n\n--- Total Payouts ---\n${totalLines}`;
}
```

**File**: `src/components/RoundSummary.tsx` — lines 308-320

