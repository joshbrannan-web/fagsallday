

# Add Game Type Info Button in Tournament Round Config

## What
Add an info button next to the Game Type selector in the tournament round config. When tapped, it shows a popover/dialog with a description of the selected game type and how it's played.

## How

### 1. Create tournament game descriptions
Add a `TOURNAMENT_GAME_DETAILS` map in `RoundConfigCard.tsx` (or a shared location) with descriptions for each tournament game type (`match_play_individual`, `match_play_best_ball`, etc.). These are different from the casual game types in `gameLibrary.ts`, so they need their own descriptions.

### 2. Update `RoundConfigCard.tsx`
- Import `Popover`, `PopoverTrigger`, `PopoverContent`
- After a game type is selected, render a small `Info` icon button next to the select dropdown
- Clicking it opens a popover with:
  - Game type name (bold)
  - How it works description
  - Key rules (points, handicaps, format details)

### Layout
```text
Game Type *
┌──────────────────────────┐  ⓘ
│ Best Ball Match Play     │
└──────────────────────────┘

Popover on ⓘ click:
┌─────────────────────────────┐
│ Best Ball Match Play (2v2)  │
│                             │
│ Two teams of 2. Each hole,  │
│ the lowest net score from   │
│ each team is compared...    │
└─────────────────────────────┘
```

**1 file changed:** `src/components/tournament-admin/RoundConfigCard.tsx`

