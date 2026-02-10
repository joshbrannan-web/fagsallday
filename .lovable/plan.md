

## Add PWA Home Screen Icons

### What We'll Do
Use the uploaded logo image as the app's home screen icon by copying it into the project and updating the manifest.

### Steps

1. **Copy the uploaded image** to `public/icon-512.png` (it will serve as the base icon)
2. **Copy it again** to `public/icon-192.png` (browsers will downscale automatically from a larger image, so using the same file at both sizes works fine)
3. **Update `public/manifest.json`** to reference the new PNG icons instead of `favicon.ico`:
   - 192x192 icon with `purpose: "any maskable"`
   - 512x512 icon with `purpose: "any maskable"`
4. **Update `index.html`** to add an `apple-touch-icon` link pointing to the 192px icon (improves iOS home screen appearance)

### Technical Details

**manifest.json icon entries:**
```json
"icons": [
  {
    "src": "/icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "/icon-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

**index.html addition:**
```html
<link rel="apple-touch-icon" href="/icon-192.png">
```

### Result
When users "Add to Home Screen" on Android or iOS, they will see this golf superheroes logo as the app icon instead of the low-quality favicon.
