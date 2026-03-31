

# Make Google Sheets Accessible via Link

## What
When the `create-registration-sheet` edge function creates a new Google Sheet, it will also set "anyone with the link can edit" permissions. This removes the need for email matching between the admin's login and Google account.

## Change

### `supabase/functions/create-registration-sheet/index.ts`
After creating the spreadsheet (and after the existing email-sharing block), add a second Drive API permissions call:

```ts
// Make sheet accessible to anyone with the link
await fetch(
  `https://www.googleapis.com/drive/v3/files/${sheetData.spreadsheetId}/permissions`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "writer",
      type: "anyone",
    }),
  }
);
```

This is a single-file, ~10-line addition. The existing email-based sharing stays as a fallback. No database or frontend changes needed.

