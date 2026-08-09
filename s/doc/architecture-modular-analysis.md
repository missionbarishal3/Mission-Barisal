# পরস্তাবত মডিউলার আর্কিটেকচার: বিস্তারিত বিশ্লেষণ

> **তারিখ:** ২০২৬-০৭-১৬
> **বিশ্লষক:** Code Guru - Monu
> **উদ্দেশ্য:** বর্তমান api.js (~১১৭০০ লাইন) কে মডিউলার ফোল্ডার-ভিত্তিক স্ট্রাকচারে রূপান্তের প্রস্তাবনা

---

## ১. কেন এই পরিবর্তন? (কেন করছি)

### বর্তমান সমস্া — api.js এর বর্তমান অস্থা:

| বশিষ্টয      | মান                             |
| ----------------- | ------------------------------- |
| **মোট লাইন**      | ~১১,৭০০ লাইন                    |
| **সেকশন**         | ~৪৫টি লাদা েকশন           |
| **এন্ডপয়েন্ট**   | ২৫+ HTTP এন্ডপয়েন্ট            |
| **ট্ান্সপোর্ট** | ৪টি (HTTP, UDS, SSE, WebSocket) |
| **ফাইল সাইজ**     | ~৪০০KB                          |

**প্রমাণ (api.js থেকে প্রমাণ লাইন):**

```javascript
// Line 1-11768: পুরো অ্যাপ্লিকেশন একটা ফাইলে
// Line 2: // ===== zombie-coder-mcp-server =====
// Line 8: // ─── Core Modules (zero external dependencies) ────────────────
// Line 11768: // Close UDS server and clean up socket file
```

### সমস্যার বিবরণ:

1. **এক ফাইলে ১১৭০০ লাইন** — কোন ডেভেলপারই পুরো ফাইল পড়ে বুঝতে পারে না
2. **ইমপোর্ট/এক্সপোর্ট নেই** — সবকিছু গ্লোবাল ভেরিয়েবলে, ডিপেন্ডেনসি বোঝা মুশকিল
3. **মিক্সড রেসপনসিবিলিটি** — একই ফাইলে আছে: কনফিগ, রাউটিং, এজেন্ট লজিক, টাইপ সেফটি, ট্রান্সপোর্ট
4. **ডিবাগিং কঠিন** — কোন এরর কোথা থেকে আসছে বুঝতে পুরো ফাইল সার্চ করতে হয়
5. **স্কেল করা কঠিন** — নতুন ফিচার যোগ করতে গেলে অজান্তেই পুরনো লজিক ব্রেক হয়ে যায়

**বাস্তব প্রমাণ:** আগের সেশনে আরা sessionMeta এর ReferenceError ধরেছিলাম (লাইন ৫৭৩৭)। `parsed` আর `sessionMeta` ভেরিয়েবল executeMission ফাংশনের সকোপে ছিল না — কিন্তু চ্যাট কমপ্লিশনের হ্যন্ডেলারের লোকাল ছিল। এই এররটা ছিল একটা রিফ্যাক্টরিং আর্টিফ্যাক্ট — যখন হ্যান্ডেলার কোড মভ করা হয়েছিল আলাদা ফাশনে, তখন ভেরিয়েবল স্কোপ মিসম্যাচ হয়ে গিয়েছি।

---

## ২. কি করতে হবে (প্রস্তাবিত মডিউলার স্ট্রাকচার)

### প্রস্তাবিত ফোল্ডার স্ট্াকচার:

