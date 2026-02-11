

## Fix Persistent "Cannot read properties of null (reading 'useState')" Error

### Root Cause

The browser is serving stale Vite pre-bundled dependency chunks. The chunk hash `v=2f3a5f5d` has not changed across any of the previous fix attempts, meaning the browser never loaded fresh code. Additionally, `src/components/ui/sonner.tsx` references `React.ComponentProps` without importing React, which can cause module resolution inconsistencies.

### Plan

**Step 1: Fix missing React import in sonner.tsx**

Add `import * as React from "react"` to `src/components/ui/sonner.tsx` which currently uses `React.ComponentProps` without importing React.

**Step 2: Force fresh dependency hash by adding Vite config timestamp**

Add a comment with a timestamp to `vite.config.ts` to force a different file hash and trigger a full re-bundle with new chunk hashes, breaking the browser cache cycle.

**Step 3: Ensure consistent React imports across entry files**

Standardize `src/main.tsx` and `src/App.tsx` to both use `import React from 'react'` (not mixed namespace/default imports) for consistent module resolution.

### Technical Details

- The `optimizeDeps.force: true` setting is already in place but the browser HTTP cache is serving old chunks
- The `resolve.dedupe` setting correctly deduplicates React but only matters when new chunks are generated
- The timestamp comment forces Vite to generate entirely new chunk filenames, bypassing browser cache
- The missing React import in `sonner.tsx` is a latent bug that can cause the automatic JSX transform to resolve React differently than explicit imports

### Files to modify
1. `src/components/ui/sonner.tsx` - Add React import
2. `vite.config.ts` - Add cache-busting comment
3. `src/main.tsx` - Standardize React import style

