// \=============================================================================  
// Combined MCP Gateway — ONE port, BOTH tool sets  
// \-----------------------------------------------------------------------------  
// Exposes Facebook Ads MCP (3001) \+ Public API MCP (3002) behind a SINGLE port.  
// The gateway proxies MCP JSON-RPC to the correct backend based on tool name.  
//  
// Usage:  
//   node combined.js            → listens on 3100 (default)  
//   node combined.js 4000       → listens on 4000  
//   PORT=3200 node combined.js  → listens on 3200  
//  
// Zero dependencies — uses only Node.js built-in modules.  
// Backends (3001/3002) must be started first via \`node start.js\`.  
// \=============================================================================

const http \= require("http");

// ─── Configuration ──────────────────────────────────────────────────────────  
const GATEWAY\_PORT \= parseInt(  
    process.argv\[2\] || process.env.PORT || "3100",  
    10,  
);  
const BACKENDS \= {  
    "facebook-ads": { host: "127.0.0.1", port: 3001, prefix: "ads\_" },  
    "public-api": { host: "127.0.0.1", port: 3002, prefix: "public" },  
};

// ─── MCP Proxy Helper (POST /mcp to a backend) ─────────────────────────────  
function mcpRequest(backend, body) {  
    return new Promise((resolve, reject) \=\> {  
        const payload \= JSON.stringify(body);  
        const req \= http.request(  
            {  
                hostname: backend.host,  
                port: backend.port,  
                path: "/mcp",  
                method: "POST",  
                headers: {  
                    "Content-Type": "application/json",  
                    "Content-Length": Buffer.byteLength(payload),  
                },  
                timeout: 15000,  
            },  
            (res) \=\> {  
                let data \= "";  
                res.on("data", (c) \=\> (data \+= c));  
                res.on("end", () \=\> {  
                    try {  
                        resolve({ status: res.statusCode, json: JSON.parse(data) });  
                    } catch {  
                        resolve({ status: res.statusCode, json: null });  
                    }  
                });  
            },  
        );  
        req.on("error", reject);  
        req.on("timeout", () \=\> {  
            req.destroy();  
            reject(new Error("Backend timeout"));  
        });  
        req.write(payload);  
        req.end();  
    });  
}

// ─── Route a tools/call to the correct backend ─────────────────────────────  
function routeBackend(toolName) {  
    if (toolName.startsWith("ads\_")) return "facebook-ads";  
    return "public-api";  
}

