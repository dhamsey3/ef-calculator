# Notes for Claude

## Commits

- Author commits as the repo owner: `precision <robinvp3@gmail.com>`
  (`git config user.name "precision" && git config user.email "robinvp3@gmail.com"`).
- Do not add Claude as co-author or add any Claude attribution
  (no `Co-Authored-By`, no `Claude-Session` lines) to commits or PR descriptions.

## Project

- React 18 + Vite + Recharts; deployed to GitHub Pages from `master`
  (`vite.config.js` sets `base: '/ef-calculator/'`).
- Pure logic (EF classification, CSV parsing, example data) lives in `src/ef.js`;
  UI in `src/EFCalculator.jsx`.
- No built-in crustal reference values by design — see README. The example
  dataset uses clearly labelled illustrative numbers only.
- Check changes with `npm run build`.
