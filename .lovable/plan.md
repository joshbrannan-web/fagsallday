

## Phase 1: Security and Stability Fixes

### 1. Clean up supabase/config.toml
Remove all `[functions.*]` sections with `verify_jwt = false`. The file will only contain:
```toml
project_id = "wvmpxjcghlgtitdhozlj"
```
Note: This file is listed as auto-managed by the system. We will attempt the edit, but if the system prevents it, JWT validation is already handled in-code for all functions.

### 2. CORS Origin Restriction (7 Edge Functions)
Replace `"Access-Control-Allow-Origin": "*"` with dynamic origin checking in all 7 functions:
- `admin-delete-user/index.ts`
- `admin-list-users/index.ts`
- `admin-reset-password/index.ts`
- `generate-reset-link/index.ts`
- `parse-scorecard/index.ts`
- `search-course/index.ts`
- `send-welcome-email/index.ts`

Each function will get:
```typescript
const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];
const origin = req.headers.get("origin") || "";
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
```
And all `corsHeaders` objects will use `corsOrigin` instead of `"*"`.

Since `corsOrigin` is computed per-request (inside the handler), the `corsHeaders` must be moved inside the handler or constructed dynamically. Each function will build CORS headers inside the request handler.

### 3. Manual Stroke Validation in gameEngine.ts
Clamp manual strokes to `[0, 3]` at all 4 locations where `MANUAL_STROKES` is read:

- **Line 274** (`calculateGameStrokes`): Change `return manualStrokes;` to `return Math.max(0, Math.min(manualStrokes, 3));`
- **Line 577** (banker calc): Change `playerStrokesReceived = playerManualStrokes;` to `playerStrokesReceived = Math.max(0, Math.min(playerManualStrokes, 3));`
- **Line 1738** (banker matchup): Change `playerStrokes = manualStrokes;` to `playerStrokes = Math.max(0, Math.min(manualStrokes, 3));`
- **Line 1954** (team banker): Change `playerStrokesReceived = playerManualStrokes;` to `playerStrokesReceived = Math.max(0, Math.min(playerManualStrokes, 3));`

Also clamp `bankerManualStrokes` at line 580 where it appears.

### 4. Manual Stroke Validation in stockton6Engine.ts
At **line 121-122**, change:
```typescript
const effectiveStrokes = manualStrokes !== undefined && manualStrokes !== null 
  ? manualStrokes 
```
to:
```typescript
const effectiveStrokes = manualStrokes !== undefined && manualStrokes !== null 
  ? Math.max(0, Math.min(manualStrokes, 3))
```

### 5. Catch-All 404 Route in App.tsx
- Add `import NotFound from "./pages/NotFound";` with the other page imports (after line 14)
- Add `<Route path="*" element={<NotFound />} />` as the last route before `</Routes>` (after line 500)

### Technical Notes
- The `supabase/config.toml` is noted as auto-managed. If edits are blocked, a note will be provided.
- All 7 edge functions will be redeployed automatically after changes.
- CORS changes require moving header construction inside request handlers since origin is per-request.
