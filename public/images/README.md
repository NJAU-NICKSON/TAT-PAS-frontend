# Public Images

Drop images here that you want to reference by a **fixed URL path**.

A file at `public/images/scion-logo.png` is served at the URL `/images/scion-logo.png`.

## How to use

In JSX (path is relative to the site root, always starts with `/images/`):

```tsx
<img src="/images/scion-logo.png" alt="Scion Hospital" />
```

In CSS:

```css
background-image: url('/images/banner.jpg');
```

In the print letterhead (`src/lib/print.ts`) you can also use an absolute URL like
`${window.location.origin}/images/scion-logo.png`.

## When to use this folder vs `src/assets/images`

- **public/images** — logos, letterheads, favicons, anything referenced by a stable
  path or by URL string. Files are served as-is (no processing/hashing).
- **src/assets/images** — images you `import` into a component. Vite optimizes and
  fingerprints these for production caching.

## Notes

- Supported formats: `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`.
- Keep file names lowercase with hyphens, e.g. `consultation-room.jpg`.
- This folder is committed to git; the `.gitkeep` keeps it tracked even when empty.
