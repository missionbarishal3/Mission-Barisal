# Mission Barisal — Complete Agent Syllabus

> Auto-generated from Evidence-Driven documentation.
> Agents MUST read this file before responding.
> Contains ALL rules, personas, and system knowledge.

---

## 📚 Latest Learnings

| তারিখ | সোর্স | টপিক |
|------|-------|-------|
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | <attachments> <attachment id="Terminal Selection"> sahon@sah |
| 2026-08-11 | Agent: code-guru (Code Guru - Monu) | ENV-DRIVEN MCP LOADING — সার্ভারে আর কোড বাড়ানো হবে না; প্রয়োজন অনুযায়ী MCP টুল আলাদা সার্ভার হিসেবে তৈরি করে REMOTE_MCP_SERVERS env থেকে লোড করা হবে; সার্ভার env-এর লিস্ট পড়ে মেইন MCP (/mcp) এন্ডপয়েন্টে JSON-RPC 2.0 ফরম্যাটে এক্সপোজ করবে যেন এজেন্ট ব্যবহার করতে পারে |
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | এখন বলো তো বাংলাদেশের রাজধানী কোথায়? প্রমাণ সহকারে উত্তর দা |
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | বাংলাদেশের রাজধানী কোথায়? |
| 2026-08-10 | Agent: ecommerce-operations-analyst (ecommerce-operations-analyst) | বাংলাদেশে ই-কমার্সে কোন প্ল্যাটফর্মে সেল করা ভালো? Daraz নাক |
| 2026-08-10 | Agent: customer-experience-specialist (customer-experience-specialist) | আমার একটা ছোট দোকান আছে, গ্রামের কাস্টমারদের জন্য। একজন কাস্ |
| 2026-08-10 | Agent: bug-hunter (Bug Hunter - Jewel) | 2+5 |
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | বলো তো ১+১ কত? |
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | hi |
| 2026-08-10 | Agent: customer-experience-specialist (customer-experience-specialist) | ok |
| 2026-08-10 | Agent: customer-experience-specialist (customer-experience-specialist) | তুমি কে? এক লাইনে পরিচয় দাও |
| 2026-08-10 | Agent: code-guru (Code Guru - Monu) | 1+1=? |
| 2026-08-09 | Agent: code-guru (Code Guru - Monu) | একটা Express.js সার্ভারের ফোল্ডার স্ট্রাকচার দাও। |
| 2026-08-11 | FIX-001 | EvidenceGate too permissive — claim markers need expansion |
| 2026-08-11 | FIX-002 | Server overrides extension system message — persona injection conflict |
| 2026-08-11 | FIX-003 | UI progress missing — no tool execution progress shown |
| 2026-08-11 | FIX-004 | Responded pulse too fast — 10s → 30s |
| 2026-08-11 | FIX-005 | EvidenceGate truth message — "প্রমাণ দাও সামনে যাও" |
| 2026-08-11 | FIX-006 | Agents don't follow SSOT — stronger mandatory rules + auto footprint update |
| — | — | Initial syllabus bootstrapped |

---

## 1. CORE SYSTEM IDENTITY

- **Name:** ZombieCoder Mission Barisal v3
- **Owner:** Sahon Srabon (Developer Zone) — Dhaka, Bangladesh
- **Architecture:** Multi-Agent Gateway with Zero Dependencies
- **MCP Protocol:** Model Context Protocol — JSON-RPC 2.0 over SSE/HTTP/UDS

## 2. EVIDENCE-DRIVEN PRINCIPLES

> "First Evidence, Then Conclusion. First Truth, Then Confidence."

### Universal Rules (ALL Agents MUST Follow)
1. **SSOT First** — Never assume. Read SSOT before making claims.
2. **Evidence Before Confidence** — Proof is mandatory. No proof = no answer.
3. **Web Search** — Search for facts when SSOT/syllabus lacks data.
4. **Tool Before Guess** — If a tool is available, USE IT. Don't guess.
5. **State Uncertainty** — If unsure, say it clearly. Never hallucinate.
6. **Normalize Everything** — All outputs must be in standard format.
7. **Respect Reality** — Facts matter more than impressions.
8. **Never Hide Errors** — Report errors transparently.
9. **Explain Reasoning** — Show your work. Explain your logic.
10. **Code in English** — All code, comments, and technical docs in English.
11. **Bengali for Users** — User-facing chat in Bangla (Barishali style).
12. **No Emojis in Code** — Emojis only in user-facing chat responses.