// ─── Handle JSON-RPC on the gateway ────────────────────────────────────────  
async function handleGatewayRPC(body) {  
    const { id, method, params } \= body;  
    if (id \=== undefined || id \=== null) return null;

    switch (method) {  
        case "initialize": {  
            // Ask Facebook backend (primary) for protocol info  
            const res \= await mcpRequest(BACKENDS\["facebook-ads"\], body);  
            if (res.json?.result) {  
                return {  
                    jsonrpc: "2.0",  
                    id,  
                    result: {  
                        protocolVersion: res.json.result.protocolVersion,  
                        capabilities: res.json.result.capabilities,  
                        serverInfo: { name: "combined-mcp", version: "1.0.0" },  
                    },  
                };  
            }  
            return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "combined-mcp", version: "1.0.0" } } };  
        }

        case "notifications/initialized":  
            // Fire-and-forget to both backends  
            await Promise.allSettled(\[  
                mcpRequest(BACKENDS\["facebook-ads"\], body),  
                mcpRequest(BACKENDS\["public-api"\], body),  
            \]);  
            return null;

        case "ping":  
            return { jsonrpc: "2.0", id, result: {} };

        case "tools/list": {  
            // Fetch tools from BOTH backends and merge  
            const \[fb, pub\] \= await Promise.allSettled(\[  
                mcpRequest(BACKENDS\["facebook-ads"\], body),  
                mcpRequest(BACKENDS\["public-api"\], body),  
            \]);  
            const tools \= \[\];  
            if (fb.status \=== "fulfilled" && fb.value.json?.result?.tools) {  
                tools.push(...fb.value.json.result.tools);  
            }  
            if (pub.status \=== "fulfilled" && pub.value.json?.result?.tools) {  
                tools.push(...pub.value.json.result.tools);  
            }  
            return { jsonrpc: "2.0", id, result: { tools } };  
        }

        case "tools/call": {  
            const { name, arguments: args } \= params || {};  
            const backend \= BACKENDS\[routeBackend(name || "")\];  
            const res \= await mcpRequest(backend, body);  
            if (res.json) return { jsonrpc: "2.0", id, ...res.json };  
            return {  
                jsonrpc: "2.0",  
                id,  
                error: { code: \-32000, message: \`Backend ${backend.port} unreachable\` },  
            };  
        }

        default:  
            return {  
                jsonrpc: "2.0",  
                id,  
                error: { code: \-32601, message: \`Method not found: ${method}\` },  
            };  
    }  
}

// ─── Health check all backends ─────────────────────────────────────────────  
async function healthStatus() {  
    const results \= {};  
    for (const \[name, b\] of Object.entries(BACKENDS)) {  
        try {  
            const res \= await mcpRequest(b, {  
                jsonrpc: "2.0",  
                id: 1,  
                method: "tools/list",  
                params: {},  
            });  
            results\[name\] \= {  
                port: b.port,  
                status: "ok",  
                tools: res.json?.result?.tools?.length || 0,  
            };  
        } catch (e) {  
            results\[name\] \= { port: b.port, status: "error", error: e.message };  
        }  
    }  
    return results;  
}

// ─── HTTP Server ───────────────────────────────────────────────────────────  
const server \= http.createServer(async (req, res) \=\> {  
    res.setHeader("Access-Control-Allow-Origin", "\*");  
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");  
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method \=== "OPTIONS") {  
        res.writeHead(204);  
        res.end();  
        return;  
    }

    // GET / — status page  
    if (req.method \=== "GET" && req.url \=== "/") {  
        const health \= await healthStatus();  
        const totalTools \= Object.values(health).reduce(  
            (sum, h) \=\> sum \+ (h.tools || 0),  
            0,  
        );  
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });  
        res.end(\`\<\!DOCTYPE html\>  
\<html\>\<head\>\<meta charset="utf-8"\>\<title\>Combined MCP Gateway\</title\>  
\<style\>body{font-family:system-ui;background:\#0a0a0f;color:\#e0e0e0;padding:40px;text-align:center}  
.card{max-width:560px;margin:0 auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px}  
h1{font-size:22px;margin-bottom:8px}.ok{color:\#66bb6a}.err{color:\#ef5350}  
.mono{font-family:monospace;background:rgba(255,255,255,.08);padding:4px 10px;border-radius:6px}  
li{list-style:none;text-align:left;margin:8px 0}\</style\>\</head\>\<body\>  
\<div class="card"\>  
\<h1\>🧟 Combined MCP Gateway\</h1\>  
\<p\>One port, both tool sets — Mission Barisal\</p\>  
\<br\>  
\<ul\>  
${Object.entries(health)  
                .map(  
                    (\[n, h\]) \=\>  
                        \`\<li\>${n}: \<span class="${h.status \=== "ok" ? "ok" : "err"}"\>${h.status}\</span\> — ${h.tools || 0} tools (port ${h.port})\</li\>\`,  
                )  
                .join("")}  
\</ul\>  
\<h3\>Total: ${totalTools} tools\</h3\>  
\<br\>  
\<p\>MCP Endpoint: \<span class="mono"\>POST http://localhost:${GATEWAY\_PORT}/mcp\</span\>\</p\>  
\<p\>Add to main server .env:\<br\>  
\<span class="mono"\>MCP\_ADD\_1=combined|http://localhost:${GATEWAY\_PORT}\</span\>\</p\>  
\</div\>\</body\>\</html\>\`);  
        return;  
    }

    // GET /health — JSON status  
    if (req.method \=== "GET" && req.url \=== "/health") {  
        const health \= await healthStatus();  
        res.writeHead(200, { "Content-Type": "application/json" });  
        res.end(JSON.stringify({ gateway: "combined-mcp", port: GATEWAY\_PORT, backends: health }));  
        return;  
    }

    // POST /mcp — MCP protocol (the main event)  
    if (req.method \=== "POST" && req.url \=== "/mcp") {  
        let body \= "";  
        for await (const chunk of req) body \+= chunk;  
        try {  
            const parsed \= JSON.parse(body);  
            const response \= await handleGatewayRPC(parsed);  
            if (response \=== null) {  
                res.writeHead(204);  
                res.end();  
                return;  
            }  
            res.writeHead(200, { "Content-Type": "application/json" });  
            res.end(JSON.stringify(response));  
        } catch (e) {  
            res.writeHead(200, { "Content-Type": "application/json" });  
            res.end(  
                JSON.stringify({  
                    jsonrpc: "2.0",  
                    id: null,  
                    error: { code: \-32700, message: "Parse error: " \+ e.message },  
                }),  
            );  
        }  
        return;  
    }

    res.writeHead(404, { "Content-Type": "application/json" });  
    res.end(JSON.stringify({ error: "Not found. Use POST /mcp for MCP protocol." }));  
});

server.listen(GATEWAY\_PORT, () \=\> {  
    console.log(\`\[Combined MCP Gateway\] http://localhost:${GATEWAY\_PORT}/mcp\`);  
    console.log(\`\[Backends\] facebook-ads:3001 \+ public-api:3002 → merged\`);  
    console.log(\`\[Usage\] node combined.js \[PORT\]\`);  
});

// \=============================================================================  
// Public API MCP Server v2.0  
// Follows Model Context Protocol (MCP) specification  
// Transport: Streamable HTTP (POST /mcp)  
// Protocol: JSON-RPC 2.0  
// \=============================================================================  
//  
// Free public APIs (NO API keys required):  
//   StackOverflow — Search questions, get answers, explore tags  
//   Weather       — Open-Meteo: Current weather, forecasts, historical  
//   Wikipedia     — Search articles, summaries, full content  
//   REST Countries — Country info, flags, currencies, dial codes  
//   Currency      — FrankFurter: Live exchange rates (ECB data)  
//   Crypto        — CoinGecko: Live crypto prices  
//   IP Geolocation — IP-API: Location from IP address  
//   QR Code       — qr-server: Generate QR codes from text/URL  
//  
// \=============================================================================

const http \= require("http");  
const PORT \= process.env.PORT || 3002;

// ─── MCP Protocol Constants ───────────────────────────────────────────────  
const MCP\_PROTOCOL\_VERSION \= "2024-11-05";  
const SERVER\_INFO \= { name: "public-api-mcp", version: "2.0.0" };

// ─── HTTP Fetch Helper ─────────────────────────────────────────────────────  
async function fetchJSON(url, options \= {}) {  
  const controller \= new AbortController();  
  const timeout \= setTimeout(() \=\> controller.abort(), options.timeout || 15000);  
  try {  
    const response \= await fetch(url, {  
      headers: { "User-Agent": "PublicAPI-MCP/2.0", Accept: "application/json", ...options.headers },  
      signal: controller.signal,  
      ...options,  
    });  
    if (\!response.ok) throw new Error(\`HTTP ${response.status}: ${response.statusText}\`);  
    return response.json();  
  } finally {  
    clearTimeout(timeout);  
  }  
}

function weatherCodeToDescription(code) {  
  const d \= {  
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",  
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",  
    55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",  
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",  
    80: "Rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",  
    95: "Thunderstorm", 96: "Thunderstorm \+ hail", 99: "Thunderstorm \+ heavy hail",  
  };  
  return d\[code\] || \`Code ${code}\`;  
}

// ─── Tool Definitions ──────────────────────────────────────────────────────  
const TOOLS \= \[  
  // ══════════════════════════════════════════════════════════════════════════  
  // STACKOVERFLOW (6 tools)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "stackoverflow\_search",  
    description: "Search Stack Overflow questions by keyword. Returns titles, scores, views, answers, tags, links.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        query: { type: "string", description: "Search query" },  
        sort: { type: "string", enum: \["relevance", "votes", "creation", "activity"\], default: "relevance" },  
        size: { type: "integer", minimum: 1, maximum: 100, default: 10 },  
      },  
      required: \["query"\],  
    },  
  },  
  {  
    name: "stackoverflow\_get\_question",  
    description: "Get a full Stack Overflow question with body, answers, tags, score.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        question\_id: { type: "integer", description: "Question ID (e.g. 11227809)" },  
      },  
      required: \["question\_id"\],  
    },  
  },  
  {  
    name: "stackoverflow\_get\_answers",  
    description: "Get all answers for a Stack Overflow question, sorted by votes.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        question\_id: { type: "integer", description: "Question ID" },  
        size: { type: "integer", minimum: 1, maximum: 100, default: 10 },  
      },  
      required: \["question\_id"\],  
    },  
  },  
  {  
    name: "stackoverflow\_search\_by\_tag",  
    description: "Search questions filtered by tag(s).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        tag: { type: "string", description: "Single tag (e.g. 'javascript')" },  
        tags: { type: "array", items: { type: "string" }, description: "Multiple tags" },  
        sort: { type: "string", enum: \["votes", "creation", "activity", "unanswered"\], default: "votes" },  
        size: { type: "integer", minimum: 1, maximum: 100, default: 10 },  
      },  
      required: \[\],  
    },  
  },  
  {  
    name: "stackoverflow\_get\_tag\_info",  
    description: "Get info about a Stack Overflow tag (count, synonyms, wiki).",  
    inputSchema: {  
      type: "object",  
      properties: { tag\_name: { type: "string", description: "Tag name" } },  
      required: \["tag\_name"\],  
    },  
  },  
  {  
    name: "stackoverflow\_get\_trending",  
    description: "Get trending/popular questions on Stack Overflow.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        size: { type: "integer", minimum: 1, maximum: 50, default: 10 },  
      },  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // WEATHER — Open-Meteo (Free, No API Key) (5 tools)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "weather\_current",  
    description: "Get current weather for a location (temp, humidity, wind, conditions).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        latitude: { type: "number" },  
        longitude: { type: "number" },  
        city: { type: "string", description: "City name (auto-geocoded)" },  
      },  
    },  
  },  
  {  
    name: "weather\_forecast",  
    description: "Get weather forecast up to 16 days (daily or hourly).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        latitude: { type: "number" },  
        longitude: { type: "number" },  
        city: { type: "string" },  
        days: { type: "integer", minimum: 1, maximum: 16, default: 7 },  
      },  
    },  
  },  
  {  
    name: "weather\_alerts",  
    description: "Get severe weather alerts for a location.",  
    inputSchema: {  
      type: "object",  
      properties: { latitude: { type: "number" }, longitude: { type: "number" } },  
      required: \["latitude", "longitude"\],  
    },  
  },  
  {  
    name: "weather\_historical",  
    description: "Get historical weather data for a date range (past data).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        latitude: { type: "number" },  
        longitude: { type: "number" },  
        start\_date: { type: "string", description: "YYYY-MM-DD" },  
        end\_date: { type: "string", description: "YYYY-MM-DD" },  
      },  
      required: \["latitude", "longitude", "start\_date", "end\_date"\],  
    },  
  },  
  {  
    name: "weather\_geocode",  
    description: "Convert city name to coordinates.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        city: { type: "string" },  
        count: { type: "integer", minimum: 1, maximum: 10, default: 1 },  
      },  
      required: \["city"\],  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // WIKIPEDIA (7 tools)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "wikipedia\_search",  
    description: "Search Wikipedia articles by keyword.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        query: { type: "string" },  
        language: { type: "string", default: "en" },  
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },  
      },  
      required: \["query"\],  
    },  
  },  
  {  
    name: "wikipedia\_get\_summary",  
    description: "Get a quick summary of a Wikipedia article.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        title: { type: "string" },  
        language: { type: "string", default: "en" },  
      },  
      required: \["title"\],  
    },  
  },  
  {  
    name: "wikipedia\_get\_article",  
    description: "Get full content of a Wikipedia article as plain text.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        title: { type: "string" },  
        language: { type: "string", default: "en" },  
      },  
      required: \["title"\],  
    },  
  },  
  {  
    name: "wikipedia\_get\_sections",  
    description: "Get section structure of a Wikipedia article.",  
    inputSchema: {  
      type: "object",  
      properties: { title: { type: "string" }, language: { type: "string", default: "en" } },  
      required: \["title"\],  
    },  
  },  
  {  
    name: "wikipedia\_get\_links",  
    description: "Get internal links from a Wikipedia article.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        title: { type: "string" },  
        language: { type: "string", default: "en" },  
        limit: { type: "integer", default: 50 },  
      },  
      required: \["title"\],  
    },  
  },  
  {  
    name: "wikipedia\_get\_random",  
    description: "Get a random Wikipedia article.",  
    inputSchema: { type: "object", properties: { language: { type: "string", default: "en" } } },  
  },  
  {  
    name: "wikipedia\_get\_categories",  
    description: "Get categories of a Wikipedia article.",  
    inputSchema: {  
      type: "object",  
      properties: { title: { type: "string" }, language: { type: "string", default: "en" } },  
      required: \["title"\],  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // REST COUNTRIES (3 tools) — No API Key  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "country\_search",  
    description: "Search countries by name. Returns flag, capital, currency, population, languages, timezones.",  
    inputSchema: {  
      type: "object",  
      properties: { name: { type: "string", description: "Country name (e.g. 'Bangladesh')" } },  
      required: \["name"\],  
    },  
  },  
  {  
    name: "country\_get\_by\_code",  
    description: "Get country info by 2-letter code (e.g. BD, US, GB).",  
    inputSchema: {  
      type: "object",  
      properties: { code: { type: "string", description: "ISO 3166-1 alpha-2 code" } },  
      required: \["code"\],  
    },  
  },  
  {  
    name: "country\_list\_all",  
    description: "List all countries with basic info (name, code, capital, region).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        region: { type: "string", description: "Filter by region: Africa, Americas, Asia, Europe, Oceania" },  
        limit: { type: "integer", default: 50 },  
      },  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // CURRENCY — FrankFurter (ECB data, No API Key) (3 tools)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "currency\_convert",  
    description: "Convert amount from one currency to another using ECB rates.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        from: { type: "string", description: "Source currency (e.g. USD)" },  
        to: { type: "string", description: "Target currency (e.g. BDT)" },  
        amount: { type: "number", default: 1 },  
      },  
      required: \["from", "to"\],  
    },  
  },  
  {  
    name: "currency\_rates",  
    description: "Get exchange rates for a base currency.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        base: { type: "string", default: "USD", description: "Base currency" },  
        symbols: { type: "array", items: { type: "string" }, description: "Target currencies (e.g. \['EUR','GBP'\])" },  
      },  
    },  
  },  
  {  
    name: "currency\_list",  
    description: "List all supported currencies.",  
    inputSchema: { type: "object", properties: {} },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // CRYPTO — CoinGecko (Free tier) (3 tools)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "crypto\_price",  
    description: "Get live price of cryptocurrencies (BTC, ETH, etc.) in multiple currencies.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        coins: { type: "array", items: { type: "string" }, description: "Coin IDs (e.g. \['bitcoin','ethereum'\])" },  
        currencies: { type: "array", items: { type: "string" }, default: \["usd"\], description: "Fiat currencies" },  
      },  
      required: \["coins"\],  
    },  
  },  
  {  
    name: "crypto\_search",  
    description: "Search for a cryptocurrency by name or symbol.",  
    inputSchema: {  
      type: "object",  
      properties: { query: { type: "string", description: "Search query" } },  
      required: \["query"\],  
    },  
  },  
  {  
    name: "crypto\_market",  
    description: "Get top cryptocurrencies by market cap.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },  
        currency: { type: "string", default: "usd" },  
      },  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // IP GEOLOCATION — IP-API (Free, No API Key) (1 tool)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "ip\_lookup",  
    description: "Get geolocation info from IP address (country, city, ISP, coordinates).",  
    inputSchema: {  
      type: "object",  
      properties: {  
        ip: { type: "string", description: "IP address (empty \= your IP)" },  
      },  
    },  
  },

  // ══════════════════════════════════════════════════════════════════════════  
  // QR CODE — qr-server (Free, No API Key) (1 tool)  
  // ══════════════════════════════════════════════════════════════════════════  
  {  
    name: "qr\_generate",  
    description: "Generate a QR code image URL from text or URL.",  
    inputSchema: {  
      type: "object",  
      properties: {  
        text: { type: "string", description: "Text or URL to encode" },  
        size: { type: "integer", default: 300, description: "Image size in pixels" },  
        format: { type: "string", enum: \["png", "svg", "gif"\], default: "png" },  
      },  
      required: \["text"\],  
    },  
  },  
\];

// ─── Tool Execution Router ─────────────────────────────────────────────────  
async function executeTool(name, args) {  
  try {  
    let result;

    switch (name) {  
    // ═══════════════════ STACKOVERFLOW ═══════════════════  
    case "stackoverflow\_search": {  
      const { query, sort, size } \= args;  
      const url \= \`https://api.stackexchange.com/2.3/search/advanced?order=desc\&sort=${sort || "relevance"}\&q=${encodeURIComponent(query)}\&site=stackoverflow\&filter=withbody\&pagesize=${size || 10}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        total: data.total,  
        items: (data.items || \[\]).map(q \=\> ({  
          id: q.question\_id, title: q.title, score: q.score,  
          views: q.view\_count, answers: q.answer\_count, tags: q.tags,  
          link: q.link, created: new Date(q.creation\_date \* 1000).toISOString(),  
        })),  
      };  
      break;  
    }

    case "stackoverflow\_get\_question": {  
      const { question\_id } \= args;  
      const url \= \`https://api.stackexchange.com/2.3/questions/${question\_id}?site=stackoverflow\&filter=withbody\`;  
      const data \= await fetchJSON(url);  
      const q \= data.items?.\[0\];  
      if (\!q) throw new Error(\`Question ${question\_id} not found\`);  
      result \= {  
        id: q.question\_id, title: q.title, body: q.body?.substring(0, 5000),  
        score: q.score, views: q.view\_count, answers: q.answer\_count,  
        tags: q.tags, link: q.link, owner: q.owner?.display\_name,  
        created: new Date(q.creation\_date \* 1000).toISOString(),  
      };  
      break;  
    }

    case "stackoverflow\_get\_answers": {  
      const { question\_id, size } \= args;  
      const url \= \`https://api.stackexchange.com/2.3/questions/${question\_id}/answers?order=desc\&sort=votes\&site=stackoverflow\&filter=withbody\&pagesize=${size || 10}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        question\_id,  
        items: (data.items || \[\]).map(a \=\> ({  
          id: a.answer\_id, body: a.body?.substring(0, 5000),  
          score: a.score, is\_accepted: a.is\_accepted,  
          owner: a.owner?.display\_name,  
          created: new Date(a.creation\_date \* 1000).toISOString(),  
        })),  
      };  
      break;  
    }

    case "stackoverflow\_search\_by\_tag": {  
      // Accept both \`tag\` (string) and \`tags\` (array)  
      let tagList \= \[\];  
      if (args.tag) tagList \= \[args.tag\];  
      if (args.tags && Array.isArray(args.tags)) tagList \= args.tags;  
      if (args.tags && typeof args.tags \=== "string") tagList \= \[args.tags\];  
      if (tagList.length \=== 0\) throw new Error("Provide 'tag' or 'tags' parameter");

      const tagged \= tagList.join(";");  
      const url \= \`https://api.stackexchange.com/2.3/questions?order=desc\&sort=${args.sort || "votes"}\&tagged=${encodeURIComponent(tagged)}\&site=stackoverflow\&filter=withbody\&pagesize=${args.size || 10}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        tags: tagList,  
        items: (data.items || \[\]).map(q \=\> ({  
          id: q.question\_id, title: q.title, score: q.score,  
          views: q.view\_count, answers: q.answer\_count, tags: q.tags,  
          link: q.link,  
        })),  
      };  
      break;  
    }

    case "stackoverflow\_get\_tag\_info": {  
      const { tag\_name } \= args;  
      const url \= \`https://api.stackexchange.com/2.3/tags/${encodeURIComponent(tag\_name)}/info?site=stackoverflow\`;  
      const data \= await fetchJSON(url);  
      const tag \= data.items?.\[0\];  
      if (\!tag) throw new Error(\`Tag "${tag\_name}" not found\`);  
      result \= { name: tag.name, count: tag.count, has\_synonyms: tag.has\_synonyms };  
      break;  
    }

    case "stackoverflow\_get\_trending": {  
      const { size } \= args;  
      const url \= \`https://api.stackexchange.com/2.3/questions?order=desc\&sort=hot\&site=stackoverflow\&filter=withbody\&pagesize=${size || 10}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        items: (data.items || \[\]).map(q \=\> ({  
          id: q.question\_id, title: q.title, score: q.score,  
          views: q.view\_count, answers: q.answer\_count, tags: q.tags,  
          link: q.link,  
        })),  
      };  
      break;  
    }

    // ═══════════════════ WEATHER ═══════════════════  
    case "weather\_current": {  
      let { latitude: lat, longitude: lon, city } \= args;  
      if (city && (\!lat || \!lon)) {  
        const geo \= await fetchJSON(\`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}\&count=1\`);  
        if (\!geo.results?.length) throw new Error(\`City not found: ${city}\`);  
        lat \= geo.results\[0\].latitude;  
        lon \= geo.results\[0\].longitude;  
      }  
      const url \= \`https://api.open-meteo.com/v1/forecast?latitude=${lat}\&longitude=${lon}\&current=temperature\_2m,relative\_humidity\_2m,apparent\_temperature,precipitation,weather\_code,wind\_speed\_10m,wind\_direction\_10m\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        location: { latitude: lat, longitude: lon },  
        current: {  
          temperature: data.current?.temperature\_2m,  
          feels\_like: data.current?.apparent\_temperature,  
          humidity: data.current?.relative\_humidity\_2m,  
          precipitation: data.current?.precipitation,  
          weather: weatherCodeToDescription(data.current?.weather\_code),  
          wind\_speed: data.current?.wind\_speed\_10m,  
          wind\_direction: data.current?.wind\_direction\_10m,  
        },  
      };  
      break;  
    }

    case "weather\_forecast": {  
      let { latitude: lat, longitude: lon, city, days } \= args;  
      if (city && (\!lat || \!lon)) {  
        const geo \= await fetchJSON(\`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}\&count=1\`);  
        if (\!geo.results?.length) throw new Error(\`City not found: ${city}\`);  
        lat \= geo.results\[0\].latitude;  
        lon \= geo.results\[0\].longitude;  
      }  
      const url \= \`https://api.open-meteo.com/v1/forecast?latitude=${lat}\&longitude=${lon}\&daily=weather\_code,temperature\_2m\_max,temperature\_2m\_min,precipitation\_sum,precipitation\_probability\_max,wind\_speed\_10m\_max\&forecast\_days=${days || 7}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        location: { latitude: lat, longitude: lon },  
        daily: data.daily?.time?.map((date, i) \=\> ({  
          date, weather: weatherCodeToDescription(data.daily?.weather\_code?.\[i\]),  
          temp\_max: data.daily?.temperature\_2m\_max?.\[i\],  
          temp\_min: data.daily?.temperature\_2m\_min?.\[i\],  
          precipitation: data.daily?.precipitation\_sum?.\[i\],  
          precip\_probability: data.daily?.precipitation\_probability\_max?.\[i\],  
          wind\_max: data.daily?.wind\_speed\_10m\_max?.\[i\],  
        })),  
      };  
      break;  
    }

    case "weather\_alerts": {  
      const { latitude, longitude } \= args;  
      const url \= \`https://api.open-meteo.com/v1/forecast?latitude=${latitude}\&longitude=${longitude}\&daily=weather\_code,temperature\_2m\_max,temperature\_2m\_min,precipitation\_sum,wind\_speed\_10m\_max\&forecast\_days=3\`;  
      const data \= await fetchJSON(url);  
      const alerts \= \[\];  
      const d \= data.daily;  
      for (let i \= 0; i \< (d?.time?.length || 0); i++) {  
        const code \= d.weather\_code?.\[i\];  
        const tMax \= d.temperature\_2m\_max?.\[i\];  
        const wind \= d.wind\_speed\_10m\_max?.\[i\];  
        const precip \= d.precipitation\_sum?.\[i\];  
        if (code \>= 95\) alerts.push({ date: d.time\[i\], type: "Thunderstorm", severity: "high" });  
        if (code \>= 75\) alerts.push({ date: d.time\[i\], type: "Heavy Snow", severity: "high" });  
        if (code \>= 65\) alerts.push({ date: d.time\[i\], type: "Heavy Rain", severity: "medium" });  
        if (tMax \> 40\) alerts.push({ date: d.time\[i\], type: "Extreme Heat", severity: "medium", value: \`${tMax}°C\` });  
        if (tMax \< \-10) alerts.push({ date: d.time\[i\], type: "Extreme Cold", severity: "medium", value: \`${tMax}°C\` });  
        if (wind \> 60\) alerts.push({ date: d.time\[i\], type: "Strong Wind", severity: "medium", value: \`${wind} km/h\` });  
        if (precip \> 50\) alerts.push({ date: d.time\[i\], type: "Heavy Precipitation", severity: "low", value: \`${precip}mm\` });  
      }  
      result \= { location: { latitude, longitude }, alerts: alerts.length ? alerts : \["No severe weather alerts"\] };  
      break;  
    }

    case "weather\_historical": {  
      const { latitude, longitude, start\_date, end\_date } \= args;  
      // Validate dates are in the past  
      const start \= new Date(start\_date);  
      const end \= new Date(end\_date);  
      const now \= new Date();  
      if (start \>= now) throw new Error("start\_date must be in the past");  
      if (end \>= now) throw new Error("end\_date must be in the past");  
      if (start \> end) throw new Error("start\_date must be before end\_date");

      const url \= \`https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}\&longitude=${longitude}\&start\_date=${start\_date}\&end\_date=${end\_date}\&daily=temperature\_2m\_max,temperature\_2m\_min,precipitation\_sum,wind\_speed\_10m\_max,weather\_code\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        location: { latitude, longitude },  
        period: { start: start\_date, end: end\_date },  
        daily: data.daily?.time?.map((date, i) \=\> ({  
          date, weather: weatherCodeToDescription(data.daily?.weather\_code?.\[i\]),  
          temp\_max: data.daily?.temperature\_2m\_max?.\[i\],  
          temp\_min: data.daily?.temperature\_2m\_min?.\[i\],  
          precipitation: data.daily?.precipitation\_sum?.\[i\],  
          wind\_max: data.daily?.wind\_speed\_10m\_max?.\[i\],  
        })),  
      };  
      break;  
    }

    case "weather\_geocode": {  
      const { city, count } \= args;  
      const url \= \`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}\&count=${count || 1}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        query: city,  
        results: (data.results || \[\]).map(r \=\> ({  
          name: r.name, country: r.country, admin1: r.admin1,  
          latitude: r.latitude, longitude: r.longitude, timezone: r.timezone,  
        })),  
      };  
      break;  
    }

    // ═══════════════════ WIKIPEDIA ═══════════════════  
    case "wikipedia\_search": {  
      const { query, language, limit } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/w/api.php?action=query\&list=search\&srsearch=${encodeURIComponent(query)}\&srlimit=${limit || 10}\&format=json\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        query, total: data.query?.searchinfo?.totalhits || 0,  
        items: (data.query?.search || \[\]).map(s \=\> ({  
          title: s.title, snippet: s.snippet?.replace(/\<\[^\>\]\*\>/g, ""),  
          url: \`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(s.title)}\`,  
        })),  
      };  
      break;  
    }

    case "wikipedia\_get\_summary": {  
      const { title, language } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/api/rest\_v1/page/summary/${encodeURIComponent(title)}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        title: data.title, description: data.description,  
        extract: data.extract, thumbnail: data.thumbnail?.source,  
        url: data.content\_urls?.desktop?.page,  
      };  
      break;  
    }

    case "wikipedia\_get\_article": {  
      const { title, language } \= args;  
      const lang \= language || "en";  
      // Use action=parse for full article content  
      const url \= \`https://${lang}.wikipedia.org/w/api.php?action=parse\&page=${encodeURIComponent(title)}\&prop=wikitext\&format=json\&redirects=1\`;  
      const data \= await fetchJSON(url);  
      if (data.error) throw new Error(data.error.info || "Article not found");  
      // Clean wikitext to readable text  
      let content \= data.parse?.wikitext?.wikitext || "";  
      // Remove common wikitext markup  
      content \= content.replace(/\\\[\\\[(\[^\\\]|\]\*\\|)?(\[^\\\]\]\*)\\\]\\\]/g, "$2"); // links  
      content \= content.replace(/'''?/g, ""); // bold/italic  
      content \= content.replace(/\<\[^\>\]\*\>/g, ""); // HTML tags  
      content \= content.replace(/\\{\\{\[^}\]\*\\}\\}/g, ""); // templates  
      content \= content.replace(/\\n{3,}/g, "\\n\\n"); // extra newlines  
      result \= {  
        title: data.parse?.title || title,  
        content: content.substring(0, 50000),  
        url: \`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.parse?.title || title)}\`,  
      };  
      break;  
    }

    case "wikipedia\_get\_sections": {  
      const { title, language } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/w/api.php?action=parse\&page=${encodeURIComponent(title)}\&prop=sections\&format=json\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        title,  
        sections: (data.parse?.sections || \[\]).map(s \=\> ({  
          index: s.index, level: s.level, title: s.line, anchor: s.anchor,  
        })),  
      };  
      break;  
    }

    case "wikipedia\_get\_links": {  
      const { title, language, limit } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/w/api.php?action=query\&titles=${encodeURIComponent(title)}\&prop=links\&pllimit=${limit || 50}\&format=json\`;  
      const data \= await fetchJSON(url);  
      const pages \= data.query?.pages || {};  
      const pageId \= Object.keys(pages)\[0\];  
      result \= {  
        title,  
        links: (pages\[pageId\]?.links || \[\]).map(l \=\> ({  
          title: l.title,  
          url: \`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(l.title)}\`,  
        })),  
      };  
      break;  
    }

    case "wikipedia\_get\_random": {  
      const { language } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/api/rest\_v1/page/random/summary\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        title: data.title, description: data.description,  
        extract: data.extract, thumbnail: data.thumbnail?.source,  
        url: data.content\_urls?.desktop?.page,  
      };  
      break;  
    }

    case "wikipedia\_get\_categories": {  
      const { title, language } \= args;  
      const lang \= language || "en";  
      const url \= \`https://${lang}.wikipedia.org/w/api.php?action=query\&titles=${encodeURIComponent(title)}\&prop=categories\&cllimit=50\&format=json\`;  
      const data \= await fetchJSON(url);  
      const pages \= data.query?.pages || {};  
      const pageId \= Object.keys(pages)\[0\];  
      result \= {  
        title,  
        categories: (pages\[pageId\]?.categories || \[\]).map(c \=\> c.title.replace("Category:", "")),  
      };  
      break;  
    }

    // ═══════════════════ REST COUNTRIES ═══════════════════  
    case "country\_search": {  
      const { name } \= args;  
      const url \= \`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,region,subregion,population,flags,currencies,languages,timezones,area,cca2\`;  
      const data \= await fetchJSON(url);  
      result \= (Array.isArray(data) ? data : \[data\]).map(c \=\> ({  
        name: c.name?.common, official: c.name?.official,  
        capital: c.capital, region: c.region, subregion: c.subregion,  
        population: c.population, area: c.area,  
        flag: c.flags?.png || c.flags?.svg,  
        currencies: c.currencies ? Object.entries(c.currencies).map((\[k, v\]) \=\> ({ code: k, name: v.name, symbol: v.symbol })) : \[\],  
        languages: c.languages ? Object.values(c.languages) : \[\],  
        timezones: c.timezones, code: c.cca2,  
      }));  
      break;  
    }

    case "country\_get\_by\_code": {  
      const { code } \= args;  
      const url \= \`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name,capital,region,subregion,population,flags,currencies,languages,timezones,area,cca2,cca3,borders\`;  
      const data \= await fetchJSON(url);  
      const c \= Array.isArray(data) ? data\[0\] : data;  
      result \= {  
        name: c.name?.common, official: c.name?.official,  
        capital: c.capital, region: c.region, subregion: c.subregion,  
        population: c.population, area: c.area,  
        flag: c.flags?.png || c.flags?.svg,  
        currencies: c.currencies ? Object.entries(c.currencies).map((\[k, v\]) \=\> ({ code: k, name: v.name, symbol: v.symbol })) : \[\],  
        languages: c.languages ? Object.values(c.languages) : \[\],  
        timezones: c.timezones, code: c.cca2, code3: c.cca3,  
        borders: c.borders,  
      };  
      break;  
    }

    case "country\_list\_all": {  
      const { region, limit } \= args;  
      let url \= \`https://restcountries.com/v3.1/all?fields=name,region,capital,cca2\`;  
      if (region) url \+= \`\&region=${encodeURIComponent(region)}\`;  
      const data \= await fetchJSON(url);  
      const sorted \= (Array.isArray(data) ? data : \[data\]).sort((a, b) \=\> (a.name?.common || "").localeCompare(b.name?.common || ""));  
      result \= {  
        count: sorted.length,  
        countries: sorted.slice(0, limit || 50).map(c \=\> ({  
          name: c.name?.common, code: c.cca2, capital: c.capital?.\[0\], region: c.region,  
        })),  
      };  
      break;  
    }

    // ═══════════════════ CURRENCY ═══════════════════  
    case "currency\_convert": {  
      const { from, to, amount } \= args;  
      const fromUp \= from.toUpperCase();  
      const toUp \= to.toUpperCase();  
      // First check if both currencies are supported  
      const listData \= await fetchJSON("https://api.frankfurter.dev/v1/currencies");  
      const supported \= Object.keys(listData);  
      if (\!supported.includes(fromUp)) throw new Error(\`Currency "${fromUp}" not supported. Use currency\_list to see options.\`);  
      if (\!supported.includes(toUp)) throw new Error(\`Currency "${toUp}" not supported. Use currency\_list to see options.\`);  
      const url \= \`https://api.frankfurter.dev/v1/latest?base=${fromUp}\&symbols=${toUp}\`;  
      const data \= await fetchJSON(url);  
      const rate \= data.rates?.\[toUp\];  
      result \= {  
        from: fromUp, to: toUp, amount: amount || 1, rate,  
        result: (amount || 1\) \* rate, date: data.date,  
      };  
      break;  
    }

    case "currency\_rates": {  
      const { base, symbols } \= args;  
      let url \= \`https://api.frankfurter.dev/v1/latest?base=${(base || "USD").toUpperCase()}\`;  
      if (symbols?.length) url \+= \`\&symbols=${symbols.map(s \=\> s.toUpperCase()).join(",")}\`;  
      const data \= await fetchJSON(url);  
      result \= { base: data.base, date: data.date, rates: data.rates };  
      break;  
    }

    case "currency\_list": {  
      const data \= await fetchJSON("https://api.frankfurter.dev/v1/currencies");  
      result \= Object.entries(data).map((\[code, info\]) \=\> ({ code, name: info.name, symbol: info.symbol }));  
      break;  
    }

    // ═══════════════════ CRYPTO ═══════════════════  
    case "crypto\_price": {  
      const { coins, currencies } \= args;  
      const ids \= (coins || \["bitcoin"\]).join(",");  
      const vs \= (currencies || \["usd"\]).join(",");  
      const url \= \`https://api.coingecko.com/api/v3/simple/price?ids=${ids}\&vs\_currencies=${vs}\&include\_24hr\_change=true\&include\_market\_cap=true\`;  
      const data \= await fetchJSON(url);  
      result \= Object.entries(data).map((\[coin, info\]) \=\> ({  
        coin, prices: info,  
      }));  
      break;  
    }

    case "crypto\_search": {  
      const { query } \= args;  
      const url \= \`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}\`;  
      const data \= await fetchJSON(url);  
      result \= {  
        total: data.coins?.length || 0,  
        coins: (data.coins || \[\]).slice(0, 10).map(c \=\> ({  
          id: c.id, name: c.name, symbol: c.symbol,  
          market\_cap\_rank: c.market\_cap\_rank, thumb: c.thumb,  
        })),  
      };  
      break;  
    }

    case "crypto\_market": {  
      const { limit, currency } \= args;  
      const url \= \`https://api.coingecko.com/api/v3/coins/markets?vs\_currency=${currency || "usd"}\&order=market\_cap\_desc\&per\_page=${limit || 10}\&page=1\&sparkline=false\`;  
      const data \= await fetchJSON(url);  
      result \= data.map(c \=\> ({  
        id: c.id, name: c.name, symbol: c.symbol,  
        price: c.current\_price, market\_cap: c.market\_cap,  
        change\_24h: c.price\_change\_percentage\_24h,  
        rank: c.market\_cap\_rank,  
      }));  
      break;  
    }

    // ═══════════════════ IP GEOLOCATION ═══════════════════  
    case "ip\_lookup": {  
      const { ip } \= args;  
      const url \= ip ? \`http://ip-api.com/json/${ip}\` : "http://ip-api.com/json/";  
      const data \= await fetchJSON(url);  
      if (data.status \=== "fail") throw new Error(data.message || "IP lookup failed");  
      result \= {  
        ip: data.query, country: data.country, country\_code: data.countryCode,  
        region: data.regionName, city: data.city, zip: data.zip,  
        lat: data.lat, lon: data.lon, timezone: data.timezone,  
        isp: data.isp, org: data.org, as: data.as,  
      };  
      break;  
    }

    // ═══════════════════ QR CODE ═══════════════════  
    case "qr\_generate": {  
      const { text, size, format } \= args;  
      const s \= size || 300;  
      const f \= format || "png";  
      result \= {  
        text,  
        url: \`https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}\&data=${encodeURIComponent(text)}\&format=${f}\`,  
        size: s, format: f,  
      };  
      break;  
    }

    default:  
      throw new Error(\`Unknown tool: ${name}\`);  
    }

    return {  
      content: \[{ type: "text", text: typeof result \=== "string" ? result : JSON.stringify(result, null, 2\) }\],  
    };  
  } catch (error) {  
    return {  
      content: \[{ type: "text", text: \`Error executing ${name}: ${error.message}\` }\],  
      isError: true,  
    };  
  }  
}

// ─── JSON-RPC 2.0 Handler ──────────────────────────────────────────────────  
function handleJSONRPC(body) {  
  const { id, method, params } \= body;  
  if (id \=== undefined || id \=== null) return null;

  switch (method) {  
    case "initialize":  
      return {  
        jsonrpc: "2.0", id,  
        result: { protocolVersion: MCP\_PROTOCOL\_VERSION, capabilities: { tools: {} }, serverInfo: SERVER\_INFO },  
      };  
    case "notifications/initialized": return null;  
    case "ping": return { jsonrpc: "2.0", id, result: {} };  
    case "tools/list":  
      return {  
        jsonrpc: "2.0", id,  
        result: { tools: TOOLS.map(t \=\> ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) },  
      };  
    case "tools/call": {  
      const { name, arguments: args } \= params || {};  
      return executeTool(name, args || {}).then(result \=\> ({ jsonrpc: "2.0", id, result }));  
    }  
    default:  
      return { jsonrpc: "2.0", id, error: { code: \-32601, message: \`Method not found: ${method}\` } };  
  }  
}

// ─── HTTP Server ───────────────────────────────────────────────────────────  
const server \= http.createServer(async (req, res) \=\> {  
  res.setHeader("Access-Control-Allow-Origin", "\*");  
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");  
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method \=== "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method \=== "GET" && req.url \=== "/health") {  
    res.writeHead(200, { "Content-Type": "application/json" });  
    res.end(JSON.stringify({ status: "ok", server: SERVER\_INFO.name, version: SERVER\_INFO.version, tools: TOOLS.length }));  
    return;  
  }

  if (req.method \=== "POST" && req.url \=== "/mcp") {  
    let body \= "";  
    for await (const chunk of req) body \+= chunk;  
    try {  
      const parsed \= JSON.parse(body);  
      const response \= await handleJSONRPC(parsed);  
      if (response \=== null) { res.writeHead(204); res.end(); return; }  
      res.writeHead(200, { "Content-Type": "application/json" });  
      res.end(JSON.stringify(response));  
    } catch (error) {  
      res.writeHead(200, { "Content-Type": "application/json" });  
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: \-32700, message: "Parse error" } }));  
    }  
    return;  
  }

  res.writeHead(404, { "Content-Type": "application/json" });  
  res.end(JSON.stringify({ error: "Not found. Use POST /mcp for MCP protocol." }));  
});

server.listen(PORT, () \=\> {  
  console.log(\`\[Public API MCP v2.0\] http://localhost:${PORT}/mcp\`);  
  console.log(\`\[Tools\] ${TOOLS.length} registered\`);  
  console.log(\`\[APIs\] StackOverflow, Weather, Wikipedia, Countries, Currency, Crypto, IP, QR\`);  
});

// \=============================================================================  
// Facebook Ads MCP Server  
// Model Context Protocol (MCP) Specification Compliant  
// Transport: Streamable HTTP (POST /mcp)  
// Protocol: JSON-RPC 2.0  
// \=============================================================================  
// Official Meta Facebook Ads MCP Tools \- 29 Tools  
// Categories:  
// 1\. Campaign Creation & Management (5)  
// 2\. Accounts & Pages (3)  
// 3\. Product Catalog (10)  
// 4\. Dataset Quality & Diagnostics (4)  
// 5\. Insights & Performance (7)  
// \=============================================================================

const http \= require("http");  
const fs \= require("fs");  
const path \= require("path");

const PORT \= process.env.PORT || 3001;  
const GRAPH\_API\_VERSION \= "v21.0";  
const GRAPH\_API\_BASE \= \`https://graph.facebook.com/${GRAPH\_API\_VERSION}\`;  
const LOG\_DIR \= path.join(\_\_dirname, "..", "logs");  
const LOG\_FILE \= path.join(LOG\_DIR, "facebook-ads-mcp.log");

// ─── Ensure Log Directory ──────────────────────────────────────────────────  
if (\!fs.existsSync(LOG\_DIR)) fs.mkdirSync(LOG\_DIR, { recursive: true });

// ─── Logger ────────────────────────────────────────────────────────────────  
const LOG\_ENTRIES \= \[\];  
function log(level, category, data) {  
  const entry \= {  
    timestamp: new Date().toISOString(),  
    level,  
    category,  
    ...data,  
  };  
  LOG\_ENTRIES.push(entry);  
  if (LOG\_ENTRIES.length \> 1000\) LOG\_ENTRIES.shift();  
  const line \= \`\[${entry.timestamp}\] \[${level}\] \[${category}\] ${JSON.stringify(data)}\\n\`;  
  fs.appendFileSync(LOG\_FILE, line);  
  console.log(line.trim());  
}

// ─── MCP Protocol Constants ───────────────────────────────────────────────  
const MCP\_PROTOCOL\_VERSION \= "2024-11-05";  
const SERVER\_INFO \= { name: "facebook-ads-mcp", version: "1.0.0" };

// ─── Official Meta Ads MCP Tools (29) ──────────────────────────────────────  
const TOOLS \= \[  
  // ═══ Campaign Creation & Management (5) ══════════════════════════════════  
  { name: "ads\_create\_campaign", description: "Create campaign with objective and budget. Created in PAUSED status.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, name: { type: "string" }, objective: { type: "string", enum: \["OUTCOME\_AWARENESS", "OUTCOME\_ENGAGEMENT", "OUTCOME\_LEADS", "OUTCOME\_SALES", "OUTCOME\_TRAFFIC", "OUTCOME\_APP\_PROMOTION"\] }, status: { type: "string", enum: \["ACTIVE", "PAUSED"\], default: "PAUSED" }, daily\_budget: { type: "string" }, lifetime\_budget: { type: "string" }, special\_ad\_categories: { type: "array", items: { type: "string" } } }, required: \["ad\_account\_id", "name", "objective"\] } },  
  { name: "ads\_create\_ad\_set", description: "Create ad set with targeting, placement, schedule.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, campaign\_id: { type: "string" }, name: { type: "string" }, daily\_budget: { type: "string" }, targeting: { type: "object" }, optimization\_goal: { type: "string" }, billing\_event: { type: "string" }, status: { type: "string", enum: \["ACTIVE", "PAUSED"\], default: "PAUSED" } }, required: \["ad\_account\_id", "campaign\_id", "name", "billing\_event", "optimization\_goal", "targeting"\] } },  
  { name: "ads\_create\_ad", description: "Create ad linking creative to ad set.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, adset\_id: { type: "string" }, name: { type: "string" }, creative: { type: "object" }, status: { type: "string", enum: \["ACTIVE", "PAUSED"\], default: "PAUSED" } }, required: \["ad\_account\_id", "adset\_id", "name", "creative"\] } },  
  { name: "ads\_update\_entity", description: "Modify campaigns, ad sets, or ads.", inputSchema: { type: "object", properties: { entity\_id: { type: "string" }, entity\_type: { type: "string", enum: \["campaign", "adset", "ad"\] }, name: { type: "string" }, status: { type: "string" }, daily\_budget: { type: "string" } }, required: \["entity\_id", "entity\_type"\] } },  
  { name: "ads\_activate\_entity", description: "Activate a paused campaign, ad set, or ad.", inputSchema: { type: "object", properties: { entity\_id: { type: "string" }, entity\_type: { type: "string", enum: \["campaign", "adset", "ad"\] } }, required: \["entity\_id", "entity\_type"\] } },

  // ═══ Accounts & Pages (3) ════════════════════════════════════════════════  
  { name: "ads\_get\_ad\_accounts", description: "List accessible ad accounts.", inputSchema: { type: "object", properties: { user\_id: { type: "string" } } } },  
  { name: "ads\_get\_ad\_entities", description: "Retrieve campaigns, ad sets, ads under an account.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, entity\_type: { type: "string", enum: \["campaign", "adset", "ad", "all"\], default: "all" }, status: { type: "string" }, limit: { type: "integer", default: 25 } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_get\_pages\_for\_business", description: "Display connected Facebook Pages.", inputSchema: { type: "object", properties: { business\_id: { type: "string" } }, required: \["business\_id"\] } },

  // ═══ Product Catalog (10) ════════════════════════════════════════════════  
  { name: "ads\_create\_catalog", description: "Create product catalog for dynamic ads.", inputSchema: { type: "object", properties: { business\_id: { type: "string" }, name: { type: "string" }, vertical: { type: "string" } }, required: \["business\_id", "name", "vertical"\] } },  
  { name: "ads\_create\_product\_feed", description: "Create data feed for product uploads.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" }, name: { type: "string" }, feed\_url: { type: "string" }, schedule: { type: "string" } }, required: \["catalog\_id", "name", "feed\_url"\] } },  
  { name: "ads\_upload\_products", description: "Upload products to catalog.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" }, products: { type: "array", items: { type: "object" } } }, required: \["catalog\_id", "products"\] } },  
  { name: "ads\_get\_catalog", description: "Get catalog details.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" } }, required: \["catalog\_id"\] } },  
  { name: "ads\_get\_product", description: "Get product details.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" }, product\_id: { type: "string" } }, required: \["catalog\_id", "product\_id"\] } },  
  { name: "ads\_get\_products", description: "List products in catalog.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" }, limit: { type: "integer", default: 25 } }, required: \["catalog\_id"\] } },  
  { name: "ads\_get\_product\_feed", description: "Get product feed details.", inputSchema: { type: "object", properties: { feed\_id: { type: "string" } }, required: \["feed\_id"\] } },  
  { name: "ads\_get\_product\_feed\_upload", description: "Get feed upload history.", inputSchema: { type: "object", properties: { feed\_id: { type: "string" }, limit: { type: "integer", default: 10 } }, required: \["feed\_id"\] } },  
  { name: "ads\_get\_product\_set", description: "Get product set details.", inputSchema: { type: "object", properties: { product\_set\_id: { type: "string" } }, required: \["product\_set\_id"\] } },  
  { name: "ads\_get\_product\_sets", description: "List product sets in catalog.", inputSchema: { type: "object", properties: { catalog\_id: { type: "string" }, limit: { type: "integer", default: 25 } }, required: \["catalog\_id"\] } },

  // ═══ Dataset Quality & Diagnostics (4) ═══════════════════════════════════  
  { name: "ads\_get\_datasets", description: "List datasets in account.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_get\_dataset\_quality", description: "Get signal health for dataset.", inputSchema: { type: "object", properties: { dataset\_id: { type: "string" }, date\_preset: { type: "string", default: "last\_30d" } }, required: \["dataset\_id"\] } },  
  { name: "ads\_get\_pixel", description: "Get pixel details and health.", inputSchema: { type: "object", properties: { pixel\_id: { type: "string" } }, required: \["pixel\_id"\] } },  
  { name: "ads\_get\_pixel\_stats", description: "Get pixel event statistics.", inputSchema: { type: "object", properties: { pixel\_id: { type: "string" }, date\_preset: { type: "string", default: "last\_30d" } }, required: \["pixel\_id"\] } },

  // ═══ Insights & Performance (7) ══════════════════════════════════════════  
  { name: "ads\_insights\_advertiser\_context", description: "Get industry and geographic context.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_insights\_anomaly\_signal", description: "Flag KPI deviations from baseline.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, entity\_type: { type: "string" }, entity\_id: { type: "string" }, metrics: { type: "array", items: { type: "string" } } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_insights\_auction\_ranking\_benchmarks", description: "Compare CTR, CPM, quality ranking.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, entity\_type: { type: "string" }, entity\_id: { type: "string" }, date\_preset: { type: "string", default: "last\_30d" } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_insights\_industry\_benchmark", description: "Compare against industry averages.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, industry: { type: "string" }, metrics: { type: "array", items: { type: "string" } } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_insights\_performance\_trend", description: "Historical metric trajectory.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" }, entity\_type: { type: "string" }, start\_date: { type: "string" }, end\_date: { type: "string" }, time\_increment: { type: "string", default: "7" } }, required: \["ad\_account\_id", "start\_date", "end\_date"\] } },  
  { name: "ads\_get\_opportunity\_score", description: "Get Meta's opportunity score.", inputSchema: { type: "object", properties: { ad\_account\_id: { type: "string" } }, required: \["ad\_account\_id"\] } },  
  { name: "ads\_get\_help\_article", description: "Search Meta Business Help Center.", inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" } }, required: \["query"\] } },  
\];

// ─── Graph API Helper ──────────────────────────────────────────────────────  
async function graphAPIRequest(endpoint, options \= {}) {  
  const accessToken \= process.env.FB\_ACCESS\_TOKEN || "";  
  if (\!accessToken) throw new Error("FB\_ACCESS\_TOKEN not set");  
  const url \= new URL(\`${GRAPH\_API\_BASE}${endpoint}\`);  
  url.searchParams.append("access\_token", accessToken);  
  if (options.params) {  
    for (const \[k, v\] of Object.entries(options.params)) {  
      if (v \!== undefined && v \!== null) url.searchParams.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));  
    }  
  }  
  const t0 \= Date.now();  
  const res \= await fetch(url.toString(), { method: options.method || "GET", headers: { "Content-Type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined });  
  const data \= await res.json();  
  const elapsed \= Date.now() \- t0;  
  log("INFO", "GRAPH\_API", { endpoint, method: options.method || "GET", status: res.status, elapsed: elapsed \+ "ms" });  
  if (data.error) throw new Error(\`FB API Error: ${data.error.message} (${data.error.code})\`);  
  return data;  
}

// ─── Tool Execution ────────────────────────────────────────────────────────  
async function executeTool(name, args) {  
  const token \= process.env.FB\_ACCESS\_TOKEN;  
  if (\!token) return { content: \[{ type: "text", text: "Error: FB\_ACCESS\_TOKEN not set" }\], isError: true };  
  const t0 \= Date.now();  
  try {  
    let result;  
    switch (name) {  
      case "ads\_create\_campaign": { const { ad\_account\_id, name: n, objective, status, daily\_budget, lifetime\_budget, special\_ad\_categories } \= args; let p \= { name: n, objective, status: status || "PAUSED", special\_ad\_categories: special\_ad\_categories || \[\] }; if (daily\_budget) p.daily\_budget \= daily\_budget; if (lifetime\_budget) p.lifetime\_budget \= lifetime\_budget; result \= await graphAPIRequest(\`/${ad\_account\_id}/campaigns\`, { method: "POST", params: p }); break; }  
      case "ads\_create\_ad\_set": { const { ad\_account\_id, campaign\_id, name: n, daily\_budget, targeting, optimization\_goal, billing\_event, status } \= args; let p \= { campaign\_id, name: n, billing\_event, optimization\_goal, targeting: JSON.stringify(targeting), status: status || "PAUSED" }; if (daily\_budget) p.daily\_budget \= daily\_budget; result \= await graphAPIRequest(\`/${ad\_account\_id}/adsets\`, { method: "POST", params: p }); break; }  
      case "ads\_create\_ad": { const { ad\_account\_id, adset\_id, name: n, creative, status } \= args; let p \= { adset\_id, name: n, creative: JSON.stringify(creative), status: status || "PAUSED" }; result \= await graphAPIRequest(\`/${ad\_account\_id}/ads\`, { method: "POST", params: p }); break; }  
      case "ads\_update\_entity": { const { entity\_id, ...u } \= args; let p \= {}; if (u.name) p.name \= u.name; if (u.status) p.status \= u.status; if (u.daily\_budget) p.daily\_budget \= u.daily\_budget; result \= await graphAPIRequest(\`/${entity\_id}\`, { method: "POST", params: p }); break; }  
      case "ads\_activate\_entity": { const { entity\_id } \= args; result \= await graphAPIRequest(\`/${entity\_id}\`, { method: "POST", params: { status: "ACTIVE" } }); break; }  
      case "ads\_get\_ad\_accounts": { const { user\_id } \= args; result \= await graphAPIRequest(user\_id ? \`/${user\_id}/adaccounts\` : "/me/adaccounts", { params: { fields: "id,name,account\_status,currency,timezone\_name,amount\_spent,balance" } }); break; }  
      case "ads\_get\_ad\_entities": { const { ad\_account\_id, entity\_type, status, limit } \= args; let ep \= \`/${ad\_account\_id}\`; if (entity\_type \=== "campaign") ep \+= "/campaigns"; else if (entity\_type \=== "adset") ep \+= "/adsets"; else if (entity\_type \=== "ad") ep \+= "/ads"; else ep \+= "/campaigns"; let p \= { fields: "id,name,status,effective\_status,objective,daily\_budget,lifetime\_budget" }; if (status) p.filtering \= JSON.stringify(\[{ field: "effective\_status", operator: "IN", value: \[status\] }\]); if (limit) p.limit \= limit; result \= await graphAPIRequest(ep, { params: p }); break; }  
      case "ads\_get\_pages\_for\_business": { const { business\_id } \= args; result \= await graphAPIRequest(\`/${business\_id}/owned\_pages\`, { params: { fields: "id,name,category,fan\_count,link" } }); break; }  
      case "ads\_create\_catalog": { const { business\_id, name: n, vertical } \= args; result \= await graphAPIRequest(\`/${business\_id}/product\_catalogs\`, { method: "POST", params: { name: n, vertical } }); break; }  
      case "ads\_create\_product\_feed": { const { catalog\_id, name: n, feed\_url, schedule } \= args; result \= await graphAPIRequest(\`/${catalog\_id}/product\_feeds\`, { method: "POST", params: { name: n, feed\_url, schedule: schedule || "DAILY" } }); break; }  
      case "ads\_upload\_products": { const { catalog\_id, products } \= args; result \= await graphAPIRequest(\`/${catalog\_id}/products\_batch\`, { method: "POST", params: { requests: JSON.stringify(products.map(p \=\> ({ method: "UPDATE", data: p }))) } }); break; }  
      case "ads\_get\_catalog": { const { catalog\_id } \= args; result \= await graphAPIRequest(\`/${catalog\_id}\`, { params: { fields: "id,name,vertical,product\_count" } }); break; }  
      case "ads\_get\_product": { const { catalog\_id, product\_id } \= args; result \= await graphAPIRequest(\`/${catalog\_id}/products/${product\_id}\`, { params: { fields: "id,title,description,price,currency,availability,image\_link" } }); break; }  
      case "ads\_get\_products": { const { catalog\_id, limit } \= args; let p \= { fields: "id,title,price,currency,availability" }; if (limit) p.limit \= limit; result \= await graphAPIRequest(\`/${catalog\_id}/products\`, { params: p }); break; }  
      case "ads\_get\_product\_feed": { const { feed\_id } \= args; result \= await graphAPIRequest(\`/${feed\_id}\`, { params: { fields: "id,name,schedule,url,created\_time" } }); break; }  
      case "ads\_get\_product\_feed\_upload": { const { feed\_id, limit } \= args; let p \= { fields: "id,status,error\_code,start\_time,end\_time" }; if (limit) p.limit \= limit; result \= await graphAPIRequest(\`/${feed\_id}/uploads\`, { params: p }); break; }  
      case "ads\_get\_product\_set": { const { product\_set\_id } \= args; result \= await graphAPIRequest(\`/${product\_set\_id}\`, { params: { fields: "id,name,filter,product\_count" } }); break; }  
      case "ads\_get\_product\_sets": { const { catalog\_id, limit } \= args; let p \= { fields: "id,name,product\_count" }; if (limit) p.limit \= limit; result \= await graphAPIRequest(\`/${catalog\_id}/product\_sets\`, { params: p }); break; }  
      case "ads\_get\_datasets": { const { ad\_account\_id } \= args; result \= await graphAPIRequest(\`/${ad\_account\_id}/custom\_audiences\`, { params: { fields: "id,name,description,approximate\_count" } }); break; }  
      case "ads\_get\_dataset\_quality": { const { dataset\_id, date\_preset } \= args; result \= await graphAPIRequest(\`/${dataset\_id}/delivery\_stats\`, { params: { date\_preset: date\_preset || "last\_30d" } }); break; }  
      case "ads\_get\_pixel": { const { pixel\_id } \= args; result \= await graphAPIRequest(\`/${pixel\_id}\`, { params: { fields: "id,name,last\_fired\_time,event\_stats" } }); break; }  
      case "ads\_get\_pixel\_stats": { const { pixel\_id, date\_preset } \= args; result \= await graphAPIRequest(\`/${pixel\_id}/stats\`, { params: { date\_preset: date\_preset || "last\_30d" } }); break; }  
      case "ads\_insights\_advertiser\_context": { const { ad\_account\_id } \= args; result \= await graphAPIRequest(\`/${ad\_account\_id}\`, { params: { fields: "id,name,account\_status,currency,timezone\_name,amount\_spent,business\_name,business\_city,business\_country" } }); break; }  
      case "ads\_insights\_anomaly\_signal": { const { ad\_account\_id, entity\_type, entity\_id, metrics } \= args; let ep \= entity\_id ? \`/${entity\_id}/insights\` : \`/${ad\_account\_id}/insights\`; let p \= { level: entity\_type || "account", fields: (metrics || \["impressions", "clicks", "spend", "ctr", "cpc"\]).join(","), date\_preset: "last\_30d", time\_increment: "1" }; result \= await graphAPIRequest(ep, { params: p }); break; }  
      case "ads\_insights\_auction\_ranking\_benchmarks": { const { ad\_account\_id, entity\_type, entity\_id, date\_preset } \= args; let ep \= entity\_id ? \`/${entity\_id}/insights\` : \`/${ad\_account\_id}/insights\`; let p \= { level: entity\_type || "account", fields: "impressions,clicks,spend,ctr,cpm,quality\_ranking,engagement\_ranking,conversion\_rate\_ranking", date\_preset: date\_preset || "last\_30d" }; result \= await graphAPIRequest(ep, { params: p }); break; }  
      case "ads\_insights\_industry\_benchmark": { const { ad\_account\_id, metrics } \= args; let p \= { level: "account", fields: (metrics || \["impressions", "clicks", "spend", "ctr", "cpc", "cpm"\]).join(","), date\_preset: "last\_30d" }; result \= await graphAPIRequest(\`/${ad\_account\_id}/insights\`, { params: p }); break; }  
      case "ads\_insights\_performance\_trend": { const { ad\_account\_id, entity\_type, entity\_id, metrics, start\_date, end\_date, time\_increment } \= args; let ep \= entity\_id ? \`/${entity\_id}/insights\` : \`/${ad\_account\_id}/insights\`; let p \= { level: entity\_type || "account", fields: (metrics || \["impressions", "clicks", "spend", "ctr"\]).join(","), time\_range: JSON.stringify({ since: start\_date, until: end\_date }), time\_increment: time\_increment || "7" }; result \= await graphAPIRequest(ep, { params: p }); break; }  
      case "ads\_get\_opportunity\_score": { const { ad\_account\_id } \= args; result \= await graphAPIRequest(\`/${ad\_account\_id}\`, { params: { fields: "id,name,account\_status,spend\_cap,amount\_spent,balance" } }); break; }  
      case "ads\_get\_help\_article": { const { query } \= args; result \= await graphAPIRequest("/search", { params: { q: query, type: "ad\_management\_documentation", limit: 5 } }); break; }  
      default: throw new Error(\`Unknown tool: ${name}\`);  
    }  
    const elapsed \= Date.now() \- t0;  
    log("INFO", "TOOL\_CALL", { tool: name, status: "success", elapsed: elapsed \+ "ms" });  
    return { content: \[{ type: "text", text: typeof result \=== "string" ? result : JSON.stringify(result, null, 2\) }\] };  
  } catch (error) {  
    const elapsed \= Date.now() \- t0;  
    log("ERROR", "TOOL\_CALL", { tool: name, status: "error", error: error.message, elapsed: elapsed \+ "ms" });  
    return { content: \[{ type: "text", text: \`Error: ${error.message}\` }\], isError: true };  
  }  
}

// ─── JSON-RPC 2.0 Handler ─────────────────────────────────────────────────  
function handleJSONRPC(body) {  
  const { id, method, params } \= body;  
  log("INFO", "MCP\_REQUEST", { method, id });  
  if (id \=== undefined || id \=== null) return null;  
  switch (method) {  
    case "initialize": return { jsonrpc: "2.0", id, result: { protocolVersion: MCP\_PROTOCOL\_VERSION, capabilities: { tools: {} }, serverInfo: SERVER\_INFO } };  
    case "notifications/initialized": return null;  
    case "ping": return { jsonrpc: "2.0", id, result: {} };  
    case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS.map(t \=\> ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) } };  
    case "tools/call": { const { name, arguments: args } \= params || {}; return executeTool(name, args || {}).then(result \=\> ({ jsonrpc: "2.0", id, result })); }  
    default: return { jsonrpc: "2.0", id, error: { code: \-32601, message: \`Method not found: ${method}\` } };  
  }  
}

// ─── Setup HTML (Modern Dark Theme) ────────────────────────────────────────  
function getSetupHTML() {  
  return \`\<\!DOCTYPE html\>  
\<html lang="en"\>  
\<head\>  
\<meta charset="UTF-8"\>  
\<meta name="viewport" content="width=device-width,initial-scale=1"\>  
\<title\>Facebook Ads MCP\</title\>  
\<style\>  
\*{margin:0;padding:0;box-sizing:border-box}  
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;background:\#0a0a0f;color:\#e0e0e0;display:flex;align-items:center;justify-content:center;padding:20px}  
.wrap{width:100%;max-width:520px;animation:fadeUp .6s ease}  
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}  
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden;backdrop-filter:blur(20px)}  
.hdr{padding:28px 24px;text-align:center;background:linear-gradient(135deg,rgba(24,119,242,.15),rgba(66,165,245,.1));border-bottom:1px solid rgba(255,255,255,.06)}  
.hdr h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,\#42a5f5,\#1877f2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}  
.hdr p{font-size:12px;color:\#888}  
.langs{display:flex;justify-content:center;gap:8px;padding:14px;border-bottom:1px solid rgba(255,255,255,.06)}  
.lang{padding:6px 18px;border:1px solid rgba(24,119,242,.4);background:transparent;color:\#42a5f5;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;transition:all .3s}  
.lang.on{background:\#1877f2;color:\#fff;border-color:\#1877f2}  
.body{padding:24px}  
.field{margin-bottom:16px}  
.field label{display:block;font-size:12px;font-weight:600;color:\#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}  
.field input{width:100%;padding:14px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:\#fff;font-size:14px;transition:all .3s;outline:none}  
.field input:focus{border-color:\#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.15)}  
.field input::placeholder{color:\#555}  
.hint{font-size:11px;color:\#666;margin-top:4px}  
.box{padding:12px 14px;border-radius:10px;margin-bottom:14px;font-size:12px;line-height:1.6;border-left:3px solid}  
.box.info{background:rgba(33,150,243,.08);border-color:\#2196f3;color:\#90caf9}  
.box.warn{background:rgba(255,152,0,.08);border-color:\#ff9800;color:\#ffb74d}  
.box.danger{background:rgba(244,67,54,.08);border-color:\#f44336;color:\#ef9a9a}  
.box b{display:block;margin-bottom:4px;font-size:13px;color:\#ddd}  
.terms{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px;margin-bottom:14px;max-height:110px;overflow-y:auto;font-size:11px;color:\#888;line-height:1.7}  
.terms b{color:\#aaa;margin-bottom:6px;display:block;font-size:12px}  
.btns{display:flex;gap:10px}  
.btn{flex:1;padding:14px;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .3s}  
.btn.p{background:linear-gradient(135deg,\#1877f2,\#1565c0);color:\#fff}  
.btn.p:hover{box-shadow:0 8px 25px rgba(24,119,242,.3);transform:translateY(-1px)}  
.btn.d{background:rgba(244,67,54,.15);color:\#ef5350;border:1px solid rgba(244,67,54,.3)}  
.btn.d:hover{background:rgba(244,67,54,.25)}  
.msg{margin-top:12px;padding:10px;border-radius:8px;text-align:center;font-size:12px;font-weight:500;display:none}  
.msg.ok{display:block;background:rgba(76,175,80,.1);color:\#66bb6a;border:1px solid rgba(76,175,80,.2)}  
.msg.err{display:block;background:rgba(244,67,54,.1);color:\#ef5350;border:1px solid rgba(244,67,54,.2)}  
.saved{margin-top:14px;padding:14px;background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.15);border-radius:12px;display:none;text-align:center}  
.saved.show{display:block;animation:fadeUp .3s ease}  
.saved h4{color:\#66bb6a;font-size:14px;margin-bottom:4px}  
.saved p{font-size:11px;color:\#888}  
.ftr{padding:12px;text-align:center;font-size:10px;color:\#444;border-top:1px solid rgba(255,255,255,.04)}  
@media(max-width:480px){.wrap{padding:0}.body{padding:18px}.btns{flex-direction:column}}  
\</style\>  
\</head\>  
\<body\>  
\<div class="wrap"\>  
\<div class="card"\>  
\<div class="hdr"\>  
\<h1\>Facebook Ads MCP\</h1\>  
\<p\>Token Setup & Configuration\</p\>  
\</div\>  
\<div class="langs"\>  
\<button class="lang on" onclick="L('en')"\>English\</button\>  
\<button class="lang" onclick="L('bn')"\>বাংলা\</button\>  
\</div\>  
\<div class="body"\>  
\<div class="box info"\>  
\<b data-en="How it works" data-bn="কিভাবে কাজ করে"\>How it works\</b\>  
\<span data-en="Enter your Facebook Conversion API token. Saved in browser only." data-bn="Facebook Conversion API টোকেন দিন। শুধু ব্রাউজারে সংরক্ষিত।"\>Enter your Facebook Conversion API token. Saved in browser only.\</span\>  
\</div\>  
\<div class="field"\>  
\<label data-en="Conversion API Token" data-bn="Conversion API টোকেন"\>Conversion API Token\</label\>  
\<input type="text" id="tk" placeholder="Paste token here..."\>  
\<p class="hint" data-en="From: Developers Portal → Graph API Explorer" data-bn="পান: Developers Portal → Graph API Explorer"\>From: Developers Portal → Graph API Explorer\</p\>  
\</div\>  
\<div class="field"\>  
\<label data-en="Validity (Hours)" data-bn="মেয়াদ (ঘন্টা)"\>Validity (Hours)\</label\>  
\<input type="number" id="dur" value="24" min="1" max="720"\>  
\<p class="hint" data-en="Max 720h (30 days). After expiry re-enter." data-bn="সর্বোচ্চ ৭২০ ঘন্টা। মেয়াদ শেষে আবার দিতে হবে।"\>Max 720h (30 days). After expiry re-enter.\</p\>  
\</div\>  
\<div class="box warn"\>  
\<b data-en="Important" data-bn="গুরুত্বপূর্ণ"\>Important\</b\>  
\<span data-en="Clear browser data \= Token lost. Must re-enter." data-bn="ব্রাউজার ডাটা মুছলে \= টোকেন হারিয়ে যাবে।"\>Clear browser data \= Token lost. Must re-enter.\</span\>  
\</div\>  
\<div class="terms"\>  
\<b data-en="Terms & Conditions" data-bn="শর্তাবলী"\>Terms & Conditions\</b\>  
\<ul\>  
\<li data-en="Token stored in browser only" data-bn="টোকেন শুধু ব্রাউজারে সংরক্ষিত"\>Token stored in browser only\</li\>  
\<li data-en="Never sent to external servers" data-bn="বহিঃস্থ সার্ভারে পাঠানো হয় না"\>Never sent to external servers\</li\>  
\<li data-en="Use at your own risk" data-bn="নিজ ঝুঁকিতে ব্যবহার করুন"\>Use at your own risk\</li\>  
\</ul\>  
\</div\>  
\<div class="box danger"\>  
\<b data-en="Disclaimer" data-bn="দায়মুক্তি"\>Disclaimer\</b\>  
\<span data-en="For educational purposes. We collect no data." data-bn="শিক্ষামূলক। আমরা ডাটা সংগ্রহ করি না।"\>For educational purposes. We collect no data.\</span\>  
\</div\>  
\<div class="btns"\>  
\<button class="btn p" onclick="save()" data-en="Save Token" data-bn="সংরক্ষণ করুন"\>Save Token\</button\>  
\<button class="btn d" onclick="clr()" data-en="Clear" data-bn="মুছুন"\>Clear\</button\>  
\</div\>  
\<div class="msg" id="msg"\>\</div\>  
\<div class="saved" id="svd"\>  
\<h4 data-en="Token Saved\!" data-bn="টোকেন সংরক্ষিত\!"\>Token Saved\!\</h4\>  
\<p data-en="You can close this page." data-bn="পৃষ্ঠা বন্ধ করতে পারেন।"\>You can close this page.\</p\>  
\<p id="exp"\>\</p\>  
\</div\>  
\</div\>  
\<div class="ftr"\>Facebook Ads MCP Server | ZombieCoder\</div\>  
\</div\>  
\</div\>  
\<script\>  
let c='en';  
function L(l){c=l;document.querySelectorAll('\[data-en\]').forEach(e=\>{e.textContent=e.getAttribute('data-'+l)});document.querySelectorAll('.lang').forEach(b=\>b.classList.remove('on'));event.target.classList.add('on')}  
function save(){const t=document.getElementById('tk').value.trim(),d=parseInt(document.getElementById('dur').value)||24,m=document.getElementById('msg');if(\!t){m.textContent=c==='bn'?'টোকেন দিন':'Enter token';m.className='msg err';return}const o={token:t,savedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+d\*36e5).toISOString(),duration:d};localStorage.setItem('fb\_mcp\_token',JSON.stringify(o));m.textContent=c==='bn'?'সফল\!':'Saved\!';m.className='msg ok';document.getElementById('svd').classList.add('show');document.getElementById('exp').textContent=(c==='bn'?'মেয়াদ: ':'Expires: ')+new Date(o.expiresAt).toLocaleString();document.getElementById('tk').value=''}  
function clr(){localStorage.removeItem('fb\_mcp\_token');document.getElementById('msg').textContent=c==='bn'?'মুছে ফেলা হয়েছে':'Cleared';document.getElementById('msg').className='msg ok';document.getElementById('svd').classList.remove('show')}  
(function(){const s=localStorage.getItem('fb\_mcp\_token');if(s){const d=JSON.parse(s);if(new Date(d.expiresAt)\>new Date()){document.getElementById('svd').classList.add('show');document.getElementById('exp').textContent='Expires: '+new Date(d.expiresAt).toLocaleString()}else localStorage.removeItem('fb\_mcp\_token')}})();  
\</script\>  
\</body\>\</html\>\`;  
}

// ─── HTTP Server ───────────────────────────────────────────────────────────  
const server \= http.createServer(async (req, res) \=\> {  
  res.setHeader("Access-Control-Allow-Origin", "\*");  
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");  
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");  
  if (req.method \=== "OPTIONS") { res.writeHead(204); res.end(); return; }

  const startTime \= Date.now();  
  log("INFO", "HTTP\_REQUEST", { method: req.method, url: req.url });

  // GET / or /setup — HTML page  
  if (req.method \=== "GET" && (req.url \=== "/" || req.url \=== "/setup")) {  
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });  
    res.end(getSetupHTML());  
    log("INFO", "HTTP\_RESPONSE", { url: req.url, status: 200, elapsed: (Date.now() \- startTime) \+ "ms" });  
    return;  
  }

  // GET /health  
  if (req.method \=== "GET" && req.url \=== "/health") {  
    res.writeHead(200, { "Content-Type": "application/json" });  
    res.end(JSON.stringify({ status: "ok", server: SERVER\_INFO.name, version: SERVER\_INFO.version, tools: TOOLS.length, logs: LOG\_ENTRIES.length }));  
    log("INFO", "HTTP\_RESPONSE", { url: "/health", status: 200, elapsed: (Date.now() \- startTime) \+ "ms" });  
    return;  
  }

  // GET /logs  
  if (req.method \=== "GET" && req.url \=== "/logs") {  
    res.writeHead(200, { "Content-Type": "application/json" });  
    res.end(JSON.stringify({ logs: LOG\_ENTRIES.slice(-100), total: LOG\_ENTRIES.length }));  
    log("INFO", "HTTP\_RESPONSE", { url: "/logs", status: 200, elapsed: (Date.now() \- startTime) \+ "ms" });  
    return;  
  }

  // POST /mcp — MCP endpoint  
  if (req.method \=== "POST" && req.url \=== "/mcp") {  
    let body \= "";  
    for await (const chunk of req) body \+= chunk;  
    try {  
      const parsed \= JSON.parse(body);  
      const response \= await handleJSONRPC(parsed);  
      if (response \=== null) { res.writeHead(204); res.end(); return; }  
      const resolved \= response instanceof Promise ? await response : response;  
      res.writeHead(200, { "Content-Type": "application/json" });  
      res.end(JSON.stringify(resolved));  
    } catch (e) {  
      log("ERROR", "MCP\_PARSE", { error: e.message });  
      res.writeHead(200, { "Content-Type": "application/json" });  
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: \-32700, message: "Parse error" } }));  
    }  
    log("INFO", "HTTP\_RESPONSE", { url: "/mcp", status: 200, elapsed: (Date.now() \- startTime) \+ "ms" });  
    return;  
  }

  res.writeHead(404, { "Content-Type": "application/json" });  
  res.end(JSON.stringify({ error: "Not found" }));  
});

server.listen(PORT, () \=\> {  
  log("INFO", "SERVER\_START", { port: PORT, tools: TOOLS.length, endpoint: \`http://localhost:${PORT}/mcp\` });  
  console.log(\`\[Facebook Ads MCP\] http://localhost:${PORT}/mcp\`);  
  console.log(\`\[Facebook Ads MCP\] Setup: http://localhost:${PORT}/\`);  
  console.log(\`\[Facebook Ads MCP\] Logs: http://localhost:${PORT}/logs\`);  
  console.log(\`\[Facebook Ads MCP\] Tools: ${TOOLS.length}\`);  
  if (\!process.env.FB\_ACCESS\_TOKEN) console.warn("\[Facebook Ads MCP\] WARNING: FB\_ACCESS\_TOKEN not set");  
});  
