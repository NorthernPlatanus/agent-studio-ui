#!/usr/bin/env python3
"""Capture `src/shared/api/__fixtures__/*.json` from a real API server.

MSW mocks must not be handwritten (PLAN §4.5): every fixture in this repo is a
byte-for-byte capture of a real FastAPI response served over the seeded fixture
store. Ids and run ids are imported from `tests.api.fixtures.seed_store` in the
backend repo, so renaming a fixture id breaks this script loudly instead of
leaving a stale mock behind.

Usage (from the repo root):

    python3 scripts/capture-fixtures.py            # seed, serve, capture, stop
    python3 scripts/capture-fixtures.py --types     # also regenerate generated.ts

The backend repo location can be overridden with ORCH_REPO. Port 8789 is this
lane's port (see DEVDOCS/START-HERE.md §6) so it never collides with the dev
server (8787) or studio-verify (8788).

This is the only sanctioned capture path: it points the API at a throwaway state
dir and never at `state/demo-project.*`.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ORCH_REPO = Path(os.environ.get("ORCH_REPO", REPO.parent / "agent-studio"))
PYTHON = ORCH_REPO / ".venv" / "bin" / "python"
PORT = 8789
BASE = f"http://127.0.0.1:{PORT}"
OUT = REPO / "src" / "shared" / "api" / "__fixtures__"

# Absolute paths appear in `store_path` / 409 details. The temp state dir differs
# every run, so it is rewritten to the documented placeholder to keep the
# committed fixtures stable.
PLACEHOLDER = "/tmp/as-fixture"

# `seed_store` imports langgraph, so this script must run under the backend venv.
# Re-exec rather than fail, so `npm run api:fixtures` works from any interpreter.
# Compare sys.prefix, not sys.executable: `.venv/bin/python` is a symlink to the
# same interpreter as `/usr/bin/python3`, so resolved paths compare equal while the
# site-packages differ.
if Path(sys.prefix).resolve() != (ORCH_REPO / ".venv").resolve() and PYTHON.exists():
    os.execv(str(PYTHON), [str(PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]])

sys.path.insert(0, str(ORCH_REPO))
from tests.api.fixtures.seed_store import (  # noqa: E402
    CHECKPOINT_TASK,
    PROJECT,
    RUN_DONE,
    RUN_PAUSED,
)

P = f"/api/projects/{PROJECT}"

# One entry per endpoint in the OpenAPI surface, plus one per error envelope the
# UI has to render. Keep in sync with DEVDOCS/CONTRACT.md.
TARGETS: list[tuple[str, str]] = [
    ("healthz", "/healthz"),
    ("projects", "/api/projects"),
    ("summary", f"{P}/summary"),
    ("waves", f"{P}/waves"),
    ("tasks", f"{P}/tasks"),
    ("task-detail", f"{P}/tasks/T-131"),
    ("candidates", f"{P}/tasks/{CHECKPOINT_TASK}/candidates"),
    ("runs", f"{P}/runs"),
    ("run-detail", f"{P}/runs/{RUN_DONE}"),
    ("run-detail-paused", f"{P}/runs/{RUN_PAUSED}"),
    ("usage-by-role", f"{P}/usage?group_by=role"),
    ("usage-by-day", f"{P}/usage?group_by=day"),
    ("metrics", f"{P}/metrics"),
    ("events", f"{P}/events?limit=50"),
    ("jobs", f"{P}/jobs"),
    # The idle planner chat: no session, plus the options the settings panel
    # renders its dropdowns from. A live session cannot be captured — starting one
    # calls the planner for real.
    ("discuss-idle", f"{P}/discuss"),
    ("error-404-project", "/api/projects/nope/summary"),
    ("error-409-no-store", "/api/projects/demo-project/summary"),
    ("error-404-task", f"{P}/tasks/T-999"),
    ("error-404-job", f"{P}/jobs/j-unknown"),
    ("error-422-usage", f"{P}/usage?group_by=bogus"),
]


def scrub(obj: object, state_dir: str) -> object:
    if isinstance(obj, str):
        return obj.replace(state_dir, PLACEHOLDER)
    if isinstance(obj, list):
        return [scrub(x, state_dir) for x in obj]
    if isinstance(obj, dict):
        return {k: scrub(v, state_dir) for k, v in obj.items()}
    return obj


def fetch(url: str) -> tuple[int, object]:
    try:
        with urllib.request.urlopen(url) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def port_is_free() -> bool:
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", PORT))
        except OSError:
            return False
    return True


def main() -> int:
    if not PYTHON.exists():
        print(f"no venv at {PYTHON}; set ORCH_REPO", file=sys.stderr)
        return 2
    # A server already on 8789 would answer /healthz, our own uvicorn would fail to
    # bind unnoticed, and we would capture someone else's state dir — fixtures that
    # look right and are not. Refuse instead.
    if not port_is_free():
        print(f"port {PORT} is already in use — stop that server first; "
              "capturing from it would record the wrong state dir", file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory(prefix="as-fixture-") as tmp:
        subprocess.run([str(PYTHON), "-m", "tests.api.fixtures.seed_store", tmp],
                       cwd=ORCH_REPO, check=True)
        # ORCH_SKIP_LOCAL_CONFIG: without it the operator's untracked
        # `config/local.yaml` leaks into the capture (it sets a global
        # `project.repo_path`, which makes `example` look runnable and bakes a
        # machine-specific path into a committed fixture). Tests skip it for the
        # same reason.
        env = {**os.environ, "ORCH_PROJECT": PROJECT, "ORCH_PATHS_STATE_DIR": tmp,
               "ORCH_SKIP_LOCAL_CONFIG": "1"}
        server = subprocess.Popen(
            [str(PYTHON), "-m", "uvicorn", "orchestrator.api.app:app",
             "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=ORCH_REPO, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        try:
            for _ in range(60):
                try:
                    if fetch(f"{BASE}/healthz")[0] == 200:
                        break
                except OSError:
                    time.sleep(0.25)
            else:
                print("server never became healthy", file=sys.stderr)
                return 1

            OUT.mkdir(parents=True, exist_ok=True)
            for stem, path in TARGETS:
                status, body = fetch(BASE + path)
                (OUT / f"{stem}.json").write_text(
                    json.dumps(scrub(body, tmp), indent=2) + "\n")
                print(f"{status} {path} -> __fixtures__/{stem}.json")

            if "--types" in sys.argv:
                subprocess.run(
                    ["npx", "openapi-typescript", f"{BASE}/openapi.json",
                     "-o", "src/shared/api/generated.ts"],
                    cwd=REPO, check=True,
                    env={**os.environ,
                         "npm_config_cache": str(ORCH_REPO / "state" / "npm-cache")})
        finally:
            server.terminate()
            server.wait(timeout=10)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