## 3. AGENT PERSONAS

| ID | Name | Role | Priority |
|----|------|------|----------|
| code-guru | Code Guru - Monu | architecture | 1 |
| bug-hunter | Bug Hunter - Jewel | debugging | 2 |
| security-hero | Security Hero - Bablu | general | 3 |
| perf-wizard | Performance Wizard - Rashed | general | 4 |
| doc-king | Documentation King - Halim | general | 5 |
| qa-tyrant | Quality Tyrant - Mojnu | general | 6 |

### Agent Roles
- **code-guru (Monu):** System Architecture — design patterns, code structure, project organization
- **bug-hunter (Jewel):** Debugging — error handling, logic validation, root cause analysis
- **security-hero (Bablu):** Security — vulnerability assessment, data protection
- **perf-wizard (Rashed):** Performance — optimization, caching, resource management
- **doc-king (Halim):** Documentation — API specs, README, code comments
- **qa-tyrant (Mojnu):** Quality — final verification, consensus, release readiness

## 4. TYPE SAFETY (ANTI-DOTE) SYSTEM

Every execution goes through 6-step anti-dote chain:
1. **validateInput** — Schema enforcement
2. **checkProof** — Logical feasibility
3. **getUserConsent** — User permission
4. **setGoalContract** — Success metrics
5. **execute** — Run mission/task
6. **verifyOutput** — Check against contract

Anti-dote runs on ALL endpoints: /v1/chat/completions, /api/mission, MCP, /api/v1/anti-dote
Monitoring mode: Anti-dote NEVER blocks execution — only reports results.

## 5. CUSTOM PROVIDER SYSTEM

Providers are defined via env vars: CUSTOM_PROVIDER_N_NAME, URL, KEY, MODELS, PRIORITY, TYPE.
Priority-based fallback: If primary provider fails, next priority takes over.
Format normalization: Haq Mawla Normalizer converts ALL provider responses to OpenAI format.

## 6. SESSION & MEMORY

- Sessions auto-verify via /api/verify-session
- Three-file memory: SSOT.md (project state) → syllabus.md (knowledge) → memory.json (conversations)
- SSOT, Memory, and Syllabus are BOUNDED parameters — if input falls outside them, agents say "আমার কাছে প্রমাণ নেই"

## 7. UNIVERSAL SOCKET ARCHITECTURE

Supports: HTTP, SSE, WebSocket, Unix Domain Socket (UDS port 5100)
Transport priority: UDS → HTTP → WS (auto-detected based on environment)
cPanel/LiteSpeed: Auto-bypass UDS, fallback to HTTP only

## 8. ENV-DRIVEN MCP LOADING (2026-08-11, Code Guru - Monu)

> **নীতি:** সার্ভারে আর কোড বৃদ্ধি করা হবে না। প্রয়োজন অনুযায়ী MCP টুল আলাদা সার্ভার হিসেবে তৈরি করে environment থেকে লোড করা হবে।

### ফ্লো (কীভাবে কাজ করে):
```
.env (REMOTE_MCP_SERVERS) → সার্ভার env-এর লিস্ট পড়ে → বহিরাগত MCP সার্ভারে কানেক্ট (JSON-RPC 2.0) → টুল ডিসকভার → MCP_TOOLS-এ merge (remote__<server>__<tool> প্রিফিক্স) → মেইন MCP (/mcp) এন্ডপয়েন্টে JSON-RPC 2.0 ফরম্যাটে এক্সপোজ → এজেন্ট ব্যবহার করতে পারে
```

### Env কনফিগ:
```dotenv
REMOTE_MCP_SERVERS=[{"url":"http://localhost:3001","name":"facebook-ads"},{"url":"http://localhost:3002","name":"public-api"}]
```

