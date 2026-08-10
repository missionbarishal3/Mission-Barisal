# Mission Barisal — Implementation Plan: DB Agents + Users/Sessions + Tools + MCP Connector

> **Status:** APPROVED by user (Sahon/Shawon Bhai) — 2026-08-10
> **Scope:** 4 phases, all in `s/api.js` + `s/data/models.db`
> **This document is the "thread" (খেই)** — it maps WHERE code lives, WHAT changes, and WHAT the expected result is. Update it whenever a phase lands.

---

## 🎯 The Plan (user's words, summarized)

1. **Agents → Database** (`agents` table) — with **PERSONAS.md fallback 100% kept**
   - Load order: `DB → .zombiecoder/agents/*.md → PERSONAS.md`
   - Admin CRUD so agents can be added/edited without redeploy
2. **users + sessions tables (MINIMAL)** — for external business projects (5 clients × 5 systems) to connect via API
   - `users(id, name, api_key_sha256, enabled)` + `sessions(id, user_id, token, created_at, expires_at)`
   - One dedicated verify API endpoint
3. **Tools on EVERY input endpoint** — chat, chat-completion, mission, execution
   - MCP_TOOLS already OpenAI-standard (description/params/required) — just ensure forwarding everywhere
4. **MCP Connector (outbound MCP CLIENT)** — connect to external MCP servers, agents get their tools
   - Env-driven + admin-driven registration; namespaced tool names; timeout + allowlist + TTL

---

## 🗺️ CURRENT CODE MAP (evidence — s/api.js)

| Concern | Location | What's there today |
|---------|----------|--------------------|
| Models DB init | `s/api.js:830-880` (`initModelsDb`) | `models` table only (68 rows) — id/provider/name/api_model/provider_name/type/priority/updated_at. `MODELS_DB` global at 823 |
| Persona loading | `s/api.js:2497` (`loadPersonas`) | Reads `PERSONAS.md` (2502, `## agent:` format) + `.zombiecoder/agents/*.md` (2531, YAML frontmatter, overrides same-id). Returns merged array. GIT_PERSONAS_URL download fallback at 2580+ |
| Agents global | `s/api.js:10293` (`let AGENTS = []`), set at 13672 | `AGENTS = await loadPersonas()` at startup |
| DEFAULT_AGENTS fallback | `s/api.js:2680` | Minimal fallback if loadPersonas returns empty |
| Sessions (in-memory) | `s/api.js:3328-3330` | `activeSessions`, `clientSessions`, `sessionDirs` Maps + `s/data/` disk dirs |
| Session verify (remote) | `s/api.js:2747` (`verifySessionWithDomain`) | Verifies token against a remote domain via `X-Verify-Token` |
| MCP_TOOLS (built-in) | `s/api.js:7965` | Static object, 10 tools, OpenAI-standard schema (description/params/required) |
| EXTERNAL_TOOLS (mini connector) | `s/api.js:8209` (`loadExternalTools`) | Env-driven HTTP tools: `EXTERNAL_TOOL_N_NAME/_URL/_KEY/_METHOD/_PARAMS` → merged into MCP_TOOLS at 8240. HTTP-only, no MCP protocol |
| MCP server (inbound) | `s/api.js:9114+` | `/mcp` JSON-RPC 2.0: initialize (9123), tools/list (9342), tools/call (9363). UDS socket server 9433-9501 |
| MCP clients tracking | `s/api.js:10306` (`mcpClients` Map) | Tracks clients that connect TO our server (VS Code etc.) |
| Tools in model call | `s/api.js:4941` (`callModelWithTools`) | Execution loop with tool calls. Tools passed at 4399/4558 (`if (tools) reqBody.tools = tools`) |
| Tools description in prompts | `s/api.js:1981` (`buildToolsDescription`) | Builds markdown tools list for system prompts |
| /v1/chat/completions | `s/api.js:12011-12045` | `let tools = parsed.tools || undefined` (12033); MAX_TOOLS_LIMIT=40 cap (12045) — tools come from client request |
| Mission endpoint | `s/api.js:5414` + `callModelWithTools` | Mission mode calls models with tools |

**GAP analysis:**
- ❌ No `agents` table → personas are file-only (PERSONAS.md + custom .md)
- ❌ No `users`/`sessions` tables → sessions are in-memory only, no API-key auth
- ❌ No outbound MCP client → server only SERVES MCP, never CONNECTS to external MCP servers
- ⚠️ Tools on endpoints → client-supplied only (`parsed.tools`), NOT auto-attached from MCP_TOOLS everywhere

