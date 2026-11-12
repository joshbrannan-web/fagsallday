#!/bin/bash
# sync-app.sh — "sync the app" routine for the mobile branch.
# Run from Terminal on the Mac:  cd ~/Documents/GitHub/fagsallday && bash scripts/sync-app.sh
# Stops at the first problem. Never commits, pushes, or resolves conflicts.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1

PBX="ios/App/App.xcodeproj/project.pbxproj"
LOGDIR="$REPO/.sync-logs"
mkdir -p "$LOGDIR"
# Keep logs out of git without changing any tracked file (.git/info/exclude is local-only)
grep -qx '.sync-logs/' .git/info/exclude 2>/dev/null || echo '.sync-logs/' >> .git/info/exclude
LOG="$LOGDIR/sync-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee "$LOG") 2>&1
ln -sf "$(basename "$LOG")" "$LOGDIR/latest.log"

step() { echo; echo "=================================================="; echo "STEP $1"; echo "=================================================="; }
fail() {
  echo
  echo "##################################################"
  echo "###  STOPPED: $1"
  echo "###  Nothing after this step was run."
  echo "##################################################"
  echo "RESULT: FAILED"
  exit 1
}
ask() { echo; echo "$1 [y/N]"; read -r ans </dev/tty; [ "$ans" = "y" ] || [ "$ans" = "Y" ]; }

echo "sync-app started $(date)"
echo "Repo: $REPO"

# ---------- 1. Branch check ----------
step "1/7  Confirm branch is 'mobile'"
BRANCH="$(git branch --show-current)"
echo "Current branch: $BRANCH"
if [ "$BRANCH" != "mobile" ]; then
  echo "WARNING: you are on '$BRANCH', not 'mobile'. Native/iOS work belongs on 'mobile'."
  ask "Continue anyway on '$BRANCH'?" || fail "Not on mobile branch (you chose not to continue)."
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uncommitted changes to tracked files:"
  git status --short --untracked-files=no
  echo "(A leftover Build-number bump from a previous sync is normal here.)"
  ask "Continue with these uncommitted changes?" || fail "Uncommitted changes (you chose not to continue)."
fi

# ---------- 2. git pull ----------
step "2/7  git pull"
if ! git pull --no-rebase --no-edit; then
  CONFLICTS="$(git diff --name-only --diff-filter=U)"
  if [ -n "$CONFLICTS" ]; then
    echo
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "!!!  MERGE CONFLICTS — resolve these yourself:  !!!"
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "$CONFLICTS"
    echo
    echo "The repo is mid-merge. Fix the files above and commit,"
    echo "or undo the pull with:  git merge --abort"
    fail "git pull hit merge conflicts."
  fi
  fail "git pull failed (see message above — no conflicts were created)."
fi
if [ -n "$(git diff --name-only --diff-filter=U)" ]; then fail "Unmerged files present after pull."; fi

# ---------- 3. npm install ----------
step "3/7  npm install"
npm install || fail "npm install failed."
if ! git diff --quiet -- package-lock.json; then
  echo "NOTE: npm install changed package-lock.json (see step 6 for whether it's still in sync)."
fi

# ---------- 4. npm run build ----------
step "4/7  npm run build"
npm run build || fail "npm run build failed."

# ---------- 5. cap sync ----------
step "5/7  npx cap sync ios"
npx cap sync ios || fail "npx cap sync ios failed."

# ---------- 6. Lockfile checks ----------
# Runs in a throwaway copy (like Cloudflare does) so your real node_modules is untouched.
step "6/7  Lockfile checks (npm ci + bun install --frozen-lockfile)"
command -v bun >/dev/null 2>&1 || fail "bun is not installed on this Mac, so the bun lockfile check can't run. Install it from https://bun.sh then re-run."
TMP="$(mktemp -d)"
cp package.json package-lock.json "$TMP"/
for f in bun.lock bun.lockb .npmrc; do [ -f "$f" ] && cp "$f" "$TMP"/; done
( cd "$TMP" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null ) \
  && echo "PASS: npm ci" \
  || { rm -rf "$TMP"; fail "npm ci failed — package-lock.json is out of step with package.json. Do NOT push this to main."; }
rm -rf "$TMP/node_modules"
( cd "$TMP" && bun install --frozen-lockfile --ignore-scripts ) \
  && echo "PASS: bun install --frozen-lockfile" \
  || { rm -rf "$TMP"; fail "bun install --frozen-lockfile failed — bun.lock is out of step. This is what breaks Cloudflare."; }
rm -rf "$TMP"