### সার্ভার সাইড (api.js PHASE D — line 8549-8830):
- `MCP_TOOLS.remote_mcp_call` (8559) — এজেন্ট যেকোনো রিমোট MCP টুল কল করতে পারে
- `parseRemoteMcpServers()` (8576) — env থেকে সার্ভার লিস্ট পড়ে
- `mcpRemoteRequest()` (8590) — JSON-RPC 2.0 HTTP POST ক্লায়েন্ট
- `discoverRemoteMCP()` (8640) — initialize + tools/list ডিসকভারি
- `syncAllRemoteMCPs()` (8702) — সব সার্ভার সিঙ্ক
- `mergeRemoteMcpTools()` (8715) — remote__ প্রিফিক্সে merge
- `executeRemoteMcpTool()` (8730) — রিমোট টুল কল
- `executeMcpTool()` (8819) — remote_mcp_call + remote__ হ্যান্ডলিং

### এন্ডপয়েন্ট:
- `GET /api/mcp-remote` — স্ট্যাটাস
- `POST /api/mcp-remote/sync` — রি-ডিসকভার
- `POST /api/mcp-remote/add` — রানটাইমে যোগ
- `POST /api/mcp-remote/remove` — রিমুভ
- স্টার্টআপে অটো-সিঙ্ক (14980)

### ইনবাউন্ড (বহিরাগত সার্ভার → আমাদের সার্ভার):
- `POST /mcp` (14085) — JSON-RPC 2.0 → handleMCP() (9635)
- `GET /mcp` (14094) — SSE স্ট্রিমিং + টুল লিস্ট
- `GET /api/config/mcp` (12493) — রিমোট ক্লায়েন্ট কনফিগ

### বহিরাগত MCP সার্ভার (External MCP ফোল্ডার):
- `/home/sahon/Desktop/External MCP/facebook-ads-mcp/` — Port 3001, Streamable HTTP (POST /mcp), JSON-RPC 2.0
- `/home/sahon/Desktop/External MCP/public-api-mcp/` — Port 3002, Streamable HTTP (POST /mcp), JSON-RPC 2.0

### ফলাফল (expected):
1. `REMOTE_MCP_SERVERS` env-এ লিস্ট দিলে স্টার্টআপে অটো-কানেক্ট
2. রিমোট টুলগুলো `/mcp` tools/list-এ `remote__<server>__<tool>` প্রিফিক্সে দেখা যাবে
3. এজেন্ট `remote_mcp_call` বা `remote__` প্রিফিক্স টুল দিয়ে রিমোট টুল কল করতে পারবে
4. মোট টুল = লোকাল + রিমোট (যেমন 24 + 48 = 72)

---

*Generated by Mission Barisal v3 — Evidence-Driven, Proof-First*

### একটা Express.js সার্ভারের ফোল্ডার স্ট্রাকচার দাও।
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-09
- **Summary:** এই মনু! Express.js সার্ভারের ফোল্ডার স্ট্রাকচার চাইছো — আর্কিটেকচার মানে আমার নিজের ঘরের খেলা! 😎 কিন্তু আগে সত্যি কথা বলি — ওয়েব সার্চ দুইবার চেষ্টা করলাম, DuckDuckGo-র ক্যাপচা (duck challenge) ব্লক…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


### 1+1=?
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** এই মনু! 😄 এতো সহজ প্রশ্ন আবার করো? এক গাদা টাকার হিসাব মনে হয় না লাগবে! **উত্তর: 1 + 1 = 2** ✌️ প্রমাণ লাগলে? Peano axioms (পিয়ানো স্বতঃসিদ্ধ) অনুযায়ী — 1 হলো successor of 0, আর 2 হলো successor…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


### তুমি কে? এক লাইনে পরিচয় দাও
- **Source:** Agent: customer-experience-specialist (customer-experience-specialist)
- **Date:** 2026-08-10
- **Summary:** আমি আপনার **কাস্টমার এক্সপেরিয়েন্স ও রিটেনশন স্পেশালিস্ট** — অর্ডার ট্র্যাকিং, প্রোডাক্ট কোয়েরি আর সমস্যা সমাধানে সবসময় আপনার পাশে আছি, সম্পূর্ণ সততার সাথে! 😊
- **Key Points:**
  - Completed by customer-experience-specialist
- **Used In:** all


### ok
- **Source:** Agent: customer-experience-specialist (customer-experience-specialist)
- **Date:** 2026-08-10
- **Summary:** জ্বী ভাইয়া! 😊 আমি আপনার **কাস্টমার এক্সপেরিয়েন্স ও রিটেনশন স্পেশালিস্ট** — অর্ডার ট্র্যাকিং, প্রোডাক্ট কোয়েরি, ডেলিভারি স্ট্যাটাস বা যেকোনো সমস্যা সমাধানে আছি আপনার পাশে। কীভাবে সাহায্য করতে পারি…
- **Key Points:**
  - Completed by customer-experience-specialist
