
## Add Environment Files to .gitignore

The `.gitignore` file is missing entries for `.env` files. While the credentials in `.env` are public keys (anon key and project URL), it's still best practice to exclude environment files from version control.

### Current State
The `.gitignore` already has `*.local` (which covers `.env.local`), but is missing explicit `.env` and `.env.production` entries.

### Changes
**File: `.gitignore`** -- Add an environment files section:
```
# Environment files
.env
.env.local
.env.production
```

This will be added after the `*.local` line (around line 13). Note that `*.local` already covers `.env.local`, but adding it explicitly improves clarity.

### Important Note
Adding these to `.gitignore` only prevents future tracking. If `.env` is already committed, it will remain in Git history. Since these contain only public keys (not secret keys), this is not a security concern, but it's good hygiene.
