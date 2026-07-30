# Captured fixtures

MSW fixtures are **captured from the real API**, never handwritten, so mocks cannot
drift from the contract silently (PLAN §4.5). `scripts/capture-fixtures.ts` hits a
live dev server pointed at a fixture store and writes `*.json` here.

The API has no read endpoints until phase 1, so this directory is empty for now.