---

## 🔧 PHASE A — Agents table + DB-first persona loading

**Files:** `s/api.js` (initModelsDb ~830, loadPersonas ~2497), `s/data/models.db`

**Changes:**
1. In `initModelsDb()`: add 3 tables (agents + users + sessions together — Phase A creates `agents`, Phase B adds `users`/`sessions`):
   ```sql
   CREATE TABLE IF NOT EXISTS agents (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     role TEXT,
     model TEXT,
     expertise TEXT,
     persona_text TEXT NOT NULL,
     enabled INTEGER DEFAULT 1,
     priority INTEGER DEFAULT 99,
     updated_at INTEGER DEFAULT 0
   );
   ```
2. `loadPersonas()` new load order:
   - **DB first**: read all enabled agents from `agents` table → map to `{id, name, role, model, expertise, persona_text}` (persona_text = the full persona markdown)
   - **Then custom .md files** (`.zombiecoder/agents/*.md`) override same-id DB rows (as today they override PERSONAS.md)
   - **Then PERSONAS.md** for ids not present in DB (fallback — 100% kept)
3. **Seed function** `seedAgentsFromPersonas()`: on startup, if `agents` table is empty, INSERT all agents parsed from PERSONAS.md. This makes first-run identical to today's behavior.
4. **Admin CRUD endpoints** (protected by ADMIN_TOKEN env or api key):
   - `GET /api/admin/agents` — list
   - `POST /api/admin/agents` — create/update (upsert by id)
   - `DELETE /api/admin/agents/:id` — disable/delete
   - Each write: `refreshAgents()` → re-runs loadPersonas() into `AGENTS` global (no restart needed)

**Expected result:**
- `/v1/models` lists DB agents + PERSONAS.md fallback agents
- Adding an agent via `POST /api/admin/agents` → appears in `/v1/models` immediately, no redeploy
- PERSONAS.md still fully functional as fallback (user requirement: 100% kept)

---

## 🔧 PHASE B — users + sessions tables + API auth

**Files:** `s/api.js` (initModelsDb, verifySessionWithDomain ~2747, new auth handlers), `s/data/models.db`

