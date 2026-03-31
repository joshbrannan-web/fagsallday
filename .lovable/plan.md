

# Fix Google Service Account Key Parsing in Edge Function

## Problem
The `GOOGLE_SERVICE_ACCOUNT_KEY` secret is set, but it's likely stored in a double-serialized format (e.g., the JSON string was wrapped in extra quotes when saved). This causes `JSON.parse()` to fail because it encounters a string instead of an object.

## Fix

### `supabase/functions/create-registration-sheet/index.ts`

Replace the current parsing logic with a normalizing parser that handles both plain JSON and double-encoded JSON:

```ts
const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
let serviceAccount: any;
try {
  const trimmed = raw.trim();
  serviceAccount = JSON.parse(
    trimmed.startsWith("{") ? trimmed : JSON.parse(trimmed)
  );
} catch (parseErr) {
  console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", parseErr);
  return new Response(
    JSON.stringify({ error: "Invalid service account key format" }),
    { status: 500, headers: corsHeaders }
  );
}
```

If the raw value starts with `{`, it's already valid JSON and gets parsed directly. If it starts with `"` (double-encoded), the inner `JSON.parse` unwraps it first. This is a ~5-line change in the existing file.

