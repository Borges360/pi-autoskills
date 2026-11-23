# Changelog

## Unreleased

### Open source

- Added `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates; `SECURITY.md` now explains private vulnerability reporting.
- README reorganized with the same sections in English and Brazilian Portuguese.
- `package.json` declares `bugs` and `homepage`.

### Menu

- `/autoskills` (and `/autoskills config` in the TUI) opens a single settings panel built on a vendored Pi settings adapter (`src/vendor/`, hash-verified, no local patches). It opens without running any command.
- **Mode** and **Language** are fields edited as a draft; **Ctrl+S** saves and keeps the panel open, a failed save keeps the draft, and the title shows `*` while there are unsaved changes.
- The read-only actions keep their groups, now shown in the value column: Active (Show selected skills), Suggestions (Explain selection, Detect context), Agents (Agents) and Settings (Doctor). Results are still posted to the chat.
- Esc in a list goes back without applying; with unsaved changes the first Esc warns and the second discards and closes; during an action or a save Esc cancels it. A result that arrives after Esc is not posted.
- Saving mode and language together is all or nothing: if the language cannot be written, the mode goes back. An unconfirmed save is checked against storage (Ctrl+S or "Check storage") instead of being written again.
- The language preview covers the whole panel and reverts when the draft is discarded. In an untrusted project the Language field is locked and shows why, instead of failing on save.
- Ctrl+C is left to Pi; it no longer cancels inside the panel. Below 40×12 the panel asks for a larger terminal.
- Session shutdown or reload closes an open menu and waits for the work it started.

### Packaging

- Peers: `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` `>=1.5.2 <1.7.0` (pi-tui was only transitive); development and tests use `1.6.0`.
- `npm run smoke:host` loads the extension with the locally installed Pi 1.6.0 loader and renders the menu at 40/80/120 columns.
- Removed the unused design-system mark asset and its notice from the package.

## 0.1.2 — 2026-10-14

+Use the shared English mode picker with a current-mode marker, concise descriptions and keyboard navigation.
Use Escape to return through Settings and categories; remove the duplicate Off action from Settings.

## 0.1.1 — 2026-10-13

- Declare host-provided Pi SDK and Typebox packages as peer dependencies, preventing duplicate runtime copies and extension-loader warnings.
- Resolve isolated child-worker modules from the active Pi installation.

## 0.1.0 — 2026-10-13

- Initial independent implementation of pi-autoskills.
- Safe file defaults, optional SQLite/Durable parity, explicit migration, doctor,
  headless commands, public TypeScript APIs and versioned optional events.
- Fault/security tests, pinned Pi loader validation and local benchmark tooling.
- External quality/cost/long-horizon benchmarks remain unmeasured. Not GA.

### Additional validation before publication

- Serialize concurrent startup and preserve objective feedback/next-task context
  across bounded continuation boundaries.
- Reject malformed/failing required JUnit/JSON reports even after exit zero;
  retain uncertain gate intents for explicit review.
- Constrain project-controlled autonomy, exposure and token ceilings.

- User scope: five repositories; embedded longrun gate with existing acceptance-gate integration; paid model benchmarks excluded.
