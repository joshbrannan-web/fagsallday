

## Fix: BlueGolf CAPTCHA Blocking Causes Fabricated Scorecard Data

### Root Cause

When Firecrawl scrapes a BlueGolf detail page (e.g., `detailedscorecard.htm`), BlueGolf frequently returns a CAPTCHA challenge instead of the actual scorecard. The AI then receives no real data and invents realistic-looking numbers from its training knowledge. This is why HCP, yardage, and other values do not match the actual BlueGolf scorecard.

### Solution

Two changes to `supabase/functions/search-course/index.ts`:

#### 1. Detect CAPTCHA / Empty Content and Fail Gracefully

Before sending scraped content to the AI, check if the markdown contains CAPTCHA indicators (e.g., "confirm you are human", "solve a puzzle") or is suspiciously short (under ~1000 chars for a full scorecard page). If detected, return an error telling the user the page was blocked, rather than silently generating fake data.

Add this check after line 384 (after logging the scraped content preview):

```
if (scrapedMarkdown.length < 1000 || 
    scrapedMarkdown.includes('confirm you are human') || 
    scrapedMarkdown.includes('solve a puzzle') ||
    scrapedMarkdown.includes('security check')) {
  return Response with error: "BlueGolf blocked the request. Please try again in a moment or enter course details manually."
}
```

#### 2. Add a Retry with Delay

Before failing, attempt one retry after a short delay (2-3 seconds). CAPTCHA blocks are sometimes transient. Use `waitFor: 5000` on the retry to give the page more time to load.

```
Flow:
  1. Scrape with waitFor: 2000
  2. If CAPTCHA detected, wait 3 seconds
  3. Retry scrape with waitFor: 5000
  4. If still CAPTCHA, return error to user
```

#### 3. Strengthen the AI Prompt to Never Fabricate

Update the system prompt (line 402) to add an explicit instruction:

```
"CRITICAL: If the page content does not contain an actual scorecard table with 
numeric hole data, return { "error": "no_scorecard_data" } instead of guessing. 
Never invent or estimate values."
```

Then handle this `error` response in the parsing logic and return a user-friendly message.

### Summary of Changes

All in `supabase/functions/search-course/index.ts`:

1. Add CAPTCHA detection after scraping (check content length and keywords)
2. Add one retry with longer wait time before giving up
3. Add "never fabricate" instruction to the AI system prompt
4. Handle AI "no data" response gracefully with a clear user-facing error

### Why This Matters

Without this fix, users receive incorrect scorecard data that looks valid. They may not realize the HCP, yardage, or par values are wrong until they compare against a physical scorecard. Failing explicitly is far better than returning silently wrong data.

