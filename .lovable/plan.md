

## Plan: Fix Edge Function Auth Error

The edge function `generate-round-links` is failing with `"supabaseUser.auth.getClaims is not a function"`. The `getClaims()` method doesn't exist on the Supabase JS client. Need to replace it with `supabase.auth.getUser()`.

### Change

**File: `supabase/functions/generate-round-links/index.ts`** — Replace the `getClaims` block (lines ~40-48) with `getUser()`:

```typescript
const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
const userId = user.id;
```

Remove the `token` variable and `getClaims` call entirely. No other files need changes.