**Changes:**
1. Tables:
   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     api_key TEXT NOT NULL UNIQUE,   -- sha256 hex hash at rest
     enabled INTEGER DEFAULT 1,
     created_at INTEGER DEFAULT 0
   );
   CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY,            -- session id
     user_id INTEGER NOT NULL REFERENCES users(id),
     token TEXT NOT NULL,            -- bearer token
     created_at INTEGER DEFAULT 0,
     expires_at INTEGER DEFAULT 0
   );
   ```
2. **Seed**: `ADMIN_USER` / `ADMIN_API_KEY` env vars → upsert a default admin user on startup (hash the key with sha256).
3. **Auth endpoints:**
   - `POST /api/auth/verify` — body `{api_key}` → returns `{valid, user, session_token, expires_at}` + creates a session row
   - `POST /api/auth/session` — body `{session_token}` → validates session (exists + not expired)
   - `POST /api/auth/logout` — body `{session_token}` → deletes session
4. **Middleware hook**: `/v1/chat/completions` + `/api/mission` accept optional `Authorization: Bearer <session_token>` or `X-API-Key: <api_key>`; if provided → verify against DB (fallback to current domain-verify + anonymous behavior when absent, so nothing breaks).

**Expected result:**
- External projects (5 clients) can call `POST /api/auth/verify` with their api_key → get a session token → use it on chat/mission endpoints
- Sessions survive server restarts (DB-backed, not just in-memory)
- Existing anonymous/local usage keeps working (auth is additive)

---

## 🔧 PHASE C — Tools on every input endpoint

**Files:** `s/api.js` (chat/completions ~12033, mission ~5414, callModelWithTools ~4941)

**Changes:**
1. **Auto-attach default tools**: if a request has NO `tools` array, inject the built-in `MCP_TOOLS` (converted to array) — so every endpoint always offers tools:
   ```js
   if (!tools) tools = Object.entries(MCP_TOOLS).map(([n, t]) => ({ type: "function", function: { name: n, description: t.description, parameters: t.params } }));
   ```
   (still respect MAX_TOOLS_LIMIT=40 cap)
2. Mission mode (`/api/mission`, mission debate loop ~5414): ensure `allowedTools`/tools flow into every agent call in the debate.
3. `/v1/chat/completions` stream + non-stream branches: verify both pass tools (4399/4558 already do `if (tools) reqBody.tools = tools`).

**Expected result:**
- Any client hitting any endpoint gets tool capability even without sending tools
- Mission mode agents can use tools during debate
- OpenAI-standard format preserved → clients using OpenAI SDKs work unchanged

---

## 🔧 PHASE D — MCP Connector (outbound MCP client)

**Files:** `s/api.js` (new `MCP_CONNECTORS` section near EXTERNAL_TOOLS ~8209), admin handlers

**Changes:**
1. **Env-driven connectors** (mirror EXTERNAL_TOOLS pattern):
   ```
   MCP_CONNECTOR_1_NAME=github
   MCP_CONNECTOR_1_URL=https://api.githubcopilot.com/mcp/   (or any MCP endpoint)
   MCP_CONNECTOR_1_HEADERS={"Authorization":"Bearer xyz"}
   MCP_CONNECTOR_1_TIMEOUT=10000
   ```
2. **MCP client logic** (zero-dependency, native http/https):
   - `mcpInitialize(url, headers, timeout)` → POST `{jsonrpc:"2.0", id:1, method:"initialize", params:{protocolVersion:"2024-11-05", capabilities:{}, clientInfo:{name:"mission-barisal", version:"3.x"}}}` → returns server info
   - `mcpListTools(url, headers, timeout)` → POST `tools/list` → array of tool defs
   - `mcpCallTool(url, headers, name, args)` → POST `tools/call` → result
3. **Registration**: each discovered tool → `MCP_TOOLS["mcp__<connector>__<toolName>"]` (namespaced, collision-free) + entry in an internal `MCP_CONNECTOR_TOOLS` map (name → {connector, url, headers, timeout, schema}).
4. **Tool execution**: extend the MCP_TOOLS dispatch (where built-in tools execute) — if tool name starts with `mcp__`, route to `mcpCallTool`.
5. **Admin endpoints**:
   - `GET /api/admin/mcp-connectors` — list
   - `POST /api/admin/mcp-connectors` — body `{name, url, headers, timeout}` → connect + register tools live
   - `DELETE /api/admin/mcp-connectors/:name` — remove + unregister tools
6. **Safety**: URL allowlist (http/https only), timeout per call, `tools/list` cached with TTL (e.g., 60s) + health-check on failure; a dead connector never blocks agent calls (try/catch → tool returns error message instead of throwing).

**Expected result:**
- Set `MCP_CONNECTOR_1_*` env or POST to admin → external MCP tools appear in agents' toolset
- Tool names namespaced (`mcp__<connector>__<tool>`) → no collisions between connectors
- Adding a new capability = adding a connector, NO main server code changes (user's key requirement)

---

## 🧪 TEST PLAN

### Engineer tests (before/after each phase)
```bash
node --check s/api.js                          # syntax
node -e "..."                                  # DB schema inspect (tables exist, seeded)
node s/api.js &                                # server starts clean
curl localhost:5000/health                     # healthy
```

### User tests (mandatory — as a user)
```bash
# Phase A
curl localhost:5000/v1/models                   # agents listed
curl -X POST localhost:5000/api/admin/agents ...  # add agent → shows in /v1/models

# Phase B
curl -X POST localhost:5000/api/auth/verify -d '{"api_key":"..."}'   # session token
curl -X POST localhost:5000/v1/chat/completions -H "Authorization: Bearer <token>" ...

# Phase C
curl -X POST localhost:5000/v1/chat/completions -d '{"model":"code-guru","messages":[...]}'  # no tools sent → server auto-attaches

# Phase D
curl localhost:5000/api/admin/mcp-connectors    # list connectors
# set MCP_CONNECTOR_1_* env → restart → tool present in /v1/models or MCP tools/list
```

---

## ✅ Definition of Done
1. `agents`, `users`, `sessions` tables exist in models.db
2. `/v1/models` shows DB agents + PERSONAS.md fallback (PERSONAS.md NEVER removed)
3. API-key auth works for external projects; old anonymous flow still works
4. All input endpoints auto-attach tools
5. MCP connector registers external tools live; namespaced; dead connectors don't block
6. All tests above pass (engineer + user)

---

*Generated by Code Guru - Monu · Mission Barisal v3 · Evidence-Driven, Proof-First*
