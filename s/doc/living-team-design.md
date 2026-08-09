# Living Team Environment — Design & Wiring Plan

> Goal: while the user watches the agents work, the experience must feel
> **ALIVE** — periodic progress notes, playful banter between agents, light
> teasing — WITHOUT ever faking work or altering results.
>
> **Rule of the house:** 100% professional work + 100% enjoyable watching.
> The banter is presentation only. Tool results, decisions, and outputs are
> never touched by the fun layer.

## Where it hooks in (`sarver/api.js` streaming layer)

The gateway already streams agent "thinking" fragments
(`এজেন্ট তার ভাবনার অংশ পাঠিয়েছে`). We extend that stream:

1. **status events** — when an agent starts/finishes a tool call, the gateway
   emits a `status` SSE event: `{ type: "tool_start" | "tool_done" | "thinking", agent, at }`.
2. **banter layer** — a picker module reads `data/banter.json`, picks a random
   line for the event type, interpolates `{agent}`/`{teaser}`/`{worker}`, and
   appends it as `{ type: "banter", text }`.
3. **tease scheduling** — when an agent finishes a tool round, pick another
   agent as `{teaser}` and a playful line — "যেই কাজ করবে, আর একজন একটু বদনাম করবে".
4. **throttle** — max 1 banter per 3 tool calls (or per 10s) so it never spams.

## New module: `sarver/banter.js` (zero-dependency)

```js
// banter.js — Living Team Environment picker (presentation only)
const fs = require("fs");
const path = require("path");

let cache = null;
function load() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "banter.json"), "utf8"));
  }
  return cache;
}

function pick(type, vars = {}) {
  if (process.env.LIVING_TEAM === "0") return null;
  const pool = load()[type] || [];
  if (!pool.length) return null;
  const tpl = pool[Math.floor(Math.random() * pool.length)];
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

module.exports = { pick };
```

## Wiring sketch (merge into api.js streaming path when readable)

```js
const banter = require("./banter.js");

// inside the per-agent tool loop, after each tool result:
toolRounds[agent] = (toolRounds[agent] || 0) + 1;
if (toolRounds[agent] % 3 === 0) {
  const teammates = agents.filter((a) => a.id !== agent);
  const teaser = teammates[Math.floor(Math.random() * teammates.length)].id;
  const text = banter.pick("tease", { worker: agent, teaser });
  if (text) stream.emit("banter", { agent, text, at: Date.now() });
} else {
  const text = banter.pick("tool_done", { agent });
  if (text) stream.emit("banter", { agent, text, at: Date.now() });
}

// on mission start:
stream.emit("banter", { agent: "team-heart", text: banter.pick("tool_start", { agent: "টিম" }) });
```

## Rules (non-negotiable)

- Banter NEVER changes tool output, results, or decisions.
- Banter NEVER leaks secrets, API keys, or real error internals.
- Provider IDs stay internal — banter lines never name them.
- User can disable anytime: `LIVING_TEAM=0`.
- Jara (team-heart) is the designated banter coordinator when present.

## Status

- [x] `data/banter.json` — banter pack ready (event-keyed)
- [x] `doc/agent-jara.md` — agent spec final (name: Jara)
- [ ] Wire into `api.js` — blocked by Issue #1 (api.js unreadable via MCP)
- [ ] Optional: `LIVING_TEAM` env flag in start.js