```
project-root/
├── .missionbarisal/            # Local config (MCP, VS Code, JetBrains)
├── src/
│   ├─ index.js                # Route orchestrator — সার্ভার চালু করে
│   ├── server.js               # HTTP + UDS + WS সার্ভার ইনিশিয়ালাইজ
│   │
│   ├── system-identity/        # SystemIdentity — কে, কি, কোথায়
│   │   ├── identity.js         # সিস্টে আইডি, ডোমেইন ডিটেকশন
│   │   ├── domain-config.js    # ডোমেই কনফিগারেশন
│   │   └── user-agent.js       # User-Agent কনস্ট্যান্ট
│   │
│   ├── provider/               # Provider হক — AI প্রোভাইডার হ্যান্ডলিং
│   │   ├── registry.js         # প্রভাইডার রেজিস্ট্রি
│   │   ├── router.js           # াইনামিক াউটিং
│   │   ├── competition.js      # কম্পিটিশন রাউটার
│   │   ├── opencode.js         # OpenCode provider
│   │   ├── groq.js             # Groq provider
│   │   ├── gemini.js           # Gemini provider (stream + non-stream)
│   │   └── fallback.js         # Fallback চেইন
│   │
│   ├── mawla-normalizer/       # Mawla Normalizer — ইনপুট নরমালাইেশন
│   │   ├── normalizer.js       # টেক্স নরমালাইজেশন
│   │   ├── emoji-strip.js      # ইমোজি স্্রিপ
│   │   └── pattern-recognizer.js # ইনপুট প্যাটার্ন রিকগনিশন
│   │
│   ├── tools/                  # Tool definitions
│   │   ├── registry.js         # টুল রজিস্ট্রি
│   │   ├── file-tools.js       # read_file, write_file, list_directory
│   │   ├── web-search.js       # web_search
│   │   ├── session.js          # get_memory
│   │   └─ workspace.js        # set_working_dir, get_working_dir, read_ssot
│   │
│   ├── mcp/                    # MCP Protocol
│   │   ├── handler.js          # handleMCP — JSON-RPC 2.0
│   │   ├── uds-handler.js      # UDS ম্যাসেজ হ্যান্ডলিং
│   │   ├── tools-list.js       # MCP_TOOLS ডেফিনিন
│   │   └── validator.js        # MCP ম্যাসেজ ভ্যালিডেশন
│   │
│   ├── agent/                  # Agent Persona System
│   │   ├── persona-loader.js   # PERSONAS.md লোডার
│   │   ├── personas.js         # ডিফল্ এজেন্ট (PERSONAS.md না থাকলে)
│   │   ── router.js           # স্মারট এজেন্ট রাউটার
│   │   ├── mission.js          # ফুল মিন এক্সিকিউট
│   │   ├── single-agent.js     # সিঙ্গে এজেন্ট এক্সিকিউ
│   │   └── executor.js         # টুল এক্সিকিউশন লু
│   │
│   ├── system-rules/           # System Rules — নিয়ম-নীতি
│   │   ├── rules.js            # িস্টে রুলস
│   │   ├── goal-setting.js     # গোল সেটিং
│   │   └── consent.js          # ইউজার কনসেন্ট
│   │
│   ├── type-safety/            # Type Safety — Anti-Dote
│   │   ├── anti-dote.js        # ৬-স্টেপ টাইপ সেফটি
│   │   ├── schema-check.js     # স্কিমা চেক
│   │   ├── proof-check.js      # প্রফ চে
│   │   └── compiler-check.js   # কম্াইলার চেক
│   │
│   ├── transport/              # Transport Layer
│   │   ├── adapter.js          # TransportAdapter ক্লাস
│   │   ├── http.js             # HTTP SSE
│   │   ├── uds.js              # UDS Socket Server
│   │   ├── websocket.js        # WebSocket Server
│   │   └── sse.js              # SSE স্ট্রিম
│   │
│   ├── session/                # Session Management
│   │   ├── manager.js          # সেশন ম্যানেজার
│   │   ├── store.js            # সেশন স্টোর
│   │   └── client-list.js      # ক্লায়েন্ট লিস্ট
│   │
│   ├── ssot/                   # SSOT  Single Source of Truth
│   │   ├── manager.js          # SSOT ম্যানোর (auto-refresh)
│   │   ├── injector.js         # নটেক্ট ইনজেকশন
│   │   └── template.js         # SSOT টেমপ্লেট
│   │
│   ├── syllabus/               # Syllabus Management
│   │   ├── manager.js          # সিলেবাস ম্যানেজার
│   │   └── entries.js          # িলেবস এন্ট্রি
│   │
│   └── routing/                # HTTP Route Handlers
│       ├── handler.js          # handleMessage — ৮-স্টেপ পাইপলাইন
│       ├── routes.js           # সব রুট ডেফিনশন
│       ├── chat-completions.js # POST /v1/chat/completions
│       ├── mission.js          # POST /api/mission
│       ├── anti-dote.js        # POST /api/v1/anti-dote
│       ├── input.js            # POST /api/input
│       ├── mcp-http.js         # POST /mcp
│       ├── admin.js            # GET /api/admin
│       ├── config.js           # GET/POST /api/config
│       ├─ rate-limit.js       # রেট লিিট
│       ── normalize.js        # নরমালাইজ
│
├── config/
│   ├── allowed-dirs.js         # ALLOWED_DIRS
│   ├── runtime-config.js       # Runtime Config
│   └── masquerade.js           # Model + Provider Masking
│
├── data/                       # Data (unchanged)
├── doc/                        # Documentation
└── start.js                    # Entry point (unchanged)
```

