# Env-Driven MCP Loading — Expected Results

> Task: সার্ভারে আর কোড বৃদ্ধি করা হবে না। প্রয়োজন অনুযায়ী MCP টুল আলাদা সার্ভার হিসেবে তৈরি করে environment থেকে লোড করা হবে। সার্ভার env-এর লিস্ট পড়ে মেইন MCP (/mcp) এন্ডপয়েন্টে JSON-RPC 2.0 ফরম্যাটে এক্সপোজ করবে যেন এজেন্ট ব্যবহার করতে পারে।
> Date: 2026-08-11 · Agent: Code Guru - Monu

---

## 1. Expected Flow

```
.env (REMOTE_MCP_SERVERS)
    ↓
Server reads env list at startup (parseRemoteMcpServers)
    ↓
Connects to each remote MCP server (JSON-RPC 2.0 over HTTP POST)
    ↓
Discovers tools (initialize + tools/list)
    ↓
Merges into MCP_TOOLS with remote__<server>__<tool> prefix
    ↓
Exposes via main MCP endpoint (/mcp) in JSON-RPC 2.0 format
    ↓
Agents can call remote tools (remote_mcp_call or remote__ prefix)
```

## 2. Expected Results per Test Step

| # | Test Step | Expected Result |
|---|-----------|-----------------|
| 1 | `GET /api/mcp-remote` | `{ok:true, env:"", servers:[], mergedTools:0, totalMcpTools:24}` (before add) |
| 2 | `POST /api/mcp-remote/add` | `{ok:true, server:{status:"connected", tools:[...]}, merged:N}` |
| 3 | `POST /mcp tools/list` | Remote tools appear: `remote__<server>__<tool>` — total = local + remote |
| 4 | `POST /mcp tools/call` | Remote tool executes and returns content |
| 5 | `GET /api/config/mcp` | `{transport:{type:"http",url:".../mcp"}, endpoints:{...}, tools:[...]}` |

## 3. Expected Numbers (with zombie remote server)

| Metric | Expected |
|--------|----------|
| Local MCP tools | 24 |
| Remote tools discovered (zombie) | 48 |
| Merged remote tools | 24 (unique, non-shadowing) |
| Total tools in /mcp tools/list | 72 |
| Remote tool prefix | `remote__zombie__` |

## 4. Expected Env Config

```dotenv
# =============================================================================
# REMOTE MCP SERVERS (env-driven — no code change needed)
# =============================================================================
REMOTE_MCP_SERVERS=[{"url":"http://localhost:3001","name":"facebook-ads"},{"url":"http://localhost:3002","name":"public-api"}]
```

## 5. Expected Agent Usage

- Agent sees `remote__zombie__read_file`, `remote__zombie__write_file`, etc. in tool list
- Agent calls via `remote_mcp_call` tool: `{server:"zombie", tool:"read_file", args:{path:"..."}}`
- OR directly via prefixed tool: `remote__zombie__read_file`

## 6. Success Criteria

- [ ] No new code added to api.js (env-driven only)
- [ ] Remote MCP servers connect via JSON-RPC 2.0
- [ ] Remote tools appear in /mcp tools/list
- [ ] Remote tools callable by agents
- [ ] Test script auto-prints results (JSON)