# Mission Barisal v3 — Verified Issues & Fix Plan

> Evidence-driven fix documentation. Every issue below was verified by reading
> actual files / terminal logs in workspace `c:\Users\sahon\orebab\2`.
> Status: **documented — not yet applied** (api.js is 98KB and currently unreadable
> via MCP read_file due to Issue #1, so blind patching is unsafe).

---

## Issue #1 (P0) — Large tool results written outside allowed dirs → Access denied

**Evidence (verified):**
- `read_file sarver/api.js` (98KB) → `Large tool result (98KB) written to file` at
  `c:\Users\sahon\AppData\Roaming\Code\User\workspaceStorage\...\GitHub.copilot-chat\chat-session-resources\...\content.txt`
- Reading that path → `Access denied: path is outside allowed directories. Working dir: c:\Users\sahon\orebab\2`
- Same loop hit for: `SERVER-LOGIC.md` (9KB), `Unified-Socket-Architecture.md` (40KB),
  `PERSONAS.md` (9KB), `data/locks/2026-08-07.json` (15KB), `domain-config.js` (8KB), `note-store.js` (12KB)

**Root cause:** The VS Code client materializes large MCP results into its own
`workspaceStorage/.../chat-session-resources/` folder, but the MCP server's
`read_file` only allows paths under the project working dir.
**This is a client/server policy mismatch, not a server self-sabotage.**

**Fix options:**
- **A (recommended):** Add the client's `chat-session-resources` path (or the whole
  `workspaceStorage` for this workspace) to the server's allowed-directories list.
- **B:** Configure the client to materialize large results inside the workspace
  (e.g. `.missionbarisal/tmp/`).
- **C:** Raise the inline-result size threshold so fewer results spill to disk.

---

## Issue #2 (P0) — Provider fallback storm (HTTP 302 loop)

**Evidence (from terminal log):**
- `[PROVIDER_FALLBACK] {"from":"opencode","to":"custom_1","error":"HTTP 302","code":302}` — repeated continuously
- `[PROVIDER_UNHEALTHY] {"consecutiveFailures":78 ... cooldownMs:60000}` climbing to `131`
- `[PROVIDER_RECOVERED] {"provider":"opencode","downTimeMs":60002}` → next request fails again with 302

**Root cause:**
1. Recovery is **timer-based** (60s cooldown expiry), not **probe-based**.
2. HTTP 302 is a **permanent** config error (redirect — wrong URL/login page), not transient.
3. `consecutiveFailures` is **never reset**, so the provider stays stuck in the loop.

**Fix:**
- Active health probe (lightweight request) before declaring `RECOVERED`.
- Treat 302/401/403 as permanent → disable provider until config changes.
- Reset failure counter on successful probe.
- Exponential backoff: 60s → 2m → 4m (circuit-breaker pattern).

---

## Issue #3 (P1) — MAX_TOOL_ROUNDS=5 kills missions early

**Evidence:** `[MAX_TOOL_ROUNDS_EXCEEDED] {"max":5}` after only a few `read_file` calls;
missions return `এজেন্ট তার ভাবনার অংশ পাঠিয়েছে` (partial result).

**Fix:** Raise to 12–20, or make it configurable per agent / per mission.

---

## Issue #4 (P2) — `cache/` folder is empty

**Evidence:** `sarver/cache/` contains zero files.

**Fix:** Either implement the caching layer or remove the folder (dead code smell).

---

## Issue #5 (P2) — Provider fallback log noise

**Evidence:** ~95% of the log is the same repeated `PROVIDER_FALLBACK` /
`PROVIDER_UNHEALTHY` lines.

**Fix:** Log once per provider **state transition**, not per request.

---

## Applying the fixes

The fixes touch `sarver/api.js` (agent registry, provider health logic, tool-round
limit, allowed-dirs). Because `api.js` cannot currently be read through MCP
(Issue #1), apply fixes via one of:

1. Fix Issue #1 first → then re-read `api.js` → patch precisely.
2. Paste the relevant `api.js` sections into chat → get exact patch snippets.
3. Edit `api.js` directly in the editor, using this doc as the change list.

> **Alignment note:** after editing, run `node align-server.js --apply` so every
> scattered server copy stays in sync (canonical MAIN: `/home/sahon/dev/Engine`).