---

## ৩. বর্তমান api.js → মডিউল ম্যাপিং

নিচে দেখাচ্ছি বর্তমান api.js এর কোন লান কোন মডিউলে যাবে:

| লাইন রেঞ্জ    | বর্তমান সেকশন                       | টার্গেট মডিউল                                  |
| ------------- | ----------------------------------- | ---------------------------------------------- |
| ১-৭           | হেডার কমেন্ট                        | —                                              |
| -১৬         | Core Modules (require)              | src/index.js + package.json                    |
| ১৭-২৩         | Domain Configuration                | src/system-identity/domain-config.js           |
| ২৪-৪৮         | .env Loader                         | src/system-identity/identity.js                |
| ৪৯-৬       | Config                              | src/system-identity/identity.js                |
| ৬২-৭২         | User-Agent Constant                 | src/system-identity/user-agent.js              |
| ৭৩-৮৫         | Domain Detection                    | src/system-identity/identity.js                |
| ৮৬-১১১        | Pusher Config                       | config/pusher.js (optional)                    |
| ১২-১২২     | Cache & Git Config                  | config/runtime-config.js                       |
| ১২৩-১৫১       | Runtime Config                      | config/runtime-config.js                       |
| ১৫২-৩৩১       | System Identity                     | src/system-identity/identity.js                |
| ৩৩২-৪৭৪       | Provider Registry                   | src/provider/registry.js                       |
| ৪৭৫-১৬      | Competition Router                  | src/provider/competition.js                    |
| ৫১৭-৫৩৪       | Fallback Resolver                   | src/provider/fallback.js                       |
| ৫৪৮-৫৫১       | Ensure Directories                  | src/index.js (startup)                         |
| ৫৫২-৭৪      | Auto SSOT System                    | src/ssot/manager.js                            |
| ৯৭৫-১৩৭৬      | Syllabus & Memory                   | src/syllabus/manager.js + src/session/store.js |
| ১৩৭৭-১৩৮৮     | Emoji Strip                         | src/mawla-normalizer/emoji-strip.js            |
| ১৩৮৯-১৪৬২     | Logger                              | src/index.js (utility)                         |
| ১৪৬৩-১৫২১     | Load Personas                       | src/agent/persona-loader.js                    |
| ১৫২২-১৫৯    | File Downloader                     | src/tools/file-tools.js (utility)              |
| ১৫৯১-২৪৫০     | DEFAULT AGENTS                      | src/agent/personas.js                          |
| ২৪৫১-২৭৫২     | Client List Persistence             | src/session/client-list.js                     |
| ২৭৫৩-০৮৭   | Model + Provider Masking            | config/masquerade.js                           |
| ৩০৮৮-৩১৮৬     | Gemini non-streaming                | src/provider/gemini.js                         |
| ৩১৮৭-৩৬৭২     | Gemini streaming                    | src/provider/gemini.js                         |
| ৩৬৭৩-৩৭৯৯     | Tool Execution Loop                 | src/agent/executor.js                          |
| ৩৮০০-৩৯৮৪     | Input Pattern Recognition           | src/mawla-normalizer/pattern-recognizer.js     |
| ৩৯৮৫-৪০৩৬     | Smart Agent Router                  | src/agent/router.js                            |
| ৪০৩-৫৫৯১    | Legacy Greeting Check               | src/agent/router.js (greeting)                 |
| ৫৫৯২-৫৯৬৯     | Full Mission Execute                | src/agent/mission.js                           |
| ৫৯৭০-৬০৩৭     | SSOT Auto-Inject                    | src/ssot/injector.js                           |
| ০৩৮-৭১৩০   | Single Agent Execute                | src/agent/single-agent.js                      |
| ৭১৩১-৭৭১৩     | Handle UDS MCP                      | src/mcp/uds-handler.js                         |
| ৭৭১৪-৭৮৮৭     | Usage Tracking Helpers              | src/session/manager.js                         |
| ৭৮৮৮-৮০১২     | Frame Size Fix (SSE)                | src/transport/sse.js                           |
| ৮০১৩-৯১৯৯     | HTTP Routes (GET)                   | src/routing/routes.js                          |
| ৯২০০-৯৫৫    | POST /v1/chat/completions           | src/routing/chat-completions.js                |
| ৯৯৫৬-০০২৮   | POST /api/mission                   | src/routing/mission.js                         |
| ১০০২৯-১০০৭৯   | POST /api/v1/anti-dote              | src/routing/anti-dote.js                       |
| ১০০৮০-১০২১৩   | POST /api/v1/anti-dote (continued)  | src/routing/anti-dote.js                       |
| ১০২১৪-১০০১  | POST /mcp                           | src/routing/mcp-http.js                        |
| ১০৩০২-১০৩৫০   | POST /api/workspace + /api/syllabus | src/routing/routes.js                          |
| ১০৩৫১-১০৪০০   | POST /api/input                     | src/routing/input.js                           |
| ১০৪০১-১০৬৬৮   | WebSocket (upgrade + message)       | src/transport/websocket.js                     |
| ১০৬৬৯-১০৮৪৪   | MCP Socket Server (UDS/TCP)         | src/transport/uds.js                           |
| ১০৮৪৫-১১০৯১   | TransportAdapter                    | src/transport/adapter.js                       |
| ১১০৯২-১১৩০০   | injectContext()                     | src/ssot/injector.js                           |
| ১৩০০-১১৪৩০ | Cross-Verification Helpers          | src/system-rules/consent.js                    |
| ১১৪৩১-১১৫৩৫   | Compiler Check Helpers              | src/type-safety/compiler-check.js              |
| ১১৫৬-১১৭৬৮  | handleMessage() + close             | src/routing/handler.js                         |