# ---------- 7. Build number + Version ----------
step "7/7  Increment Build number and set Version"
NUMS="$(grep -E 'CURRENT_PROJECT_VERSION = [0-9]+;' "$PBX" | sed -E 's/.*= ([0-9]+);.*/\1/' | sort -u)"
COUNT="$(printf '%s\n' "$NUMS" | grep -c .)"
[ "$COUNT" -eq 1 ] || fail "Found different Build numbers in the Xcode project ($(echo $NUMS)). Fix in Xcode before archiving."
OLD="$NUMS"
NEW=$((OLD + 1))
perl -pi -e "s/CURRENT_PROJECT_VERSION = $OLD;/CURRENT_PROJECT_VERSION = $NEW;/g" "$PBX"
CHECK="$(grep -E 'CURRENT_PROJECT_VERSION = [0-9]+;' "$PBX" | sed -E 's/.*= ([0-9]+);.*/\1/' | sort -u)"
[ "$CHECK" = "$NEW" ] || fail "Build number edit didn't apply cleanly (found: $CHECK)."

VERS="$(grep -E 'MARKETING_VERSION = ' "$PBX" | sed -E 's/.*= ([^;]+);.*/\1/' | sort -u)"
[ "$(printf '%s\n' "$VERS" | grep -c .)" -eq 1 ] || fail "Found different Version numbers in the Xcode project ($(echo $VERS)). Fix in Xcode before archiving."
OLDVER="$VERS"

# is_higher A B -> true if version A is higher than version B (e.g. 1.1 > 1.0.1)
is_higher() {
  awk -v a="$1" -v b="$2" 'BEGIN{
    n=split(a,x,"."); m=split(b,y,"."); k=(n>m?n:m)
    for(i=1;i<=k;i++){ xi=(i<=n?x[i]:0)+0; yi=(i<=m?y[i]:0)+0
      if(xi>yi) exit 0; if(xi<yi) exit 1 }
    exit 1 }'
}

echo
echo "Current Version: $OLDVER"
echo "If $OLDVER is already LIVE on the App Store or SUBMITTED for review,"
echo "Apple won't accept it again, so you need a higher Version."
echo "  - Bug fixes only  -> e.g. a.b.c+1   (1.0.1 -> 1.0.2)"
echo "  - New features    -> e.g. a.b+1     (1.0.1 -> 1.1)"
NEWVER=""
TRIES=0
while :; do
  echo
  echo "Type the new Version and press Return,"
  echo "or just press Return to keep $OLDVER (only if $OLDVER has NOT been released or submitted):"
  read -r ans </dev/tty
  if [ -z "$ans" ]; then NEWVER="$OLDVER"; break; fi
  if printf '%s' "$ans" | grep -Eq '^[0-9]+(\.[0-9]+){1,2}$' && is_higher "$ans" "$OLDVER"; then
    NEWVER="$ans"; break
  fi
  echo "'$ans' isn't valid. Use numbers like 1.1 or 1.0.2, higher than $OLDVER."
  TRIES=$((TRIES + 1))
  [ "$TRIES" -lt 3 ] || fail "No valid Version entered. Build number was already raised to $NEW; re-run or set the Version in Xcode."
done
if [ "$NEWVER" != "$OLDVER" ]; then
  perl -pi -e "s/MARKETING_VERSION = \Q$OLDVER\E;/MARKETING_VERSION = $NEWVER;/g" "$PBX"
  VCHECK="$(grep -E 'MARKETING_VERSION = ' "$PBX" | sed -E 's/.*= ([^;]+);.*/\1/' | sort -u)"
  [ "$VCHECK" = "$NEWVER" ] || fail "Version edit didn't apply cleanly (found: $VCHECK)."
fi

echo
echo "**************************************************"
if [ "$NEWVER" != "$OLDVER" ]; then
echo "   Version:  $OLDVER  -->  $NEWVER"
else
echo "   Version:  $NEWVER  (unchanged)"
fi
echo "   Build:    $OLD  -->  $NEW"
echo "**************************************************"
echo
echo "Next, in Xcode (Cmd+Q and reopen it first if it was already open):"
echo "  1. Open ios/App/App.xcodeproj   (or run: npx cap open ios)"
echo "  2. Check General tab shows Version $NEWVER, Build $NEW"
echo "  3. Destination (top bar) = Any iOS Device (arm64)"
echo "  4. Product -> Archive"
echo "  5. Distribute App -> App Store Connect -> Upload"
echo "     (NOT 'TestFlight Internal Only' - that build can't go to the App Store)"
echo
echo "Nothing was committed or pushed."
echo
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "!!!  AFTER YOU ARCHIVE — DON'T SKIP THIS:        !!!"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "  6. Open GitHub Desktop (branch: mobile)"
echo "  7. Commit, e.g. \"Version $NEWVER ($NEW)\""
echo "     (file: ios/App/App.xcodeproj/project.pbxproj)"
echo "  8. Click Push origin"
echo "  Skipping this is how your Mac and GitHub drift apart."
echo
echo "Then, to release it:"
echo "  9. Test the build from TestFlight on your phone"
echo " 10. App Store Connect -> + next to 'iOS App' -> version $NEWVER"
echo "     -> pick Build $NEW, fill in What's New, Submit for Review"
echo "RESULT: SUCCESS"
