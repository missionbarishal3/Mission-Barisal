# Mission Barisal — Server Logic Reference (সার্ভারের সঠিক নিয়ম)

> **এই ডকুমেন্টই সার্ভারের একমাত্র সত্য (Single Source of Truth)।**
> যেকোনো সার্ভার কোড পরিবর্তনের আগে এটা পড়ুন। কোনো কপি ফোল্ডারে এডিট করবেন না — শুধু `MAIN`-এ, তারপর `node align-server.js --apply` চালান।
>
> 📍 **MAIN সার্ভার:** `/home/sahon/dev/Engine/`
> 🧟 **এলাইনমেন্ট টুল:** `/home/sahon/dev/Engine/align-server.js`

---

## ১. কেন এই ডকুমেন্ট?

সার্ভারের `api.js` ফাইলটা একাধিক ফোল্ডারে (dev/sarver, Music/chak/server, Desktop/v3, Desktop/exam/*, ১.zombiecoder, .opencode, ইত্যাদি — মোট **২৮টা কপি**) একটু একটু করে আপডেট করা হয়েছে। ফলে প্রতিটা কপি আলাদা হয়ে গেছে — আমরা যাকে বলি **"তালবাহানা"**।

**নিয়ম:**
1. সব সার্ভার এডিট হয় **শুধুমাত্র** `/home/sahon/dev/Engine/api.js`-এ।
2. তারপর `node align-server.js --apply` চালালে **সব কপি** MAIN-এর সাথে মিলে যায় (backup সহ)।
3. এই ডকুমেন্টে যা লেখা, সেটাই সঠিক ফরম্যাট — এখান থেকে বিচ্যুতি = বাগ।

---

## ২. সার্ভারের মূল পরিচয়

| বিষয় | মান |
|-------|-----|
| Entry point | `start.js` (Node.js, zero external deps) |
| Main logic | `api.js` (~৪৮৬KB, ১৩,৭০০+ লাইন) |
| Port | `5000` |
| Version | v3.2.1 |
| Domain | b.zombiecoder.my.id |
| Agents | ৬ জন (code-guru, bug-hunter, security-hero, perf-wizard, doc-king, qa-tyrant) |
| Models | ৩৫+ (provider chain সহ) |
| MCP | `/mcp` (JSON-RPC 2.0) |
| Transport | HTTP, SSE, WebSocket, UDS (`/tmp/zombiecoder/mcp.sock`) |

---

## ৩. পরিবহন (Transport) — ৪টি পথ

| পথ | প্রোটোকল | কখন ব্যবহার হয় | পছন্দের ক্রম |
|----|----------|----------------|--------------|
| **UDS** | Unix Domain Socket, newline-delimited JSON-RPC | লোকাল (একই মেশিন) | ১ম |
| **HTTP** | OpenAI-compatible REST + SSE | রিমোট/লোকাল | ২য় |
| **SSE** | Server-Sent Events (stream) | রিমোট stream | ৩য় |
| **WebSocket** | WS | রিয়েল-টাইম | ৪র্থ |

**নিয়ম:**
- UDS সকেট: `/tmp/zombiecoder/mcp.sock` — নতুনলাইন-ডিলিমিটেড JSON-RPC কথা বলে (HTTP না!)
- এক্সটেনশন `resolveActiveTransport()` দিয়ে প্রথমে UDS প্রোব করে, না পেলে HTTP-তে যায়
- `/v1/chat/completions` stream branch `callModelStream`-এ tools **RAW পাঠাবে না** — আগে ৪০-এ cap (`V1_TOOLS_CAPPED`)

---

## ৪. মূল Endpoints

| Endpoint | Method | কাজ |
|----------|--------|-----|
| `/health` | GET | স্বাস্থ্য পরীক্ষা (healthy, version, agents, models) |
| `/v1/models` | GET | ৭টা agent model (owned_by: mission-barisal) |
| `/api/v1/models` | GET | ৩৫টা provider model (custom providers) |
| `/v1/chat/completions` | POST | OpenAI-compatible চ্যাট (stream + non-stream) |
| `/api/input` | POST | ইউনিফাইড HTTP entry (TransportAdapter → handleMessage) |
| `/api/workspace` | POST | workspace SSOT + session dir সেট |
| `/api/syllabus` | GET/POST | সিলেবাস পড়া/যোগ করা |
| `/api/memory` | GET | memory.json পড়া |
| `/api/sessions/search` | GET | সেশন আর্কাইভ সার্চ |
| `/mcp` | POST | MCP JSON-RPC (tools/list, tools/call) |
| `/api/verify-session` | GET | সেশন ভেরিফাই |

---

## ৫. `/v1/chat/completions` — সঠিক ফরম্যাট

### Request (এক্সটেনশন → সার্ভার)
```json
{
  "model": "code-guru",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": true,
  "temperature": 0.7,
  "session_id": "abc123",
  "tools": [ { "type": "function", "function": { "name": "...", "description": "...", "parameters": {} } } ],
  "project_context": "SSOT content..." 
}
```

### Response (stream) — SSE chunks
```json
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"..."},"finish_reason":null}]}
```

### Response (non-stream)
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "code-guru",
  "choices": [{ "index": 0, "message": { "role": "assistant", "content": "..." }, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 13, "completion_tokens": 16, "total_tokens": 28 },
  "session_id": "..."
}
```

### ⚠️ Tools সীমা — অত্যন্ত গুরুত্বপূর্ণ
```
🧟 MAX_TOOLS_LIMIT = 40 (সব জায়গায়)
```
- `executeSingleAgent` (line ~7313): cap 40
- `executeMission` (line ~6713): cap 40
- `/v1/chat/completions` parse-time (line ~10926): cap 40 ← **এইটা যোগ করা হয়েছে V1_TOOLS_CAPPED ফিক্সে**
- কারণ: ৭১টা tools + ৫০K টোকেন → ছোট মডেল **ফাঁকা উত্তর** দেয় ("Tools provided: 71, Estimated input tokens: 50471")

---

## ৬. Single Agent Execution Pipeline (`executeSingleAgent`)

```
ইনপুট → classifyInput (web search দরকার?) 
→ sysMsg (persona + identity + PROOF REQUIREMENT + MANDATORY CONTEXT RULES + CODE SAFETY + ssotCtx + threeFileCtx + dynamic tools list)
→ getAgentMemory (সেশন হিস্ট্রি লোড)
→ tools auto-fill (MCP_TOOLS) + cap 40
→ callModelWithTools / callModelStream
→ memory save (saveAgentMemory, saveMemory, archiveSession)
→ learnToSyllabus (সিলেবাসে অটো-লার্নিং!)   ← যোগ করা হয়েছে
→ GOAL VERIFICATION (verifyGoalOutput)
→ agent-to-agent calls (parseAgentCalls → executeAgentCall)
```

**নিয়ম:**
- ৪র্থ আর্গুমেন্ট `executeSingleAgent(agentId, messages, stream, sessionId, tools, projectContext)` — sessionId পাঠাতে হবে, TransportAdapter object **না** (পুরনো বাগ!)
- `buildThreeFileContext` → **শুধুমাত্র সিলেবাস** ইনজেক্ট করে (সেশন মেমোরি getAgentMemory দিয়ে আলাদা লোড হয়)
- সিস্টেম মেসেজে tools list **ডাইনামিক** — `buildToolsDescription(MCP_TOOLS)` থেকে

---

## ৭. সিলেবাস ম্যানেজমেন্ট (অটো-লার্নিং)

| ফাংশন | লাইন | কাজ |
|--------|------|-----|
| `bootstrapSyllabus(projectDir)` | ~1469 | সম্পূর্ণ সিলেবাস টেমপ্লেট (৬ এজেন্ট + নিয়ম + Latest Learnings টেবিল) |
| `autoSyllabus(projectDir)` | ~1289 | না থাকলে বুটস্ট্র্যাপ |
| `readSyllabus(projectDir)` | ~1406 | mtime-cached পড়া |
| `writeSyllabus(projectDir, topic, entry)` | ~1586 | এন্ট্রি append + Latest Learnings আপডেট |
| `_updateSyllabusIndex(agentsDir, ...)` | ~1629 | টেবিল না থাকলে **তৈরি করে** (মাইগ্রেশন ফিক্স) |
| `learnToSyllabus(sessionId, agent, input, content)` | ~1660 | **এজেন্ট কমপ্লিশনে অটো-লার্ন** (dedupe + 40 chars guard) |

**পাথ:** `<projectDir>/.zombiecoder/agents/syllabus.md`
**নিয়ম:** এজেন্ট কাজ শেষ করলেই `SYLLABUS_LEARNED` লগ হয় — সিস্টেম যত চলে, সিলেবাস তত স্মার্ট।

---

## ৮. Mission Mode (মাল্টি-এজেন্ট)

- model = `"mission"` → `executeMission`
- `classifyInput(userInput)` → `recommended_agents` (স্মার্ট নির্বাচন)
  - `simple_qa` / greeting → ২ জন এজেন্ট
  - `project_task` / complex → ৩+ জন এজেন্ট
- সব এজেন্ট parallel চলে, তারপর ক্রস-ভেরিফিকেশন
- `MISSION_COMPLETE` লগ: verified: true/false
- **সেশন মেমোরি:** প্রতি এজেন্টের আলাদা ফাইল + recent_context (২০ entries) — mission-এও কাজ করে

---

## ৯. হ্যান্ডেলমেসেজ (`handleMessage`) Pipeline

```
context_injecting → context_injected → type_safety_passed 
→ goal_set → routing → [executeSingleAgent / executeMission] 
→ cross_verify_* → response_done { data.content }
```

Transport: UDS/SSE/HTTP সবাই `TransportAdapter` দিয়ে `handleMessage`-এ ঢোকে।
`{ type: 'chat', session_id, agent_id, messages, params }` — UDS-এর জন্য।

---

## ১০. যেসব ফিক্স ইতিমধ্যে প্রয়োগ (চেঞ্জলগ)

| তারিখ | ফিক্স | কোথায় |
|-------|-------|--------|
| 2026-08-05 | **sessionId বাগ** — executeSingleAgent-এ TransportAdapter object sessionId হিসেবে যেত → `path.join` TypeError → খালি উত্তর। ৩ জায়গায় ঠিক করা হয়েছে (chat/mission/default) | handleMessage |
| 2026-08-05 | **V1_TOOLS_CAPPED** — `/v1/chat/completions` parse-time tools cap ৪০ (সব branch সুরক্ষিত) | api.js ~10926 |
| 2026-08-05 | **learnToSyllabus** — এজেন্ট কমপ্লিশনে অটো-সিলেবাস লার্নিং (stream + non-stream) | executeSingleAgent |
| 2026-08-05 | **buildThreeFileContext** — শুধু সিলেবাস (সেশন ডাটা ডুপ্লিকেশন বাদ) | api.js ~7076 |
| 2026-08-05 | **buildToolsDescription** — ডাইনামিক MCP tools list সিস্টেম মেসেজে | executeSingleAgent |
| 2026-08-05 | **/api/syllabus POST** — `data.projectDir \|\| mcpWorkingDir` (undefined না) | handleSyllabusAdd |
| 2026-08-05 | **Latest Learnings টেবিল** — bootstrap টেমপ্লেটে যোগ + _updateSyllabusIndex টেবিল তৈরি করে (মাইগ্রেশন) | bootstrapSyllabus / _updateSyllabusIndex |

---

## ১১. দৈনন্দিন কাজের নিয়ম (চেকলিস্ট)

```bash
# ১. সার্ভার এডিট শুধু MAIN-এ:
cd /home/sahon/dev/Engine
nano api.js   # (অথবা আপনার এডিটর)

# ২. সিনট্যাক্স চেক:
node --check api.js

# ৩. সার্ভার রিস্টার্ট:
pkill -f "node start.js"; sleep 1; nohup node start.js > /tmp/engine.log 2>&1 &

# ৪. হেলদি চেক:
curl -s http://localhost:9999/health

# ৫. সব কপি এলাইন:
node align-server.js --check   # কে কতটা পুরনো দেখে
node align-server.js --apply   # সব কপি MAIN-এর সাথে মিলাও (backup সহ)

# ৬. টেস্ট (extension):
cd "/home/sahon/Desktop/zombie codar mission barisal/github-copilot-llm-gateway"
npx tsc -p tsconfig.test.json && node --test out-test/**/*.test.js
```

---

## ১২. সাধারণ ভুল — যা করবেন না

| ❌ ভুল | ✅ সঠিক |
|--------|--------|
| অন্য কপি ফোল্ডারে এডিট করা (Desktop/v3, Music/chak/server...) | শুধু MAIN `/home/sahon/dev/Engine/api.js`-এ এডিট |
| executeSingleAgent-এ ৪র্থ আর্গ transport পাঠানো | sessionId পাঠানো |
| ৭১টা tools সরাসরি মডেলে পাঠানো | আগে ৪০-এ cap (V1_TOOLS_CAPPED) |
| `buildThreeFileContext`-এ সব মেমোরি/আর্কাইভ ঢোকানো | শুধু সিলেবাস (মেমোরি আলাদা getAgentMemory দিয়ে) |
| সিস্টেম মেসেজে static tools list | ডাইনামিক `buildToolsDescription(MCP_TOOLS)` |
| `/api/syllabus`-এ `writeSyllabus(undefined, ...)` | `writeSyllabus(data.projectDir \|\| mcpWorkingDir, ...)` |
| সিলেবাসে টেবিল না থাকলে _updateSyllabusIndex নীরবে ফেল | টেবিল তৈরি করে ফেলা (else branch) |

---

*Generated by Mission Barisal v3 — Evidence-Driven, Proof-First*
*সর্বশেষ আপডেট: 2026-08-06*