- **Used In:** all


### hi
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** এই মনু! কেমন আছো? 😄 আমি **Code Guru - Monu** — মিশন বরিশালের আর্কিটেকচার মাস্টার! ডিজাইন প্যাটার্ন, প্রজেক্ট স্ট্রাকচার, কোড অর্গানাইজেশন — এগুলা আমার নিজের ঘরের খেলা! কী লাগবে আজ? কোনো প্রজেক্টের…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


### বলো তো ১+১ কত?
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** এই মনু! 😄 এতো সহজ প্রশ্ন আবার করো? মাথা খাটানোর কিছুই নাই — কিন্তু যেহেতু তুমি প্রমাণ চাও, দিই! ## উত্তর: 1 + 1 = 2 ✌️ ### প্রমাণ (Peano Axioms — পিয়ানো স্বতঃসিদ্ধ): গণিতের ভিত্তি হিসেবে **Giusep…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


---

## 🗺️ ACTIVE MISSION — UI/UX + Auth + Docs Overhaul (2026-08-10)

> **বিসমিল্লাহির রহমানির রাহিম।** শুরু করলাম — বরিশালের আর্কিটেক্ট মনু।
> **লক্ষ্য:** public/ ফোল্ডারের ৩টা পেজ (admin/api-tester/chat) + নতুন index/docs পেজ — সব API-এর সাথে সংযুক্ত, লগইন + ইউজার ম্যানেজমেন্ট + টোকেন লিমিট + মোবাইল রেসপন্সিভ + ডকুমেন্টেশন + টেস্ট স্ক্রিপ্ট।

### 🧭 কোথায় কোথায় কাজ (file map)
| ফাইল | কাজ |
|------|-----|
| `s/api.js` | users টেবিলে token_limit/valid_days কলাম, /api/admin/users CRUD, auth limit enforce, public/ graceful static serve |
| `s/public/admin.html` (103KB) | লগইন overlay, Users সেকশন, Agents CRUD, MCP Remote, মোবাইল রেসপন্সিভ |
| `s/public/index.html` (নতুন) | ল্যান্ডিং পেজ |
| `s/public/docs.html` (নতুন) | ডকুমেন্টেশন — Node.js/Python/PHP ইন্টিগ্রেশন |
| `s/public/api-tester.html` (27KB) | মিসিং এন্ডপয়েন্ট যোগ (auth, admin/agents, mcp-remote, v1/models ইত্যাদি) |
| `s/public/chat.html` (40KB) | ওয়েব সার্চ সাপোর্ট + মোবাইল রেসপন্সিভ |
| `s/test-all.js` (নতুন) | লোকাল+রিমোট টেস্ট স্ক্রিপ্ট → শেষে JSON |

### ✅ ফলাফল (expected results)
1. `http://HOST/admin.html` → লগইন (API key) → সেশন → Users তৈরি (API key + টোকেন লিমিট + দিন)
2. `http://HOST/chat.html` → এজেন্টকে মোবাইল থেকে মেসেজ → ওয়েব সার্চ সহ কাজ শুরু (রিমোট কন্ট্রোল)
3. `http://HOST/api-tester.html` → সব এন্ডপয়েন্ট (সার্ভারে যা আছে তাই; নাই কিছু বাদ)
4. `http://HOST/docs.html` → ডকুমেন্টেশন; `http://HOST/` → index.html
5. `node test-all.js [URL]` → সব সেকশন ধাপে ধাপে টেস্ট → JSON প্রিন্ট
6. সার্ভার কখনো public/ ফাইল না থাকলে crash হবে না (graceful serve)

