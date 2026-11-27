# Third-party code in `src/vendor/`

## `inteiro-terminal/`

- Origin: `@inteiro/terminal` (Pi adapter closure of `pi.ts`), from the IDS repository
  (`packages/terminal/src`). Version, contract, source commit, date and the sha256 of every
  file are recorded in `inteiro-terminal/VENDOR.json`.
- License: MIT, copied verbatim in `inteiro-terminal/LICENSE`.
- Local patches: none (`"patches": []`). Do not edit these files by hand; regenerate them from
  the IDS checkout with `node scripts/vendor-terminal.mjs --out <this dir>/inteiro-terminal --format ts`.
- Integrity: `node src/vendor/inteiro-terminal/verify-vendor.mjs` (also run by
  `tests/vendor.test.mjs`, which does not need an IDS checkout).
- Only the panel/state code is used. No design-system tokens, palette, mark or slogan are
  included; the panel paints with the Pi host theme.
