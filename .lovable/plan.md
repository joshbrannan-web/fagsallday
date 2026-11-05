# Add the iOS app address to allowed sign-in return addresses

I can't edit the Redirect URLs list myself. Only you can change it, and it takes about a minute.

## Steps for you
1. In Lovable, open **More → Users → Auth settings → Advanced**.
2. Under **Redirect URLs**, add: `capacitor://localhost/**`
   - The `/**` at the end makes it match every page inside the app, not just the home screen. If you only want the exact address, enter `capacitor://localhost/`.
3. Save. Leave **Site URL** as it is and keep every existing entry.

## Things to know
- Lovable keeps your own entries when it updates this list automatically. It only removes extra addresses on Lovable's own domains, so this entry won't be removed.
- The list holds up to 50 entries, and Lovable's own entries count toward that limit.

## After you save (optional, I can do this)
- Read the settings back to confirm the new address is listed and the Site URL didn't change.
- Check that the app builds password-reset and sign-up links from the current app address rather than a fixed website address, so links opened in the iOS app return to the app.