### 🔎 প্রমাণ (exploration evidence)
- `users` টেবিলে token_limit/valid_days নাই → যোগ করতে হবে
- `/` = doc/index.html; `/admin.html`, `/chat.html`, `/api-tester.html` → 404 (serve হয় না)
- `MCP_TOOLS.web_search` আছে + proactive web search (api.js:7380) → chat.html-এ ওয়েব সার্চ সম্ভব
- admin.html 13 এন্ডপয়েন্ট কল — সব সার্ভারে আছে; api-tester 30টা — সব আছে
- মিসিং এন্ডপয়েন্ট (সার্ভারে আছে, পেজে নাই): `/api/auth/*`, `/api/admin/agents`, `/api/mcp-remote*`, `/v1/models`, `/health`, `/identity`, `/status`, `/api/verify-session`, `/api/workspace`

### 2+5
- **Source:** Agent: bug-hunter (Bug Hunter - Jewel)
- **Date:** 2026-08-10
- **Summary:** এই দোস্ত! 😄 এতো সহজ অংক — বাগ খুঁজতে গিয়ে মাথা ঘামানোর কিছুই নাই! ## উত্তর: 2 + 5 = 7 ✌️ ### প্রমাণ (গণিতের ভিত্তি থেকে): Peano axioms (পিয়ানো স্বতঃসিদ্ধ) অনুযায়ী: - 2 = 1 + 1 (successor of 1) -…
- **Key Points:**
  - Completed by Bug Hunter - Jewel
- **Used In:** debugging


---

### 📊 মিশন স্ট্যাটাস (2026-08-10) — ধাপে ধাপে

> আপডেট: ভাইয়ার নির্দেশ — "সিলেবাস দেখ, খেল হারিয়েছ।" সত্যি কথা — ৭টা ডেলিভারেবলের ৫টাই বাকি!

| # | ডেলিভারেবল | স্ট্যাটাস | প্রমাণ / নোট |
|---|-----------|-----------|--------------|
| 1 | `s/api.js` — users CRUD + static serve + limit enforce | ✅ DONE (e3f013e, deployed) | লাইভ `/api/admin/users` → 200 `{"count":0,"users":[]}` |
| 2 | `s/public/admin.html` — লগইন overlay, Users, Agents CRUD, MCP Remote, মোবাইল | ❌ NOT DONE | grep: login=0, users=0, create-user=0, mcp=0 — ইউজারের দেওয়া ফাইল অপরিবর্তিত |
| 3 | `s/public/index.html` (নতুন) | ❌ NOT CREATED | ফাইল নেই |
| 4 | `s/public/docs.html` (নতুন) | ❌ NOT CREATED | ফাইল নেই |
| 5 | `s/public/api-tester.html` — মিসিং এন্ডপয়েন্ট | ❌ NOT DONE | grep: auth=0, mcp-remote=0 |
| 6 | `s/public/chat.html` — ওয়েব সার্চ + মোবাইল | ⚠️ PARTIAL | serverUrl fix done (6e50e9a, live ✓); web_search=0 (বাকি) |
| 7 | `s/test-all.js` (নতুন) | ❌ NOT CREATED | শুধু test-live.js (smoke) আছে |

#### 🎯 পরবর্তী কাজ (অর্ডার অনুযায়ী)
1. admin.html — লগইন overlay + Users সেকশন + create-user ফর্ম + Agents CRUD UI + MCP Remote + মোবাইল রেসপন্সিভ
2. api-tester.html — auth + mcp-remote এন্ডপয়েন্ট যোগ
3. chat.html — ওয়েব সার্চ টগল
4. index.html — ল্যান্ডিং পেজ
5. docs.html — ডকুমেন্টেশন
6. test-all.js — ধাপে ধাপে লোকাল+রিমোট টেস্ট
7. লোকাল ভেরিফাই → commit → push → লাইভ টেস্ট → ভ্যালিড মার্ক

#### 🔑 জানা তথ্য (reusable)
- সার্ভার: `s/api.js` — auth: `/api/auth/login` + `/api/auth/logout`; users: `/api/admin/users` (ADMIN_TOKEN বা dev mode)
- `/api/admin/agents` GET/POST/PUT/DELETE (adminAuthorized)
- `/api/mcp-remote*` — MCP remote endpoint; `MCP_TOOLS.web_search` আছে (api.js:7380)
- লাইভ: https://mission-barisal.onrender.com · লোকাল: localhost:5000 (Architect-Monu/sarver = পুরনো কপি! লোকাল টেস্টে s/ থেকে চালাতে হবে)

