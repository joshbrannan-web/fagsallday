

## Fix "No Users Found" Message in UserSearchDialog

### Problem

Currently, the "No users found" message appears whenever the search term is 2+ characters long and results are empty -- even before the user has clicked the search button. This is confusing because the user hasn't searched yet.

### Solution

Add a `hasSearched` boolean state that only becomes `true` after the search button is clicked (or Enter is pressed). Show "No users found" only when `hasSearched` is `true` and results are empty. Reset `hasSearched` to `false` when the search term changes.

### Changes

**Modified file: `src/components/UserSearchDialog.tsx`**

1. Add state: `const [hasSearched, setHasSearched] = useState(false);`
2. In `handleSearch`, set `setHasSearched(true)` right before/after the API call
3. In the `onChange` handler for the Input, also call `setHasSearched(false)` so typing a new query clears the stale message
4. Update the "No users found" condition from:
   - `results.length === 0 && !isSearching && searchTerm.trim().length >= 2`
   - to: `results.length === 0 && !isSearching && hasSearched`
5. Reset `hasSearched` to `false` when the dialog closes (in `onOpenChange` or when `open` changes)

