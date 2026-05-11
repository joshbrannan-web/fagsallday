# Fix "Failed to Submit Registration"

## Root cause

Database logs confirm every submission fails with:

> new row violates row-level security policy for table "tournament_registration_entries"

The `INSERT` policy itself (`Anyone can register`, WITH CHECK `true`) allows the write, but the client calls:

```ts
.insert(entry).select('id').single()
```

`INSERT … RETURNING` re‑applies the table's `SELECT` policies to the returned row. The only SELECT policy on `tournament_registration_entries` is "Creator can read registration entries" (config owner only). A registrant — especially an anonymous one — does not satisfy it, so Postgres rejects the row with the RLS error above.

## Fix

Generate the entry id on the client and drop the `.select().single()` call so no row needs to be returned.

### Change in `src/pages/TournamentRegistration.tsx` (`handleSubmit`)

```ts
const newId = crypto.randomUUID();
const entry = {
  id: newId,
  config_id: config.id,
  user_id: user?.id || null,
  // ...rest unchanged
};

const { error } = await supabase
  .from('tournament_registration_entries')
  .insert(entry);

if (error) throw error;

supabase.functions.invoke('sync-registration-to-sheets', {
  body: { config_id: config.id, entry },
}).catch(err => console.warn('Sheet sync failed:', err));
```

No DB / RLS changes needed — the existing "Anyone can register" INSERT policy is correct, and we keep registrants from being able to read other entries.

## Verification

1. Open the public registration page while logged out (and again while logged in as a non‑creator).
2. Submit the form — toast should show "Registration submitted!" and the success card should render.
3. Confirm the new row appears in the admin Registration list and in the Google Sheet (sync still receives the same `entry.id`).
