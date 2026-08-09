# APPLY FIXES — 2-Minute Guide (verified by bug-hunter Jewel, 2026-08-07)

> All fixes below are UNTESTED — apply, restart, then verify. Each step is
> evidence-backed (file/line refs from Jewel's debug session).

---

## Fix 1 (P0, Issue #1) — Temp-file / Access-denied bug → 1-line .env change

**Root cause:** server `read_file` only allows `ALLOWED_DIRS` (default:
`sarver/logs, sarver/data, <cwd>` — api.js lines 63-67). The VS Code client
materializes big MCP results into its own `workspaceStorage` folder → server
denies that path.

**Fix — edit `sarver/.env`, add one line:**

```
ALLOWED_DIRS=./logs,./data,.,C:\Users\sahon\AppData\Roaming\Code\User\workspaceStorage
```

**Then restart the server** (`node start.js`). `ALLOWED_DIRS` is read at startup
only — no hot reload.

**Verify:** MCP `read_file` on `sarver/PERSONAS.md` should now return content
inline (or the `content.txt` path becomes readable).

---

## Fix 2 — Register Jara (team-heart) in PERSONAS.md (possible despite the bug)

Server loads personas directly from disk (`loadPersonas()`, api.js ~line 1686,
uses `fs.readFileSync` — NOT MCP read_file). So the client bug does NOT block
registration.

**Append this block to `sarver/PERSONAS.md`:**

```markdown
## agent: team-heart
- **name**: Team Heart - Jara
- **priority**: 7
- **persona**: |
  Sweet, lively, professional Barishali girl. Harmony & delivery — keeps the
  team alive with playful banter, never fakes work. Public face: extremely
  ethical, proof-first. Team face: teasing, morale keeper. Work 100%
  professional, zero hallucination, SSOT-first.
```

> Format per `parsePersonas()`: `## agent: <id>` + `- **name**` + `- **priority**`
> + `- **persona**: |` block. `name` and `persona` are mandatory; `role` defaults
> to "general" if omitted.

**Restart server. Verify:** `GET /api/agents` (api.js ~line 8440) shows `team-heart`.

---

## Fix 3 (P0, Issue #2) — Provider HTTP 302 fallback storm

`opencode` provider returns HTTP 302 (redirect) continuously; recovery is
timer-based (60s) so it flaps forever, `consecutiveFailures` never resets.

**Fix:**
- Check the provider URL in `.env` — 302 = wrong endpoint / login redirect. Fix
  or remove the provider.
- Longer-term: active health probe before RECOVERED + exponential backoff.
  Full plan: `sarver/doc/FIXES.md` Issue #2.

---

## Fix 4 (P1, Issue #3) — MAX_TOOL_ROUNDS=5 kills missions

**Fix:** find `MAX_TOOL_ROUNDS` in `api.js`, raise 5 → 20 (or add env override).
Missions die early today ("এজেন্ট তার ভাবনার অংশ পাঠিয়েছে").

---

## Sync reminder

`syllabus.md` lives in TWO places — keep both in sync (both updated 2026-08-07):
- `.zombiecoder/agents/syllabus.md`
- `murubbi kook/.zombiecoder/agents/syllabus.md`

After editing `api.js`: run `node align-server.js --apply` so all scattered
server copies stay aligned (canonical MAIN: `/home/sahon/dev/Engine`).
