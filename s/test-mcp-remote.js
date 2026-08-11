#!/usr/bin/env node
// =============================================================================
// Mission Barisal v3 — Env-Driven MCP Test Script (test-mcp-remote.js)
// -----------------------------------------------------------------------------
// Verifies the ENV-DRIVEN MCP LOADING flow end-to-end:
//   1. GET  /api/mcp-remote          — outbound MCP status
//   2. POST /api/mcp-remote/add      — add a remote MCP server at runtime
//   3. POST /mcp tools/list          — remote tools exposed via main MCP (JSON-RPC 2.0)
//   4. POST /mcp tools/call          — call a remote tool through the gateway
//   5. GET  /api/config/mcp          — remote client config (inbound)
//
// Usage: node test-mcp-remote.js [BASE_URL] [REMOTE_MCP_URL] [REMOTE_NAME]
//   Defaults: BASE_URL=http://localhost:5000
//             REMOTE_MCP_URL=https://b.zombiecoder.my.id/mcp
//             REMOTE_NAME=zombie
//
// Output: Prints each step result as JSON (auto-print) + final summary.
// =============================================================================

const http = require("http");
const https = require("https");

const BASE_URL = process.argv[2] || "http://localhost:5000";
const REMOTE_MCP_URL = process.argv[3] || "https://b.zombiecoder.my.id/mcp";
const REMOTE_NAME = process.argv[4] || "zombie";

const results = [];
let passed = 0;
let failed = 0;

function log(step, ok, detail) {
    const entry = { step, ok, ...detail };
    results.push(entry);
    if (ok) passed++;
    else failed++;
    console.log(JSON.stringify(entry));
}

function request(url, method, body, timeoutMs = 30000) {
    return new Promise((resolve) => {
        let lib;
        try {
            lib = url.startsWith("https://") ? https : http;
        } catch (e) {
            resolve({ error: "invalid url" });
            return;
        }
        const parsed = new URL(url);
        const payload = body ? JSON.stringify(body) : null;
        const req = lib.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method,
                headers: payload
                    ? {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(payload),
                    }
                    : {},
                timeout: timeoutMs,
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, raw: data });
                    }
                });
            },
        );
        req.on("timeout", () => {
            req.destroy();
            resolve({ error: "timeout after " + timeoutMs + "ms" });
        });
        req.on("error", (e) => resolve({ error: e.message }));
        if (payload) req.write(payload);
        req.end();
    });
}

async function main() {
    console.log(
        "=== Mission Barisal — Env-Driven MCP Test ===",
        JSON.stringify({ base: BASE_URL, remote: REMOTE_MCP_URL, name: REMOTE_NAME }),
    );

    // ── STEP 1: GET /api/mcp-remote — status ──────────────────
    const s1 = await request(BASE_URL + "/api/mcp-remote", "GET");
    if (s1.error || !s1.data || !s1.data.ok) {
        log("1_status", false, { error: s1.error || s1.raw || "bad response" });
    } else {
        log("1_status", true, {
            env: s1.data.env,
            servers: s1.data.servers.length,
            mergedTools: s1.data.mergedTools,
            totalMcpTools: s1.data.totalMcpTools,
        });
    }

    // ── STEP 2: POST /api/mcp-remote/add — add remote server ──
    const s2 = await request(BASE_URL + "/api/mcp-remote/add", "POST", {
        url: REMOTE_MCP_URL,
        name: REMOTE_NAME,
    });
    if (s2.error || !s2.data || !s2.data.ok) {
        log("2_add", false, { error: s2.error || s2.raw || "bad response" });
    } else {
        const server = s2.data.server || {};
        log("2_add", server.status === "connected", {
            name: server.name,
            status: server.status,
            toolsDiscovered: (server.tools || []).length,
            merged: s2.data.merged,
        });
    }

    // ── STEP 3: POST /mcp tools/list — remote tools in main MCP ──
    const s3 = await request(BASE_URL + "/mcp", "POST", {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
    });
    if (s3.error || !s3.data || !s3.data.result) {
        log("3_tools_list", false, { error: s3.error || s3.raw || "bad response" });
    } else {
        const tools = s3.data.result.tools || [];
        const remoteTools = tools.filter((t) => t.name.startsWith("remote__"));
        log("3_tools_list", remoteTools.length > 0, {
            totalTools: tools.length,
            remoteTools: remoteTools.length,
            sample: remoteTools.slice(0, 3).map((t) => t.name),
        });
    }

    // ── STEP 4: POST /mcp tools/call — call a remote tool ──
    const s4 = await request(BASE_URL + "/mcp", "POST", {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
            name: "remote__" + REMOTE_NAME + "__get_working_dir",
            arguments: {},
        },
    });
    if (s4.error || !s4.data || !s4.data.result) {
        log("4_tools_call", false, { error: s4.error || s4.raw || "bad response" });
    } else {
        const result = s4.data.result || {};
        const text = (result.content || [])
            .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
            .join(" ");
        log("4_tools_call", true, { tool: "remote__" + REMOTE_NAME + "__get_working_dir", response: text.slice(0, 80) });
    }

    // ── STEP 5: GET /api/config/mcp — inbound client config ──
    const s5 = await request(BASE_URL + "/api/config/mcp", "GET");
    if (s5.error || !s5.data) {
        log("5_config", false, { error: s5.error || s5.raw || "bad response" });
    } else {
        log("5_config", true, {
            transport: s5.data.transport,
            endpoints: s5.data.endpoints,
            toolCount: (s5.data.tools || []).length,
        });
    }

    // ── SUMMARY ────────────────────────────────────────────────
    console.log(
        "=== SUMMARY ===",
        JSON.stringify({ passed, failed, total: results.length }),
    );
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error("FATAL:", e.message);
    process.exit(1);
});