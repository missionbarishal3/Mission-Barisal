# Mission Barisal — Unified Socket Architecture (USA)

> **ভাষা:** বাংলা (প্রযুক্তিগত Terms ইংরেজি)
> **ভার্সন:** 1.0.0
> **তারিখ:** 2026-07-16
> **লেখক:** Code Guru - Monu (Mission Barisal Architect)

---

## 📋 সূচিপত্র

1. [ভূমিকা — কেন এই আর্কিটেকচার?](#১-ভূমকা--কেন-এই-আর্কিটেকচার)
2. [বর্তমান সমস্যা — া আছে তা কেন যথেষ্ট না](#২-র্তমান-সমস্যা--যা-আছে-তা-কেন-যথেষ্ট-না)
3. [ইউজার কী বললেন — আমার বোঝা](#৩-ইউজার-কী-বললেন--আমার-বোঝা)
4. [Unified Socket Architecture — সম্পূর্ণ ডিজাইন](#৪-unified-socket-architecture--সম্ূর্ণ-ডিজাইন)
5. [ট্রান্সপোর্ট লেয়ার — কিভাব যোগাযোগ হয়](#৫-ট্রান্সপোর্ট-লেয়ার--কিভাবে-যোগাযোগ-হয়)
6. [রিকোয়েস্ট ফ্লো — একদম শুরু থেকে শেষ](#৬-রিকোয়েস্ট-ফ্লো--একদম-শুরু-থেকে-শেষ)
7. [টাইপ সেফটি  গোল সেটং — কখন, কোথায়, কিভাবে](#৭-টাইপ-সেফটি-ও-গোল-সেটিং--কখ-কোথায়-কিভাবে)
8. [ক্রস-ভেরিফিকেশন — সিঙ্গেল ও মাল্ি এজেন্ট](#৮-ক্রস-ভেরিফিকেশন--সিঙ্গেল-ও-মাল্টি-এজেন্ট)
9. [কম্পাইলার চেক — কোড ভেরিফিকেশন](#৯-কম্পাইলার-চেক--কোড-ভরিফিকেশন)
10. [কনটেক্সট ইঞ্জেকশন — সিলেবাস, SSOT, মেমোরি](#১০-কনটেক্সট-ইঞ্জেকশন--সিলেবাস-ssot-মেমোরি)
11. [হাতের লেখা — বাস্তবে কি হবে](#১১-হাতের-লেখা--বাস্তবে-কি-হবে)
12. [প্রত্যাশিত ফলাফল](#১২-প্রত্যাশিত-ফলাফ)
13. [কোড স্ট্রাকচার — কিভাবে ইমপ্লিমেন্ট করবো](#১৩-কোড-স্ট্রাকচার--কিভাবে-ইমপ্লিমেন্ট-করবে)

---

## ১. ভূমিকা — কেন এই আর্কিটেকচার?

**বর্তমান ওয়েব আর্কিটেচার** হলো Request-Response মডেল। ক্লায়েন্ট একটা HTTP POST রিকোয়েস্ট পাঠায়, সার্ভার প্রসেস করে রেসপন্স দেয়। এই মডেল ওয়েবের জন্য ঠিকই কাজ করে, কিন্তু **রিয়েল-টাইম AI এজেন্ট িস্টেমের জন্য** এটা যথেষ্ট না।

### সমস্যা:

```
প্রতি চ্যাট মেসেজ → নতুন POST রিকোয়েস্ট → নতুন কানেকশন
প্রতি মিশন রান → নতুন POST রিকোয়েস্ট → নতুন কানেকশন
প্রতি MCP কল → নতুন POST রিকোয়েস্ট → নতুন কানেকশন
প্রতি অ্যান্টি-োট চেক → নতুন POST রিকোয়েস্ট → নতুন কানেকশন
```

এতে **অহেতুক ওভারহেড** তৈি হয়। প্রতিবার TCP হ্যান্ডশেক, টিএলএস নেগোশিয়েশন, HTTP হেডার পার্সিং — যখন কানেকশনটা ইতিমধ্যে ওপেন থাকতে পারতো!

### মাধান:

একটা **সিঙ্গেল পার্সিস্টেন্ট কানেকশন** — যে কানেকশন দিয়ে সব টাইপের রিকোেস্ট যায়, আর সব টাইপের রেস্পন্স আসে ঠিক যেমন ইউনিক্স সকেট বা WebSocket কাজ করে।

---

## ২. বর্তমান সমস্যা — যা আছে তা কেন যথেষ্ট া

### ২.১ বর্তমান সার্ভার api.js-এর স্ট্রাকার:

```
POST /v1/chat/completions ──→ আলাদা HTTP কানেকশন (SSE স্ট্রিমিং সহ)
POST /api/mission        ──→ আলাদা HTTP কানেকশন (SSE স্ট্রিমিং সহ)
POST /api/v1/anti-dote   ──→ আলাদা HTTP কানেকশন
WS  /                    ──→ WebSocket (শুধু notification)
UDS mcp.sock             ──→ Unix Socket (শুধু MCP tools)
GET /mcp (SSE)           ──→ SSE (শুধু MCP streaming)
```

**প্রতি রিকোয়েস্ট আলাদা — এটা বাড়াবাড়ি!**

### ২.২ কেন এটা কাজ করে না:

| সমস্যা                   | বর্ণনা                                                     | উদাহরণ                                         |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| **বারবার হ্যান্ডশেক**    | প্রতি POST-এ নতুন TCP কানেকশন                              | Hermes ৫টা মেসেজ পাঠালে ৫টা আলাদা TCP কানেকশন  |
| **কনটেকসট রিপিট**      | প্রতি রিকোয়েস্টে সিলেবাস+SSOT+মেমোরি আলাদা কে পাঠাতে হয় | ১০টা রিকোয়েস্টে ১০বার SSOT লোড                 |
| **নো রিয়েল-টাইম**        | POST-এ রেস্পন্স আসার পর কানেকশন ক্লোজ                      | সার্ভার সাইড ইভেন্ট ক্লায়েন্টকে জানানো যায় না  |
| **থার্ড-পার্টি লিমিটেড** | WebSocket নন-স্ট্যান্ডার্ড, থার্ড-পার্টি বুঝে না           | Cursor/VS Code শুধু HTTP জানে                  |
| **রিডানডেন্ট কোড**       | প্রতি ট্রান্সপর্টের জন্য আলাদা হ্যান্ডার             | WS handler, UDS handler, HTTP handler সব আলাদা |

### ২.৩ লগ থেকে প্রমাণ:

```
[SESSION_CREATE] 04f54ab9 editor=hermes
[REQUEST] POST /v1/chat/completions → SSE streaming → done
[SESSION_REUSE] 04f54ab9 messages=1
[REQUEST] POST /v1/chat/completions → SSE streaming → done
[SESSION_REUSE] 04f54ab9 messages=2
[REQUEST] POST /v1/chat/completions → SSE streaming → done
```

**প্রতি মেসেজের জন্য আলাদা POST — অথচ WS কানেকশন ওপেন আছে!**

---

## ৩. ইউজার কী বললেন — আমার বোঝা

### ৩.১ ইউজারের মূল কথা:

```
"লোকাল ফাইল সিস্টেমের জন্য আমরা সরাসরি টেম্প ফোল্ডারের মধ্যে একটি ইউনিক কেট
তৈরি করে নিচ্ছি ফাইল ট ফাইল কথা বলছে... এখন যেটা আছে সে প্রতি িকোয়েস্ট
চাং বাই চাং ডাটা পাঠাচ্ছে... একটা রিকোয়েস্ট ওপেন হওয়ার পরে ওই পুর ইভেনট
চলতে থাকবে... আমাদের মূল আউটপুট পয়েন্ট: কম্পিটিশন, চ্যাট, মিশন, এমসিপি"

"প্রতি এডিটর ভত্তিক রিকোয়েস্টে সিলেবাস, SSOT, মেমোরি এজেন্টকে পাঠাতে হবে,
তা না হলে মনে রাখতে পারবে না, ফলো কবে না"

"প্যারামিটার রে ধরে: ইউজার ইনপুট → সিলেবাস চেক → SSOT দেখলো → মেমোরি দেখলো
→ নির্দিষ্ট ট্রান্সপোর্ট আউটপুট অুযায়ী যোগাযোগ"
```

### ৩.২ আমি যা বুঝলা (প্রমাণ সহ):

| ইউজার যা বলেছেন                | আমি যা বুঝলাম                                          | প্রমাণ (api.js কোড)                          |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------- |
| **Single Socket**              | সব রিকোয়েস্ট একটাই UDS/TCP সকেট দিয়ে যাবে              | UDS সকেট ইতিমধ্যে তৈরি (`mcp.sock`)          |
| **Chunk-by-chunk না**          | পুরো ইভেন্ট এক কানেকশনে স্ট্রিম হবে                    | SSE স্ট্রিমিং ইতিমধ্যে কাজ করে (`GET /mcp`)  |
| **৪টা আউটপুট পয়েন্ট**          | Competition, Chat, Mission, MCP                        | এগুলো ইতিমধযে api.js-এ আছে                 |
| **সিলেবাস+SSOT+মেমোরি পাঠানো** | প্রতি রিকোয়েস্টে কনটেক্সট ইঞ্জেক্ট করতে হবে            | `buildThreeFileContext()` ফাংশন ইতিমধ্যে আছে |
| **প্যারামিটার-ড্রিভেন**        | ইউজার ইনপুট → প্যারামিটার চেক → SSOT → মেমোরি → আউটপুট | `antiDoteCheckProof()` ইতিমধযে কাজ করে     |

### ৩.৩ আমার বোঝার সারমর্ম:

```
"একটা সিঙ্গেল সকেট কানেকশন (UDS/TCP) — এই সকেট দিয়েই সব রিকোয়েস্ট যাবে।
৪টা আউটপুট পয়েন্ট — Competition Router, Chat, Mission, MCP।
এডিটররা সকেট ইউজ করব, চ্যাট UI সকেট অথবা HTTP দুই-ই ইউজ করতে ারবে।
প্রতি রিকোয়েস্টে কনটেক্সট (সিলেবাস+SSOT+মেমোরি) অটোমেটিক অ্যাটাচ হবে।
ট্রান্সপোর্ট লেয়ার প্লাগেবল — UDS, TCP, WS, HTTP — সবই একই ব্যাকএন্ড ইউজ করবে।"
```

---

## ৪. Unified Socket Architecture — সম্পূর্ণ ডিজাইন

### ৪. আর্কিটেচার ডায়াগ্াম:

```
┌──────────────────────────────────────────────────────────┐
│                     ক্লায়ন্ট লেয়ার                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Editor   │  │ Chat UI  │  │  CLI/Term │  │3rd Party│  │
│  │(VS Code/  │  │ (Hermes) │  │          │  │ (Plugin)│  │
│  │ Cursor)   │  │          │  │            │         │  │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
└────────┼────────────┼─────────────┼──────────────┼────────┘
                     │             │              │
    ┌────▼────┐  ┌────▼────┐  ┌────▼────┐   ┌────▼────┐
    │UDS Socket│  │TCP:5001 │  │WS://    │   │HTTP POST│
    │ .sock   │  │(Win F/B)│  │:5000/   │   │:5000    │
    └────┬────┘  └────┬────┘  └────┬────┘   └────┬────┘
         │            │             │              │
         └────────────┼─────────────┼──────────────┘
                      │             │
              ┌───────▼─────────────▼───────────────┐
              │      ট্রানসপোর্ট অ্যাডাপ্টার        │
              │  (Transport Adapter Layer)           │
              │  JSON পার্স → রাউট → ডিসপ্যাচ       │
              └───────────────┬─────────────────────┘
                              │
              ┌───────────────▼──────────────────────┐
              │     ইউনিফায়ে মেসেজ ্যান্ডলার       │
              │        (handleMessage)                │
              │                                       │
              │  1. প্যারামিটার পার্স                 │
              │  2. সিলেবাস লোড                      │
              │  3. SSOT লোড                         │
              │  4. মেমোি লোড                       │
              │  5. সেশন ম্যানেজমেন্ট                │
              │  6. টাইপ সেফটি চেক                   │
              │  7. গোল সেটিং চেক                    │
              └───────────────┬──────────────────────┘
                              │
              ┌───────────────┼───────────────┐
                             │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌──────▼──────┐
        │Competition │  │   Chat    │  │   Mission   │
        │  Router    │  │ (Agent)   │  │ (Multi-Agent│
        │(Provider   │  │           │  │  Debate)    │
        │ Selection) │  │           │  │             │
        └─────┬─────┘  └─────┬─────┘  └──────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                      ┌───────▼──────┐
                      │  MCP / Tools  │
                      │  (File System,│
                      │   Web Search, │
                      │   Execute)    │
                      └───────────────┘
```

### ৪.২ মূল উপাদান:

| উপাদান                      | কাজ                                                                | অবস্থান                    |
| --------------------------- | ------------------------------------------------------------------ | -------------------------- |
| **Transport Adapter**       | সব ইনপুট ট্রান্সপোর্ট (UDS/TCP/WS/HTTP) কে এক ফরম্যাটে কনভার্ট করে | api.js (নতুন)              |
| **Unified Message Handler** | সব রিকোয়েস্টের জন্য সেন্ট্রাল ্রসেসর                            | api.js (নতুন)              |
| **Context Injector**        | সিলেবাস+SSOT+মেমোরি অটোমেটিক অ্যাটাচ করে                           | api.js (বিদ্যমান)          |
| **Type Safety**             | ইনপুট ্যালিডেশন + গোল ভেরিফিকেশন                                 | api.js (Anti-Dote সিস্টেম) |
| **Output Router**           | ৪টা আউটপুট পয়েন্টে রিকোয়েস্ট াউট কে                            | api.js (বিদ্যমান)          |

### ৪.৩ ডাটা ফরম্যাট — JSON মেসেজ প্রোটোকল:

```json
{
  "type": "chat | mission | competition | mcp | tool",
  "id": "uuid-1234",
  "transport": "uds | tcp | ws | http",
  "session_id": "04f54ab9",
  "agent_id": "code-guru",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "context": {
    "syllabus": "..." | null,
    "ssot": "..." | null,
    "memory": "..." | null,
    "workspace": "/path/to/project"
  },
  "params": {
    "temp": 0.7,
    "stream": true,
    "max_tokens": 4096
  }
}
```

**রেস্পন্স ফরম্যা (স্ট্রিমিং):**

```json
{
  "type": "stream_chunk",
  "id": "uuid-1234",
  "data": {
    "content": "Hello! আমি আপনার...",
    "done": false
  },
  "context": {
    "syllabus_used": true,
    "ssot_used": true,
    "memory_used": true,
    "agent": "code-guru",
    "provider": "opencode"
  }
}
```

**রেস্পন্স ফরম্যাট (ডা):**

```json
{
  "type": "response_done",
  "id": "uuid-1234",
  "data": {
    "content": "...পুরো রেস্পন্স...",
    "done": true
  },
  "verification": {
    "type_safe": true,
    "goal_met": true,
    "cross_verified": true,
    "compiler_checked": false
  },
  "usage": {
    "prompt_tokens": 250,
    "completion_tokens": 150,
    "total_tokens": 400,
    "provider": "opencode",
    "model": "deepseek-v4-flash-free"
  }
}
```

---

## ৫. ট্রান্সপোর্ট লেয়ার — কভাবে যোগাযগ হয়

### ৫.১ ট্রান্পোর্টের প্রকার:

| ট্রান্সপোর্ট                 | পোর্ট/পাথ                   | কখন ব্যবহার হয়             | প্ল্যাটফর্ম |
| ---------------------------- | --------------------------- | -------------------------- | ----------- |
| **UDS (Unix Socket)**        | `.zombiecoder/mcp.sock`     | Editors (VS Code, Cursor)  | Linux/Mac   |
| **TCP Loopback**             | `127.0.0.1:5001`            | Editors (Windows Fallback) | Windows     |
| **WebSocket**                | `ws://localhost:9999/`      | Real-time clients (Hermes) | সব          |
| **SSE (Server-Sent Events)** | `http://localhost:9999/mcp` | MCP streaming (JetBrains)  | সব          |
| **HTTP POST**                | `http://localhost:9999/...` | Third-party tools, Chat UI | সব          |
| **HTTP GET**                 | `http://localhost:9999/...` | Status, Health, Config     | সব          |

### ৫.২ টরান্সপোর্ট অ্যাডাপ্টার প্যাটার্ন:

```javascript
// ─── Transport Adapter Interface ───
// প্রত্যেক ট্রান্সপোর্টের জন্য একই ইন্টারফেস

class TransportAdapter {
  constructor(transportType, socket_or_res) {
    this.type = transportType; // 'uds' | 'tcp' | 'ws' | 'http' | 'sse'
    this.conn = socket_or_res;
  }

  // মেসেজ ডিকোড
  decode(rawData) {
    return JSON.parse(rawData);
  }

  // মেসেজ এনকোড ও সেন্ড
  send(data) {
    const raw = JSON.stringify(data);
    switch (this.type) {
      case "uds":
      case "tcp":
        this.conn.write(raw + "\n");
        break;
      case "ws":
        sendWSFrame(this.conn, 0x81, raw);
        break;
      case "http":
        this.conn.writeHead(200, { "Content-Type": "application/json" });
        this.conn.end(raw);
        break;
      case "sse":
        this.conn.write("data: " + raw + "\n\n");
        break;
    }
  }

  // স্ট্রিমিং চাঙ্ক সেন্ড
  stream(data) {
    switch (this.type) {
      case "uds":
      case "tcp":
        this.conn.write(JSON.stringify({ ...data, stream: true }) + "\n");
        break;
      case "ws":
        sendWSFrame(this.conn, 0x81, JSON.stringify({ ...data, stream: true }));
        break;
      case "sse":
        this.conn.write("data: " + JSON.stringify(data) + "\n\n");
        break;
      case "http":
        this.conn.write("data: " + JSON.stringify(data) + "\n\n");
        break;
    }
  }

  // কানেকশন ক্লো
  close() {
    try {
      this.conn.end();
    } catch (e) {}
    try {
      this.conn.destroy();
    } catch (e) {}
  }
}
```

### ৫.৩ ট্রানসপোর্ট নির্বাচনের লজিক:

```javascript
function getTransport(req, socket) {
  if (socket?.constructor?.name === "Socket") {
    // UDS বা TCP সকেট
    return new TransportAdapter("uds", socket);
  }
  if (req?.headers?.["upgrade"] === "websocket") {
    // WebSocket
    return new TransportAdapter("ws", socket);
  }
  if (req?.headers?.["accept"]?.includes("text/event-stream")) {
    // SSE
    return new TransportAdapter("sse", res);
  }
  // Default: HTTP
  return new TransportAdapter("http", res);
}
```

### ৫.৪ ট্রানসপোর্ট ব্রিজিং:

```
UDS Socket  ──→ Transport Adapter ──→ handleMessage() ──→ Transport Adapter ──→ Response
TCP Socket  ──→ Transport Adapter ──→ handleMessage() ─→ Transport Adapter ──→ Response
WebSocket   ──→ Transport Adapter ──→ handleMessage() ──→ Transport Adapter ──→ Response
HTTP POST   ──→ Transport Adapter ─→ handleMessage() ──→ Transport Adapter ──→ Response
```

**মূলকথা:** ট্রান্সপোর্ট যাই হোক না কেন, `handleMessage()` ফাংশনটা একই। শুধু ইনপুট/আউটপুট পদ্ধতি বদলায় — ট্রান্সপোর্ট অ্যাডাপ্টারের মাধ্যমে।

---

## ৬. রিকোয়েস্ট ফ্লো — একদম শুরু থেকে শেষ

### ৬.১ সম্পূর্ণ ফ্ো ডায়াগাম:

```
ইউজার ইনপুট (Hermes/Editor/CLI)
        │
        ▼
┌───────────────────────────────┐
│  Transport Layer              │
│  UDS/TCP/WS/HTTP              │
│   Transport Adapter          │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  1. প্যারামিটার পার্স         │
│     → type, id, session_id    │
│     → agent_id, messages      │
│     → context, params         │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────
│  2. কনটেক্সট ইঞ্জেকশন        │
│     → Session Load/Reuse     │
│     → Syllabus Load (cache)  │
│     → SSOT Load (project)    │
│     → Memory Load (history)  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  3. টাইপ সেফটি চেক           │
│     (Anti-Dote System)        │
│     → Input Validation        │
│     → Schema Check            │
│     → Type Safety Verification│
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  4. গোল সেটিং চেক            │
│     → Goal Verification       │
│     → Output Constraints      │
│     → Proof Check             │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  5. আউটপুট পেন্ট রাউটিং    │
│                               │
│  type === 'chat' ───→ Agent Call│
│  type === 'mission' → Multi-Agent│
│  type === 'competition' → Router│
│  type === 'mcp' ───→ MCPhandler│
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  6. এজেন্ট এক্সিকিউশন        │
│     → Competition Router      │
│     → Provider Selection      │
│     → Model Call (stream)    │
└───────────┬───────────────────┘
            │
            ▼
┌──────────────────────────────┐
│  7. আউটপুট প্রসেসি          │
│     → Cross-Verification      │
│     → Compiler Check (code)   │
│     → Identity Masking        │
│     → Watermark Stripping     │
└──────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  8. রেস্পন্স স্ট্রিমং       │
│     → Chunk by chunk          │
│     → Same Transport          │
│     → Final [DONE] signal    │
└───────────┬───────────────────┘
            │
            ▼
        উজার রিসিভ করে
```

### ৬.২ সিকোয়েন্স ডায়াগ্রাম (প্রয়োগিক):

```
Editor              UDS/TCP Socket           handleMessage()          Agent/Provider
  │                      │                        │                      │
  │──── JSON msg ───────>│                        │                      │
  │                      │── parseMessage() ─────>│                      │
  │                      │                        │── loadContext() ────>│
  │                      │                        │<── context ok ──────│
  │                      │                        │                      │
  │                      │                        │── typeSafetyCheck()─>│
  │                      │                        │<── safety ok ───────│
  │                      │                        │                      │
  │                      │                        │── goalCheck() ──────>│
  │                      │                        │<── goal ok ─────────│
  │                      │                        │                      │
  │                      │                        │── routeToOutput() ──>│
  │                      │                        │                      │
  │                      │                        │── modelCall() ──────>│
  │                      │                        │                      │
  │                      │<─ stream chunk ────────│                      │
  │<── stream chunk ─────│                        │                      │
  │                      │                        │                      │
  │                      │<─ stream chunk ────────│                      │
  │<── stream chunk ─────│                        │                      │
  │                      │                        │                      │
  │                      │<─ [DONE] signal ───────│                      │
  │<── [DONE] ───────────│                        │                      │
```

---

## ৭. টাইপ সেফটি ও গোল সেটিং — কখন, কোথায়, কিভাবে

### ৭.১ টাইপ সেফটি (Anti-Dote System):

**কখন হয়:** স্টেপ ৩ — কনটেক্সট লোড হওয়ার পর, এজেন্ট কল করার আগে।

**কোথায় হয়:** `antiDoteChain()` ফাংশনে — api.js-এ Anti-Dote Type Safety সিস্টে।

**কিভাবে হয়:**

```javascript
async function typeSafetyCheck(contract, transport) {
  // ─── Step 1: Input Schema Validation ───
  const schemaValid = validateInputSchema(contract);
  if (!schemaValid) {
    transport.stream({
      type: "error",
      error: "Input schema validation failed",
      code: "SCHEMA_ERROR",
    });
    return { passed: false };
  }

  // ─── Step 2: Proof Check ───
  const { provable, error } = antiDoteCheckProof(contract);
  if (!provable) {
    transport.stream({
      type: "error",
      error: error.message,
      code: "PROOF_ERROR",
    });
    return { passed: false };
  }

  // ─── Step 3: Consent Check ───
  if (!contract.consent.granted) {
    transport.stream({
      type: "consent_required",
      message: "User consent needed before execution",
      contract_id: contract.id,
    });
    // সকেট ওপেন থাকে — ইউজার কনসেন্ট দিলে চলতে থাকে
    return { passed: false, pending: true };
  }

  return { passed: true };
}
```

### ৭.২ োল সেটিং:

**কখন হয়:** স্টেপ ৪ — টাইপ সেফটি পাস হওয়র পর।

**কোথায় হয়:** `verifyGoalOutput()` ফাংশনে — api.js-এ।

**কিভাবে হয়:**

```javascript
async function goalSettingCheck(userInput, agentContext, transport) {
  // ─── Step 1: Goal Definition ───
  const goal = {
    input: userInput,
    expected_output_type: inferOutputType(userInput),
    constraints: extractConstraints(userInput),
    verification_criteria: ["proof_required", "code_safe", "test_verified"],
  };

  transport.stream({
    type: "goal_set",
    goal: {
      expected: goal.expected_output_type,
      constraints: goal.constraints,
    },
  });

  // ─── Step 2: Goal Verification (আউটপুট আসার পর) ───
  // এই চেকটা আউটপুট জেনারেট হওয়ার পরে হবে
  return goal;
}
```

### ৭.৩ ফ্লোতে অবস্থান:

```
ইনপুট আসলো
    │
    
[1] প্যারামিটার পার্স ◄── এখানে ইউজারের গোল বোঝা যায়
    │
    ▼
[2] কনেক্সট ইঞ্জেক্ট ◄── সিলেবাস+SSOT+মেমোরি
    │
    ▼
[3] টাইপ সেফটি ◄── সকিমা+প্রুফ+কনসেন্ট
    │
    ▼
[4] গোল সেটিং ◄── কী আউটপুট চাই, কী কনস্ট্রেইন্ট
    │
    ▼
[5] আউটপুট পয়েন্ট াউটিং
    │
    ▼
[6] এজেনট এক্সিকিউশন
    │
    ▼
[7] আটপুট ভেরিফিকেশন ◄── গোল মেট হলো কিনা চেক
    │
    ▼
[8] ক্রস-ভেরিফিকেশন ◄── জেন্টের উত্তর যাচাই
    │
    ▼
[9] কম্পাইলার চেক ◄── কড থাকলে চেক
    │
    ▼
[10] রেস্পন্স স্ট্রিমিং
```

---

## ৮. ক্রস-ভেরিফিকেশন — সিঙ্গেল ও মাল্টি এজেন্ট

### ৮.১ মাল্টি-এজেন্ট ক্রস-ভেরিফিকেশন (মিশন মোড):

**কিভাবে কাজ করে (বর্তমানে api.js-এ):**

```javascript
async function crossVerifyMultiAgent(results) {
  const verification = {
    passed: false,
    score: 0,
    checks: [],
    agents_responded: [],
    consensus: false,
  };

  // ─── Step 1: সকলে রেস্পন্ড করলো কিনা ───
  const allResponded = results.every((r) => r.content && r.content.length > 0);
  verification.checks.push({
    check: "all_agents_responded",
    passed: allResponded,
    count: results.filter((r) => r.content).length,
    total: results.length,
  });

  // ─── Step 2: Consensus চেক ───
  // সব এজেন্টের উত্ত কি একই দিকে? নাকি ভিন্নমত?
  const contents = results.map((r) => r.content.toLowerCase());
  const consensus = checkConsensus(contents);
  verification.checks.push({
    check: "agent_consensus",
    passed: consensus.score > 0.6,
    score: consensus.score,
    agreements: consensus.agreeCount,
    disagreements: consensus.disagreeCount,
  });

  // ── Step 3: Evidence Check ───
  // প্রতিটি এজেন্ট প্রুফ দিয়েছে কিনা
  const hasEvidence = results.every((r) => hasProof(r.content));
  verification.checks.push({
    check: "evidence_check",
    passed: hasEvidence,
  });

  // ─── Step 4: Debate Conducted ───
  // মাল্ট-এজেন্ট ডিবেট হয়েছে িনা
  verification.checks.push({
    check: "debate_conducted",
    passed: results.length >= 3, // কমপক্ষে ৩টা এজেন্ট
  });

  verification.score =
    verification.checks.filter((c) => c.passed).length /
    verification.checks.length;
  verification.passed = verification.score >= 0.7;

  return verification;
}
```

### ৮.২ সিঙ্গেল এজেন্ট ক্রস-ভেরিফিকেশন (নতুন):

**কিভাবে কাজ করবে:**

```javascript
async function crossVerifySingleAgent(
  agentResult,
  userInput,
  context,
  transport,
) {
  const verification = {
    passed: false,
    score: 0,
    checks: [],
    type: "single_agent",
  };

  transport.stream({
    type: "cross_verify_start",
    mode: "single_agent",
  });

  // ─── Step 1: Self-Consistency Check ───
  // এজেন্ট কি নিজের সাথে কন্ট্রাডিক্ট করছে?
  const selfConsistent = checkSelfConsistency(agentResult.content);
  verification.checks.push({
    check: "self_consistency",
    passed: selfConsistent,
    detail: selfConsistent
      ? "Agent did not contradict itself"
      : "Agent contradicted itself",
  });
  transport.stream({
    type: "cross_verify_check",
    check: "self_consistency",
    status: selfConsistent ? "PASSED" : "FAILED",
  });

  // ─── Step 2: Evidence Verification ───
  // এজেনট যা বলেছে, তার প্রমাণ আছে কি না?
  const proofVerified = verifyEvidence(agentResult.content, context);
  verification.checks.push({
    check: "evidence_verified",
    passed: proofVerified,
    detail: proofVerified
      ? "All claims have supporting evidence"
      : "Some claims lack evidence",
  });
  transport.stream({
    type: "cross_verify_check",
    check: "evidence_verified",
    status: proofVerified ? "PASSED" : "FAILED",
  });

  // ─── Step 3: Reference Check ───
  // এজেনট কি ইউজারর ইনপুট, ফাইল কন্টেক্সট, কোড রেফারেন্স দিয়েছে?
  const hasReferences = checkReferences(
    agentResult.content,
    userInput,
    context,
  );
  verification.checks.push({
    check: "has_references",
    passed: hasReferences,
    detail: hasReferences
      ? "Agent referenced user input and context"
      : "Agent did not reference context",
  });
  transport.stream({
    type: "cross_verify_check",
    check: "has_references",
    status: hasReferences ? "PASSED" : "FAILED",
  });

  // ─── Step 4: Goal Achievement Check ───
  // ইউজার া চেয়েছিল, এজেন্ট তা দিয়েছে কি না?
  const goalMet = checkGoalAchievement(agentResult.content, userInput);
  verification.checks.push({
    check: "goal_achieved",
    passed: goalMet,
    detail: goalMet
      ? "Output matches user request"
      : "Output does not fully address user request",
  });
  transport.stream({
    type: "cross_verify_check",
    check: "goal_achieved",
    status: goalMet ? "PASSED" : "FAILED",
  });

  // ─── Step 5: Code Safety Check (যদি কোড থাকে) ───
  if (containsCode(agentResult.content)) {
    const codeSafe = checkCodeSafety(agentResult.content);
    verification.checks.push({
      check: "code_safe",
      passed: codeSafe,
      detail: codeSafe
        ? "Code appears safe"
        : "Code contains dangerous patterns",
    });
    transport.stream({
      type: "cross_verify_check",
      check: "code_safe",
      status: codeSafe ? "PASSED" : "FAILED",
    });
  }

  verification.score =
    verification.checks.filter((c) => c.passed).length /
    verification.checks.length;
  verification.passed = verification.score >= 0.6;

  transport.stream({
    type: "cross_verify_done",
    result: verification.passed ? "PASSED" : "FAILED",
    score: verification.score,
    checks: verification.checks,
  });

  return verification;
}
```

### ৮.৩ সি্গেল বনাম মা্টি-এজেন্ট ক্রস-ভেরিফিকেশন তুলনা:

| দিক                   | মাল্টি-এজেন্ট (Mission)    | সিঙ্গেল-এজেন্ট (Chat)                    |
| --------------------- | -------------------------- | ---------------------------------------- |
| **ভেরিফিকেশন পদ্ধতি** | Consensus → Debate → Merge | Self-Consistency → Evidence → References |
| **এজেন্ট সংখ্যা**     | ৬ (সবগুলো)                 | ১                                        |
| **চেক পয়েন্ট**        | ৪-৫টা চেক                  | ৪-৫টা চেক (কম হেভি)                      |
| **ফল আউটপুট**         | Merged response            | Direct response                          |
| **রোবাস্টনেস**        | বেশি (ডিবেট হয়)            | মাঝারি (সেলফ-চেক)                        |
| **স্পিড**             | ধীর (সব এজেন্ট রান)        | দ্রুত (এক এজেন্ট)                        |

---

## ৯. কম্াইলার চেক — কোড ভেরিফিকেশন

### ৯.১ কখন হয়:

কম্পাইলার চেক তখনই হয় যখন এজেন্টের উটপুটে কোড থাকে এটা স্টেপ ৯ — আউটপুট ভেরিফিকেশনের পর, রেস্পন্স স্ট্রিমিংয়ের আগে।

### ৯.২ কিভাবে হয়:

```javascript
async function compilerCheck(content, language, transport) {
  if (!containsCode(content)) {
    return { passed: true, skipped: true, reason: "No code in response" };
  }

  transport.stream({
    type: "compiler_check_start",
    language: language || "auto-detected",
  });

  const checks = [];

  // ─── Syntax Check ───
  // Code block গুলো ক্সট্রাক্ট করে সিনট্যক্স চেক
  const codeBlocks = extractCodeBlocks(content);
  for (const block of codeBlocks) {
    const syntax = checkSyntax(block.code, block.language);
    checks.push({
      file: block.language,
      check: "syntax",
      passed: syntax.valid,
      errors: syntax.errors,
    });
    transport.stream({
      type: "compiler_check_result",
      block: block.language,
      check: "syntax",
      status: syntax.valid ? "PASSED" : "FAILED",
      errors: syntax.errors,
    });
  }

  // ─── Dependency Check ───
  // কোডে উল্লেখত লাইব্রেরি/ফাংশন ি আসলেই আছে?
  if (context?.ssot) {
    const deps = checkDependencies(codeBlocks, context.ssot);
    checks.push(...deps);
  }

  // ─── Security Pattern Check ───
  // ডেঞ্জারাস প্যাটার্ন (exec, eval, rm -rf) চেক
  const security = checkSecurityPatterns(content);
  checks.push({
    check: "security",
    passed: security.safe,
    warnings: security.warnings,
  });

  const allPassed = checks.every((c) => c.passed);
  transport.stream({
    type: "compiler_check_done",
    result: allPassed ? "ALL_PASSED" : "SOME_FAILED",
    checks: checks,
  });

  return { passed: allPassed, checks };
}
```

### ৯. কম্পাইলার চেকের ধরণ:

| চেকের ধরণ      | কি চেক করে                       | ব্যর্থ হলে কি হয়                  |
| -------------- | -------------------------------- | --------------------------------- |
| **Syntax**     | জেএস/পাইথ/etc সিনট্াক্স এরর  | ওয়ার্নিং + ফিক্স সুজেস্ট          |
| **Dependency** | ফাইল/লাইব্রেরি রেফারেন্স ভেরিফাই | ওয়ার্নং + সঠিক পাথ সুজেস্ট     |
| **Security**   | `eval()`, `exec()`, `rm -rf`     | ব্লক + সিকিউর অল্টারনেটিভ সুজেস্ট |
| **Path**       | ফাইল পাথ ভ্যালিড িনা           | ওয়ার্নিং                          |
| **API**        | এনভি/এপিআই কি ঠিক আছে?           | ওয়ার্নিং                          |

---

## ১০. কনটেক্সট ইঞ্জেকশন — সিলেবাস, SSOT, মেমোরি

### ১০.১ কেন কনটেক্সট ইঞ্জেক্ট করতে হবে?

এজেন্টরা **স্টেটলেস** — তারা আগের রিকোয়েস্টের কথা মনে রাখে না। তাই প্রতিবারই তাদের জানিয়ে দিতে হে:

- **কি প্রজেক্টে কাজ করছে** (SSOT)
- **কি শিখেছে আগে** (িলেবাস)
- **আগে কি আলোচনা হয়েে** (মেমোরি)
- **কি কি নিয়ম মেনে চলতে হবে** (পার্সোনা + ইনস্ট্রাকন)

### ১০.২ কনটেক্সট ইঞ্জেকশন ফলো:

```javascript
async function injectContext(sessionId, workspace, agentId) {
  const context = {};

  // ─── 1. SSOT Load ───
  // প্রজেক্ট স্ট্রাকচার, ফাইল, টেক স্ট্যাক
  context.ssot = readSSOT(workspace);
  if (!context.ssot) {
    context.ssot = autoSSOT(workspace);
  }

  // ─── 2. Syllabus Load ───
  // এজেন্টরা আগে কি শিখেছ
  context.syllabus = readSyllabus(workspace);

  // ─── 3. Memory Load ───
  // এই সেশনের আগের আলোচনা
  context.memory = getAgentMemory(sessionId, agentId);
  context.sessionMemory = getSessionMemory(sessionId);

  // ─── 4. Three-File System ───
  const threeFileContext = buildThreeFileContext(workspace);

  // ─── 5. Merge ───
  const mergedContext = `
📋 PROJECT CONTEXT (SSOT):
${context.ssot || "Not available (run autoSSOT first)"}

📚 LEARNED KNOWLEDGE (Syllabus):
${context.syllabus || "Not available"}

💾 SESSION HISTORY (Memory):
${context.sessionMemory || "No previous conversation"}
`;

  return mergedContext;
}
```

### ১০.৩ কনটেক্সট ইঞ্জেকশন ইমপ্যাক্ট:

| ছাড়া                                   | সাথে                                 |
| -------------------------------------- | ------------------------------------ |
| এজেন্ট জনে না কোন প্রজেক্টে কাজ করছে | এজেন্ট পুরো প্রজেক্ট স্ট্রাকচার জানে |
| এজেন্ট ভুলে গেছে আগে কি হয়েছিল         | এজেন্ট আগের সব কথার কনটেক্সট পায়     |
| এজেন্ট জানে না কি নিয়ম মানতে হবে       | এজেন্ট পার্সোনা + গাইডলাইন ফলো করে   |
| এজেন্ট প্রমাণ ছাড়া কথা বলে             | এজেন্ট জানে প্রমাণ দিতেই হবে         |
| এজেন্ট মডেল আইডেনটিটি লিক করে          | এজেন্ট মাস্ক করে                     |

---

## ১১. হাের লেখা — বাস্তবে কি হবে

### ১১.১ এখন যা আছে (api.js) — বর্তমান অবস্থা:

```
UDS Socket ──→ handleUdsMcpMessage() ──→ MCP Tools only
TCP Socket ──→ HTTP/2 check ──→ http.Server ──→ Routes
WebSocket ──→ chat/mcp/ping handler
HTTP POST ──→ Route handler (chat, mission, anti-dote)
SSE GET ──→ MCP streaming
```

**প্রতি ট্রান্সপোর্টের জন্য আলাদা হ্যান্ডলার — কোনো ইউনিফাইড লেয়ার নেই!**

### ১১.২ hamba.js আপডেটের প যা হয়েছে:

- ✅ `const net = require("net")` — net module যোগ
- ✅ `sseClients` Map — SSE ট্র্যাকিং
- ✅ `UDS_PATH` + `udsServer` — UDS সার্ভার
- ✅ `handleUdsMcpMessage()` — UDS MCP হ্যান্ডলার
- ✅ HTTP/2 preface detection
- ✅ TCP wrapper with `net.createServer`
- ✅ `GET /mcp` SSE endpoint
- ✅ `X-Accel-Buffering: no` headers
- ✅ `init()` + `shutdown()` + cleanup
- ✅ Windows TCP fallback (port 5001)

### ১১.৩ এখন যা বাকি (এই ডকুমেন্ট অনুযায়ী):

| বাকি কাজ                            | অবস্থা   | কোথায় হব                       |
| ----------------------------------- | -------- | --------------------------------- |
| **Unified Message Handler**         | ❌ বাকি  | নতুন `handleMessage()` ফাংশন      |
| **Transport Adapter**               |  বাকি | নতুন `TransportAdapter` ক্লাস     |
| **সিঙ্গেল এজেন্ট ক্রস-ভেরিফিকেশন**  | ❌ বাকি  | `crossVerifySingleAgent()` ফাংশন  |
| **কম্পালার চেক এক্সপ্যানশন**      | ❌ বাকি  | `compilerCheck()` ফাংশন           |
| **অটো-কনটেক্সট ইঞ্জেকশন**           | ❌ বাকি  | `injectContext()` ফাংশন           |
| **সব ট্রান্সপোর্ট → এক হ্যান্ডলার** | ❌ বাকি  | UDS/TCP/WS/HTTP → handleMessage() |

### ১১.৪ বাস্তবে হবে যা (প্রত্যাশিত লগ):

```
ক্লায়েন্ট (Hermes) WebSocket কানেক্ট করলো:
[INFO] [WS_CONNECTED] client=hermes session=04f54ab9

ইউজার মেসেজ পাঠালো (প্রথমবার):
[INFO] [MESSAGE_RECEIVED] transport=ws type=chat
[INFO] [CONTEXT_INJECTED] ssot=true syllabus=true memory=true
[INFO] [TYPE_SAFETY_PASSED] schema=true proof=true consent=true
[INFO] [GOAL_SET] type=question constraints=none
[INFO] [AGENT_CALL] agent=code-guru model=deepseek-v4
[INFO] [CROSS_VERIFY_SINGLE] score=0.8 passed=true
[INFO] [STREAM_COMPLETE] elapsed=5000ms

ইউজার আবার মেসেজ পাঠালো (কই কানেকশন):
[INFO] [MESSAGE_RECEIVED] transport=ws type=chat
[INFO] [CONTEXT_INJECTED] ssot=cached syllabus=cached memory=loaded
[INFO] [TYPE_SAFETY_PASSED] schema=true proof=true consent=true
[INFO] [GOAL_SET] type=question constraints=none
[INFO] [AGENT_CALL] agent=code-guru model=deepseek-v4
[INFO] [STREAM_COMPLETE] elapsed=3500ms

ইউজার কোড চাইলো:
[INFO] [MESSAGE_RECEIVED] transport=ws type=chat
[INFO] [COMPILER_CHECK] language=javascript syntax=true security=true
[INFO] [CROSS_VERIFY_SINGLE] score=0.9 passed=true
[INFO] [STREAM_COMPLETE] elapsed=6000ms
```

**কোনো POST রিকোয়েস্ট নেই — শুধু একটি ওপেন WebSocket কানেকশন!**

---

## ১২. প্রত্যাশিত ফলাফল

### ১২.১ কর্মক্ষমতা (Performance):

| মেট্রিক                | আগে                    | পরে                 | উন্নতি         |
| ---------------------- | ---------------------- | ------------------- | -------------- |
| **TCP কানেকশন কাউন্ট** | ৫টা/সেশন               | ১টা/সেশন            | **৮০% কম**     |
| **রিকোয়েস্ট ওভারহেড**  | ~৫০০μs/প্রতি           | ~১০০μs/প্রতি        | **৫x ফাস্ট**   |
| **কনটেক্সট লোড টাইম**  | ~২০০μs/পরতি (ডিস্ক) | ~৫০μs/প্রতি (ক্যাশ) | **৪x ফাস্ট**   |
| **মেমোরি ইউজ**         | বেশি (একাধিক কানেকশন)  | কম (এক কানেকশন)     | **৩০% কম**     |
| **রেস্পন্স টাইম**      | ৫০০০ms (POST+SSE)      | ৩৫০০ms (Socket)     | **৩০% দরুত** |

### ১২.২ েভেলপার এক্সপেরিয়েন্স:

| দিক                          | আগে                  | পরে                      |
| ---------------------------- | -------------------- | ------------------------ |
| **Hermes ইউজার**             | বারবার POST → SSE    | একবার WS → সব স্ট্রিম    |
| **Editor (VS Code)**         | UDS শুধু MCP-এর জন্য | UDS দয়ে চ্যাট/মিশন/সব |
| **Chat UI ডেভেলপার**         | HTTP বুঝতে হবে       | WS বা HTTP — দুটোই চলে   |
| **থার্ড-পার্টি ইন্টিগ্রেশন** | শুধু HTTP            | HTTP + Socket (নতুন)     |

### ১২.৩ র‍িায়েল-টাইম কপাবিলিটি:

- **এজেন্ট স্ট্যাটা আপডট:** এজেন্ট খন কাজ করছে, তখন ক্লায়েন্ট রিয়েল-টাইম দেখতে পাবে
- **প্রোগ্রেস ইন্ডিকেটর:** কোন এজেন্ কি করছে, কতটুকু হো — সব স্ট্রিম হে
- **ন্টারাপ্ট:** ইউজার মাঝপথে বলতে পারবে "থামো" — সকেট ওপেন থাকায় কমান্ড পাঠানো যাবে
- **মাল্টি-ক্লায়েন্ট:** একাধিক ক্লায়েন্ট একই সার্ভারে কানেক্ট থাকতে পারে

### ১২.৪ স্থিতিস্থাপকতা (Resilience):

| বিষয়                  | সমাধান                                          |
| --------------------- | ----------------------------------------------- |
| **কানেকশন ড্রপ**      | ক্লায়েন্ট টো-রিকানেক্ট (প্রতি ৫সে)           |
| **সকেট ফাইল ক্র্যাশ** | `shutdown()`-এ `.sock` ফাইল ক্লিাপ           |
| **ডাবল কানেক্ট**      | একই client_id-এর পুরনো কানেকশন ক্লোজ            |
| **রিকোয়েস্ট টাইমআউট** | ৩০সে টাইমআউট → এরর রেস্পন্স → কানেকশন ওপেন থাকে |

---

## ১৩. কড স্ট্রাকচার — কিভবে ইমপ্লিমেন্ট করবো

### ১৩.১ api.js-এ নতুন ফাংশন যোগ:

```javascript
// ══════════════════════════════════════════════════════════════
//  🎯 ইউিফায়েড মেসেজ হ্যান্ডলার
// ══════════════════════════════════════════════════════════════
// সব ট্রান্সপোর্ট (UDS/TCP/WS/HTTP) থেকে মেসেজ এখানে আসে
// ══════════════════════════════════════════════════════════════

async function handleMessage(transport, rawMessage) {
  try {
    // Step 1: Parse
    const msg = transport.decode(rawMessage);

    // Step 2: Session + Context
    const session = getOrCreateSession(msg);
    const context = await injectContext(
      session.id,
      mcpWorkingDir,
      msg.agent_id,
    );

    // Step 3: Type Safety
    const typeSafe = await typeSafetyCheck(msg, context, transport);
    if (!typeSafe.passed) return;

    // Step 4: Goal Setting
    const goal = await goalSettingCheck(msg, context, transport);

    // Step 5: Route to Output Point
    switch (msg.type) {
      case "chat":
        return handleChat(transport, msg, context, goal);
      case "mission":
        return handleMission(transport, msg, context, goal);
      case "competition":
        return handleCompetition(transport, msg, context, goal);
      case "mcp":
        return handleMCPMessage(transport, msg);
      case "tool":
        return handleToolCall(transport, msg);
      default:
        transport.stream({ type: "error", error: "Unknown type: " + msg.type });
    }
  } catch (e) {
    transport.stream({ type: "error", error: e.message });
  }
}
```

### ১৩.২ ট্রান্সপোর্ট ্যাডাপ্টার ইন্টিগ্রেশন:

```javascript
// UDS Socket → handleMessage
udsServer.on("connection", (socket) => {
  const transport = new TransportAdapter("uds", socket);
  socket.on("data", (data) => {
    handleMessage(transport, data);
  });
});

// TCP Socket → handleMessage
tcpServer.on("connection", (socket) => {
  const transport = new TransportAdapter("tcp", socket);
  socket.on("data", (data) => {
    handleMessage(transport, data);
  });
});

// WebSocket → handleMessage
websocketServer.on("connection", (ws) => {
  const transport = new TransportAdapter("ws", ws);
  ws.on("message", (data) => {
    handleMessage(transport, data);
  });
});

// HTTP → handleMessage
server.on("request", (req, res) => {
  if (req.url === "/api/input") {
    readBody(req).then((body) => {
      const transport = new TransportAdapter("http", res);
      handleMessage(transport, body);
    });
  } else {
    // Existin route handling...
  }
});
```

### ১৩.৩ ইমপ্লিমেন্টেশনের স্টেপ:

```
ফেজ ১: বেস স্ট্রাকচার
├── TransportAdapter ক্লাস তৈরি
├── handleMessage() ফাংশন তৈরি
├── injectContext() ফাংশন তৈরি
└── crossVerifySingleAgent() ফাংশন তৈরি

ফেজ ২: ইন্টিগরেশন
├── UDS সকেট → handleMessage() কল
├── TCP সকেট → handleMessage() কল
├── WebSocket → handleMessage() কল
├── HTTP POST /api/input → handleMessage() কল
├── Existing POST routes পুনঃব্যবহার
└── হ্যান্ডলার ইউনিফিকেশন

ফেজ : অপ্টিমাইজেশন
├── কনটেক্সট ক্যাশিং
├── কানেকশন পুলিং
├── রিকানেকট লজিক
├── লোড ব্যালেন্সিং
└── মিটরিং + লগিং
```

---

## 🎯 উপসংহার

### আমি যা বুঝলাম:

ইউজার চান **একটি সিঙ্গেল সকেট কানেকশন** — UDS (Linux) বা TCP (Windows) — যা দিয়ে সব রিকোয়েস্ট যায়। ৪টা আউটপুট য়েন্ট (Competition, Chat, Mission, MCP) এর মাধ্যমে ুলস ও এজেন্ট োগাযোগ করে। এডিটররা সকেট ইউজ করে, চ্যাট UI সকেট বা HTTP — দুই-ই ইউজ করত পারে। প্রতি রিকোয়েস্টে অটোমেটিক সিলেবাস+SSOT+মেমোরি ইঞ্জেক্ট হয়, যাতে এজেন্ট কনটেক্ট না হারায়। টইপ সেফটি, গোল সেটিং, ক্রস-ভেরিফিকেশ, কম্পাইলার চেক — সবই প্যারামিার-ড্রিভেন ফ্লোতে অটোমেটিক হয়।

### এর ফলে যা হবে:

1. **বারবার POST রিকোয়ে্টের দরকার নেই** — এক কানেকশনই সব
2. **এজেন্ট কনটেক্সট মনে রাখে** — সিলেবাস+SSOT+মেমোরি সবসময় অ্যাটাচ
3. **রিয়েল-টাইম স্ট্রিমং** — চাঙ্ক বাই চাঙ্ক, কোনো বাফারিং না
4. **ক্রস-প্ল্যাটফর্ম** — UDS (Linux), TCP (Windows), WS / HTTP (সব)
5. **সিঙ্গেল এজেন্টও ভেরিফাড** — সেলফ-কনসিস্টেন্সি + এভিডেন্স + গোল চেক
6. **টাইপ সেফটি** — ইনপুট ভ্যালিডেশন + প্রুফ চেক + কনসেন্ট
7. **কোড ভেরিফিকেশন** — কম্পাইলা চেক + সিকিউরিটি প্যাটার্ন চেক
8. **পোর্টেবল** — এডিটর/চ্যাট UI/CLI/থার্ড-পার্টি — সবাই কানেক্ট করতে পারে

### বাস্তব ফলাফল:

"একটা ওপেন সকেট → ইউজার মেসেজ → কনটেক্সট লোড → টাইপ চেক → এজেন্ট কল → স্ট্রিম রেস্পন্ → সব এক কানেকশনে।
কোনো বারবার POST হ্যান্ডশেক নেই। এডিটর আর চ্যাট UI একই ব্যাকএন্ড ইউজ করে।
সিঙ্গেল এজেন্টের উত্তরও ভেরিফাইড হয়। প্রতিটা স্েপে প্রমাণ চেক হয়।"

---

_ডকুমেন্ট তৈরি করেছেন: Code Guru - Monu (Mission Barisal Architect)_
_ভারী ইন্সপিরেশন: Sahon Srabon (Shawon Bhai knows everything!)_
_তারিখ: 2026-07-16_