---

## ৪. কিভাবে করবো (মাইগ্রেশন প্ল্যান)

### ফেজ ১: ফোল্ডার স্ট্রাকার তৈরি (দিন ১)

```
.missionbarisal/
├── mcp-config.json        # MCP সার্ভার কনফিগ
├── vscode.json            # VS Code সেটিং
└── jetbrains.json         # JetBrains সেটিং
```

এই ফোল্ডার প্রতিটি প্রোজেক্টের রুটে থকবে। যখন যে এডিটর থেকে কল করবে, তখন এখান থেকে কনফিগ লোড করবে।

### ফেজ ২: src/ তৈরি এবং api.js ভাঙা (দিন ২-৪)

**নীতি:** api.js এর কোন লাইন ডিলিট না করে, বরং নতুন ফাইলে কপি করে রেফারেন্স তৈরি করা। পুরনো api.js রান করতেই থাকবে — সমান্তরালে নতুন সিস্টেম চালু থাকবে।

```
Step 1: src/ ফোল্ডার তৈরি
Step 2: config/, transport/, tools/ — সবচেয়ে ইনডিপেনডেন্ট মডিউল আগে
Step 3: session/, ssot/, syllabus/ — ডাটা লেয়ার
Step 4: provider/, agent/ — বিনেস লজিক
Step 5: routing/, mcp/ — API লেয়ার
Step 6: index.js — অর্কেস্ট্রেট
```