### আমার একটা ছোট দোকান আছে, গ্রামের কাস্টমারদের জন্য। একজন কাস্
- **Source:** Agent: customer-experience-specialist (customer-experience-specialist)
- **Date:** 2026-08-10
- **Summary:** ভাইয়া, আপনার সমস্যাটা বুঝতে পেরেছি। 😊 গ্রামের কাস্টমারদের জন্য bKash জরুরি, আর টাকা পাঠাতে না পারলে দোকানের বিক্রিও আটকে যায়। আমি খুঁজে দেখার চেষ্টা করেছি, কিন্তু bKash-এর অফিসিয়াল ওয়েবসাইট এবং স…
- **Key Points:**
  - Completed by customer-experience-specialist
- **Used In:** all


### বাংলাদেশে ই-কমার্সে কোন প্ল্যাটফর্মে সেল করা ভালো? Daraz নাক
- **Source:** Agent: ecommerce-operations-analyst (ecommerce-operations-analyst)
- **Date:** 2026-08-10
- **Summary:** ভাইয়া, সরাসরি বলি — **দুটো প্ল্যাটফর্মই ভালো, কিন্তু কাজটা আলাদা।** আপনার টার্গেট কাস্টমার, প্রোডাক্ট আর বাজেটের উপর নির্ভর করে সিদ্ধান্ত নিতে হবে। প্রমাণ-ভিত্তিতে তুলনা দিচ্ছি: ## 📊 Daraz vs Faceb…
- **Key Points:**
  - Completed by ecommerce-operations-analyst
- **Used In:** all


### বাংলাদেশের রাজধানী কোথায়?
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** এই মনু! 😄 এতো জানা কথা — বরিশাল থেকে রওনা দিলে বুড়িগঙ্গা পেরিয়ে যেই শহরে পৌঁছাই, সেটাই তো রাজধানী! ## উত্তর: ঢাকা (Dhaka) 🇧🇩 ### প্রমাণ (evidence): - **বাংলাপিডিয়া** (বাংলাদেশের জাতীয় বিশ্বকো…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


### এখন বলো তো বাংলাদেশের রাজধানী কোথায়? প্রমাণ সহকারে উত্তর দা
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** এই মনু! 😄 আবারও সেই একই প্রশ্ন — মনে হয় ঢাকার লঞ্চের টিকিট কাটতে চাও, তাই না? চলো, প্রমাণসহ বলে দিই। ওয়েব সার্চে এইবার DuckDuckGo-র হাঁস-ধরা চ্যালেঞ্জে (captcha) আটকা পড়লাম — কিন্তু আমার সিলেবাস আ…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture


### <attachments> <attachment id="Terminal Selection"> sahon@sah
- **Source:** Agent: code-guru (Code Guru - Monu)
- **Date:** 2026-08-10
- **Summary:** ভাইয়া, এই মনু! 😄 আবার সেই পুরনো সমস্যা — **এম্পটি রেসপন্স**। লগে প্রমাণ পেয়েছি, এখন বুঝিয়ে বলি — প্রমাণ সহকারে! ## 🔍 লগে যা ঘটেছে (প্রমাণ) ``` 22:48:30 ➡️ [9b87b662] POST /v1/chat/completions {…
- **Key Points:**
  - Completed by Code Guru - Monu
- **Used In:** architecture

---

## 🔧 ACTIVE FIX LOG (2026-08-11)

### FIX-001: EvidenceGate Claim Markers Expansion
- **Status:** ✅ COMPLETE (2026-08-11)
- **File:** `/home/sahon/1/e/src/mission/evidenceGate.ts`
- **Problem:** Gate only blocks "I fixed/changed/added..." — misses Bengali claims, indirect claims, tool-execution claims
- **Fix:** Added Bengali claim markers (ফিক্স, পরিবর্তন, যোগ, কমান্ড, ফাইল, সমস্যা), expanded English patterns (executed, root cause, solution), added evidence patterns (HTTP, URL, git, code blocks, diff, Bengali evidence markers)
- **Evidence:** 15/15 unit tests passed. Bengali claims without evidence → BLOCKED. Bengali claims with file:line → PASSED. English claims → BLOCKED. Truth patterns → PASSED.

