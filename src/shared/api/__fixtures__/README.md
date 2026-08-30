# Captured fixtures

MSW fixtures are **captured from the real API**, never handwritten, so mocks cannot
drift from the contract silently (PLAN §4.5).

```bash
npm run api:fixtures              # seed a temp store, serve it, capture, stop
npm run api:fixtures -- --types   # …and regenerate ../generated.ts from the same server
```

`scripts/capture-fixtures.py` (Python, not TS — it imports the fixture ids from
`tests.api.fixtures.seed_store` in the backend repo rather than retyping them)
seeds a throwaway state dir, serves `orchestrator.api.app:app` on port 8789 with
`ORCH_PROJECT=example ORCH_SKIP_LOCAL_CONFIG=1`, captures one file per endpoint
plus one per error envelope, and shuts the server down. It never touches a real
project's state.

Two notes before you read a value here:

- The temp state dir is rewritten to the literal `/tmp/as-fixture` placeholder in
  `store_path` and the 409 `detail`, so re-capturing does not churn the diff.
- These files are **excluded from Biome** (`biome.json`) — they are generated
  artifacts and must stay byte-identical to the server response.

The file-by-file index, the error-code table, and the `null`-not-zero /
`Candidates.source` / `Events.next_since_rowid` conventions live in
`devdocs/CONTRACT.md`.