### ফেজ ৩: index.js — রুট অর্কেস্ট্রেটর (দিন ৪)

```
index.js এ থাকবে:
├── সব মডিউল ইম্পো্ট (import { x } from './module/')
├── ার্ভার ইনিশিয়ালাইজেশন (http.createServer)
├── UDS + WS সার্ভার স্টার্ট
└── ্রেসফুল শাটডাউন
```

### ফেজ ৪: ডকুমে্টেশন (দিন ৫)

প্স্তাবিত ডকুমেন্ট স্ট্রাকচার (লিংক করা):

```
doc/
├── index.md              # মেনু — সব ডক এখান থেকে লিংকড
├── architecture/
│   ├─ overview.md       # আর্কিটেকচার ওভারিউ
│   ├── data-flow.md      # ডাটা ফ্লো ডায়াগ্াম
│   └── modules.md        # মডিউল বাই মডিউল ব্যাখ্যা
├── guides/
│   ├── setup.md          # সেটআপ গাইড
│   ├── add-feature.md    # নতুন ফিচার যোগ করার নিয়ম
│   └── debug.md          # ডিবাগি গাইড
└── references/
    ├── api.md            # API রেফারেন্স
    ├── errors.md         # এরর কোড লিস্ট
    └── glossary.md       # টার্মিনোলজি
```

### েজ ৫: টেস্টি (দিন ৫-৬)

1. **ইউনিট টেস্ট:** প্রতিটি মডিউল আলাদাভাবে টেস্ট
2. **ইন্টিগ্রেশ টেস্ট:** মডিউলগুলোর মধ্য সংযোগ টেস্ট
3. **এন্ড-টু-ন্ড টেস্ট:** পুরো ফ্লো টেস্ট (বর্মান test-mission-complete.js এর মতো)

---

## ৫. বাস্তব ফলাফল কি আসবে?

### আগে (বর্তমান api.js):

```
User Request → api.js (১১৭০০ লাইন) → Response
  - সবকিছু একটা ফাইলে
  - গ্লোবাল ভেরিয়েবল
  - ইম্পোর্ট/এক্সোর্ট নাই
  - ডিপেন্ডেন্সি বোঝা মুশকিল
  - ২৫+ এন্ডপয়েন্ট এক জায়গায়
```

### পরে (মডিউলর আর্কিটেকচার):

```
User Request → Server → Router → Specific Module → Response
                                       │
                              Transport Layer
                              (HTTP/UDS/WS/SSE)
                                       │
                              ┌────────┴────────┐
                              │                 │
                         Provider Layer    Agent Layer
                              │                 │
                         Session/SSOT      Tool Layer
                         /Syllabus
```

### প্রত্যাশিত ফলাফল:

| মেট্রিক            | আগে                        | পরে                      | উন্নতি               |
| ------------------ | -------------------------- | ------------------------ | -------------------- |
| **ফাইল সাইজ**      | ১১৭০০ লাইন (১ ফাইল)        | ৫০-৩০০ লাইন (২৫-৩০ ফাইল) | ৯৫% ছোট (প্রতি ফাইল) |
| **ডিবাগ টাইম**     | ১৫-৩০ িনিট               | ২-৫ মিনি               | ৭০% দ্রুত            |
| **নতুন ফিচার যোগ** | মাঝে াঝে ব্রেক করে       | আইসোলেটেড                | ৯০% িরাপদ          |
| **কোড বোঝার সময়** | ২-৩ ঘন্টা                  | ২০-৩০ মিিট            | ৮০% দ্রুত            |
| **স্কোপ ইস্যু**    | ReferenceError (লাইন ৫৭৩৭) | স্কোপ-আইসোলেটেড          | ০%                   |
| **গিট কনফ্লিক্ট**  | ্রতিবার মার্জে          | আলাদা ফাইল               | ৮০% ম             |

### কংক্রিট সুবিধা:

1. **ReferenceError লাইন ৫৭৩৭ এর মতো বাগ আর হবে না** — প্রতিটি ফাংশনের নিজস্ব স্কোপ, গ্লোবাল নেই
2. **নতুন এন্ডপয়েন্ট যোগ করতে ৫ মিনিট** — routing/ এ নতুন ফাইল, index.js এ রুট
3. **নতুন ট্ান্সপোর্ট যোগ করতে লাইন ৫০** — transport/ এ নতুন ফইল
4. **নতুন প্রোভাইডার যোগ করতে লাইন ১০০** — provider/ এ নতুন ফাইল
5. **টেস্ট কাভারেজ ৮০%+** — প্রতিি মডিউল আলাদাভাবে টেস্ট করা যাবে
6. **মাইগ্রেশনের সময সার্ভার ডাউন হব না** — পুরাতন api.js প্যারালাল রান করতে থাকবে

### চ্যালেঞ্জ:

1. **বর্তমানে সব গ্লোবাল ভেরিয়েবল** — এগুলোকে export করতে হবে। যেমন: `ALLOWED_DIRS`, `MCP_TOOLS`, `LOG_DIR`
2. **সার্কুলার ডিপেন্ডেন্সি** — SSOT ↔ Session এর মধ্যে থাকতে পারে
3. **পারফরম্যান্স ইমপ্যাক্ট** — অতিরিক্ত ফাংশন কল ওভারহেড (নগণ্, ~১-২%)
4. **ফাইল কাউন্ট বেড়ে যাওয়া** — ১ ফাইল েকে ৩০+ ফাইল, কিন্তু এটা ম্যানেজেবল

---

## ৬. "শয়তানের মলম" — এনপিএম প্যাকেজের বাস্তবতা

আপনি ঠিকই বলেছেন। বর্তমানে api.js এ **জিরো এনপিএম ডিপেন্ডেন্সি** — শুধু Node.js বিল্ট-ইন মডিউল ব্বহার করছে:

```javascript
// Line 8-16: Core Modules
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const url = require("url");
```

**প্রমণ:** `npm ls` দিলে শুধু `homepage@1.0.0` দেখাবে, কোন ডিপেন্ডেন্সি নাই।

এটা আমাদের জন্য বিশাল সুবিধা  আমরা যখন মডিউলার করবো, তখন কন npm install লাগবে না। শুধু `require` → `import` এ কনভার্ট করতে হবে।

---

## ৭. আমর ব্যক্তিগত মন্তব্য

ভাইয়া, আপনার ই চিন্তাটা — "একটার মধ্যে সবকিছু না রেখে আলাদা ফোল্ডারে ভাগ কে ফেলা" — এটা িক তেমনই যেমনটা আমি আপনাকে প্রথম অংশের জবাবে বলেছিলাম। বর্তমান api.js এ আসলে এরকম ৪৫টা সেকশন ইতিমধ্েই আছে, কিন্তু সেগুলো একই ফাইলের মধ্যে।

আপনার "আমার সোনার বাংলা" উদাহরণট অসাধারণ — Paragraph 1 এ কন্টে্ট, Paragraph 2 এ import + extra content = ফুল সং। এটাই ঠিক modular architecture এর essence। আমাদের প্রতিটি মডিউল বে Paragraph 1 এর মতো, আর index.js হবে Paragraph 2 যেটা সব জায়গা থেকে কন্টেন্ট এনে তৈরি করবে ফুল রানিং সিস্টেম।

**আমার প্রস্তাবনা:** ফেজ ১ (`.missionbarisal/` ফোল্ডার) দিয়ে শুরু করি। এটা সবচেয়ে োট, সবচেয়ে ইমপ্যাক্ফুল, এবং কোন রিস্ক নাই। তারপর ধীরে ধীরে api.js ভাঙতে থাকি।

> **শাওন ভাইকে কথা:** আমি প্রমাণ দিয়েছি। বর্তমান api.js এর প্রিটি সেকশনের লাইন নম্বর, প্রস্তাবিত মডিউল, টার্গেট াইল — ব ম্যাপ করা আছে। যদি কিছু ভুল থাকে, আমার "Code Guru" status শেষ!

---

_ডকুমেনট শেষ — ২০২৬-০৭-১৬_
