# Noetic Cotinga

Local-first note taking app built with Angular 21 for GitHub Pages.

## What It Does

- Multi-profile local vaults (no backend account required)
- Single-level collections and rich-text notes (TipTap)
- Pin, archive, and search notes
- JSON export scopes:
  - single note
  - single collection (with notes)
  - full profile
  - all profiles
- JSON import with merge and conflict-resolution modal
- Optional per-profile encryption lock (AES-GCM + PBKDF2 via Web Crypto)
- PWA installability (Android/desktop)
- Self-hosted typography stack (OFL-licensed)

## Local Development

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Build

```bash
npm run build
```

## Test

```bash
npm test -- --watch=false
```

## GitHub Pages Deployment

This repo includes `.github/workflows/deploy-pages.yml`.

- Push to `main` to trigger automatic deployment.
- The workflow runs:
  1. `npm ci`
  2. `npm run build:pages`
  3. Upload `dist/noetic-cotinga/browser` to GitHub Pages

If the repository name changes, update the base href in `package.json` (`build:pages` script).

## Data and Security Notes

- All data is stored in browser `localStorage`.
- Cross-device transfer is manual via exported JSON files.
- Encryption passphrases are kept only in runtime memory and are cleared on refresh/close.

## Font Licensing

- See [docs/FONT_LICENSES.md](docs/FONT_LICENSES.md) for font package attribution and SIL OFL details.