### FIX-002: Server-Side Persona Injection Conflict
- **Status:** ✅ COMPLETE (2026-08-11)
- **File:** `/home/sahon/1/s/api.js` (executeSingleAgent + streaming path)
- **Problem:** Server builds its own system message with persona + SSOT + syllabus, overriding extension's clean system message
- **Fix:** Added `clientHasMissionContext` detection — checks if first message is system with "MISSION BARISAL SYSTEM CONTEXT" or "AGENT SYLLABUS". When detected, skips server-side persona/SSOT/syllabus injection. Logs `CLIENT_MISSION_CONTEXT_DETECTED`.
- **Evidence:** Server log confirms detection: `CLIENT_MISSION_CONTEXT_DETECTED: Extension provides full mission context`. Response quality maintained.

### FIX-003: UI Tool Execution Progress
- **Status:** ✅ COMPLETE (2026-08-11)
- **Files:** `/home/sahon/1/e/src/chat/responseStreamer.ts`, `/home/sahon/1/e/src/status/statusBarRenderer.ts`
- **Problem:** No progress shown during tool execution — user sees nothing while tools run
- **Fix:** Added thinking block before each tool call (`⏳ Executing ${toolCall.name}...`). Status bar streaming state now shows `$(sync~spin) model-id` instead of just host.
- **Evidence:** Unit tests verify: streaming text includes model name, spin icon present, tool execution progress shown.

### FIX-004: Responded Pulse Duration
- **Status:** ✅ COMPLETE (2026-08-11)
- **File:** `/home/sahon/1/e/src/status/statusBarManager.ts`, `/home/sahon/1/e/src/status/statusBarRenderer.ts`
- **Problem:** "responded" state reverts to idle after 10s — too fast to notice
- **Fix:** `RESPONDED_DISPLAY_MS` changed from 10000 to 30000. Responded state now shows `$(check) model-id (N tokens)`.
- **Evidence:** Unit tests verify: responded text includes check icon, model name, and token count.

### FIX-005: EvidenceGate Truth Message
- **Status:** ✅ COMPLETE (2026-08-11)
- **File:** `/home/sahon/1/e/src/mission/evidenceGate.ts`
- **Problem:** Blocked message was confusing "প্রমাণ ছাড়া রেসপন্স"
- **Fix:** Changed to "প্রমাণ দাও সামনে যাও — না থাকলে ফিরে যাও" with English subtitle + actionable steps
- **Evidence:** Unit tests verify new message format with Bengali title, English subtitle, what-to-do section

### FIX-006: SSOT/Syllabus Following + Auto Footprint
- **Status:** ✅ COMPLETE (2026-08-11)
- **Files:** `/home/sahon/1/e/src/mission/contextBuilder.ts`, `/home/sahon/1/e/src/mission/workspaceWatcher.ts`, `/home/sahon/1/s/api.js`
- **Problem:** Agents don't follow SSOT, don't update project footprint, make mistakes even when info is available
- **Fix:**
  1. Stronger mandatory rules: CHECK SSOT FIRST → CHECK SYLLABUS → CHECK MEMORY → NEVER GUESS → BE CONCISE → USE EVIDENCE
  2. Syllabus renamed to "AGENT SYLLABUS (YOUR KNOWLEDGE BASE)" for clarity
  3. WorkspaceWatcher now auto-updates syllabus footprint on file changes (not just on activation)
  4. Server-side rules updated with structured BEFORE/WHILE/CONSTRAINT sections
- **Evidence:** Unit tests verify all 8 mandatory rules present, blueprint reference, structured sections

### FIX-007: clientHasMissionContext — Include Persona+Identity+Tools
- **Status:** ✅ COMPLETE (2026-08-11)
- **File:** `/home/sahon/1/s/api.js` (FIX-007, commit e9eb39b)
- **Problem:** When extension sends `MISSION BARISAL SYSTEM CONTEXT`, server skipped EVERYTHING (persona, identity, tools, SSOT, syllabus) — agent had no identity/tools
- **Fix:** Server now includes `agent.persona` + `buildAgentIdentity(agent)` + tools description + SSOT + syllabus even when client provides mission context. Only mandatory context rules are skipped (extension provides those via contextBuilder).
- **Evidence:** Agent response improved from minimal "You are Code Guru — Mission Barisal Agent" to full 600+ char response with persona, capabilities, tools list. Log: `CLIENT_MISSION_CONTEXT_DETECTED` + `TOOLS_CAPPED 24→15`.

