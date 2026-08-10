#!/usr/bin/env node
// =============================================================================
// Mission Barisal — Live Server Smoke Test
// -----------------------------------------------------------------------------
// Usage:
//   node test-live.js [BASE_URL] [--crud]
//
//   BASE_URL  default: https://mission-barisal.onrender.com
//   --crud    also run the full users CRUD round-trip (SAFE ONLY on
//             test/local servers — do NOT run against live production data)
//
// Output: JSON report — one entry per test with status PASS / FAIL / MISSING.
// Read-only by default; no writes to the server unless --crud is passed.
// =============================================================================

const BASE_URL = (process.argv[2] || "https://mission-barisal.onrender.com").replace(/\/+$/, "");
const CRUD = process.argv.includes("--crud");
const TIMEOUT_MS = 30000;

const results = [];
let crudUser = null; // { id, api_key } when a round-trip user was created

function report(name, ok, detail) {
    results.push({ test: name, status: ok ? "PASS" : detail && detail.missing ? "MISSING" : "FAIL", detail });
}

async function request(method, path, { body, headers = {}, raw = false, timeout = TIMEOUT_MS } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(BASE_URL + path, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });
        const text = await res.text();
        clearTimeout(t);
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) { /* not json */ }
        return { status: res.status, ok: res.ok, text, json, type: res.headers.get("content-type") || "" };
    } catch (e) {
        clearTimeout(t);
        return { status: 0, ok: false, text: "", json: null, error: e.message };
    }
}

// ─── 1. Health ──────────────────────────────────────────────────────────────
async function testHealth() {
    const r = await request("GET", "/health");
    const healthy = r.json && r.json.healthy === true;
    report("GET /health", r.status === 200 && healthy, {
        status: r.status,
        version: r.json && r.json.version,
        models: r.json && r.json.models,
        agents: r.json && r.json.agents,
        domain: r.json && r.json.domain,
        missing: r.status === 404,
    });
}

// ─── 2. Identity / Status ───────────────────────────────────────────────────
async function testIdentityStatus() {
    for (const p of ["/identity", "/status"]) {
        const r = await request("GET", p);
        report(`GET ${p}`, r.status === 200, { status: r.status, missing: r.status === 404 });
    }
}

// ─── 3. Models list ─────────────────────────────────────────────────────────
async function testModels() {
    const r = await request("GET", "/v1/models");
    const count = r.json && Array.isArray(r.json.data) ? r.json.data.length : 0;
    report("GET /v1/models", r.status === 200 && count > 0, {
        status: r.status,
        model_count: count,
        missing: r.status === 404,
    });
}

// ─── 4. Root page ───────────────────────────────────────────────────────────
async function testRoot() {
    const r = await request("GET", "/");
    const isHtml = (r.type || "").includes("html");
    const title = (r.text.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
    report("GET / (root)", r.status === 200 && isHtml, {
        status: r.status,
        title,
        bytes: r.text.length,
        missing: r.status === 404,
    });
}

// ─── 5. Static pages (public/ serve — NEW code only) ────────────────────────
async function testStaticPages() {
    const pages = ["/admin.html", "/chat.html", "/api-tester.html", "/docs.html"];
    for (const p of pages) {
        const r = await request("GET", p);
        const isHtml = (r.type || "").includes("html");
        report(`GET ${p} (static)`, r.status === 200 && isHtml, {
            status: r.status,
            bytes: r.text.length,
            missing: r.status === 404,
        });
    }
}

// ─── 6. Admin users GET (NEW code only) ─────────────────────────────────────
async function testAdminUsers() {
    const r = await request("GET", "/api/admin/users");
    const count = r.json ? r.json.count : undefined;
    report("GET /api/admin/users", r.status === 200, {
        status: r.status,
        count,
        missing: r.status === 404,
    });
}

// ─── 7. Session verify (GET route — verified in api.js:13459) ───────────────
async function testVerifySession() {
    // Probe WITHOUT session_id: route exists iff we get 400 with
    // supported_methods (NOT a bare 404 with {"error":"Not found"}).
    const r = await request("GET", "/api/verify-session");
    const isBare404 = r.status === 404 && r.text.trim() === '{"error":"Not found"}';
    const routeExists = r.status === 400 && r.json && Array.isArray(r.json.supported_methods);
    report("GET /api/verify-session (route)", routeExists && !isBare404, {
        status: r.status,
        has_supported_methods: !!(r.json && r.json.supported_methods),
        missing: isBare404,
    });
}

// ─── 8. (--crud only) Full users round-trip ─────────────────────────────────
async function testCrud() {
    if (!CRUD) return;
    // Create
    const created = await request("POST", "/api/admin/users", {
        body: { name: "Test User", token_limit: 3, valid_days: 30 },
    });
    if (created.status !== 200 || !created.json || !created.json.api_key) {
        report("CRUD create user", false, { status: created.status, body: created.text.slice(0, 120) });
        return;
    }
    crudUser = { id: created.json.user && created.json.user.id, api_key: created.json.api_key };
    report("CRUD POST /api/admin/users", true, {
        api_key: crudUser.api_key.slice(0, 10) + "...",
        note: created.json.note,
    });

    // Find the created user id (POST response may omit it)
    if (!crudUser.id) {
        const list = await request("GET", "/api/admin/users");
        if (list.json && Array.isArray(list.json.users)) {
            const row = list.json.users.find((u) => u.name === "Test User");
            if (row) crudUser.id = row.id;
        }
    }

    // Update
    if (crudUser.id) {
        const up = await request("PUT", `/api/admin/users/${crudUser.id}`, {
            body: { token_limit: 5, valid_days: 30 },
        });
        report("CRUD PUT /api/admin/users/:id", up.status === 200 && up.json && up.json.ok, {
            status: up.status,
            user: up.json && up.json.user,
        });

        // Limit enforcement: drive token_used to the limit via direct DB is not possible
        // remotely, so we rely on the create-time limit (3) — fire 4 quick chats and
        // expect the 4th to be blocked with 403 (token limit reached).
        let blocked = null;
        for (let i = 0; i < 4; i++) {
            const ch = await request("POST", "/v1/chat/completions", {
                headers: { "X-API-Key": crudUser.api_key },
                body: { model: "mission", messages: [{ role: "user", content: "hi" }], stream: false },
                timeout: 45000,
            });
            if (ch.status === 403 && ch.json && ch.json.error) { blocked = ch.json.error; break; }
        }
        report("CRUD limit enforcement (403 on quota)", !!blocked, blocked || { note: "no 403 after 4 chats" });

        // Delete (cleanup)
        const del = await request("DELETE", `/api/admin/users/${crudUser.id}`);
        report("CRUD DELETE /api/admin/users/:id", del.status === 200 && del.json && del.json.ok, {
            status: del.status,
            id: del.json && del.json.id,
        });
    } else {
        report("CRUD PUT/DELETE", false, { error: "could not resolve created user id" });
    }
}

// ─── Runner ─────────────────────────────────────────────────────────────────
(async () => {
    console.log(`Mission Barisal — Live Smoke Test`);
    console.log(`Target : ${BASE_URL}`);
    console.log(`Mode   : ${CRUD ? "read-only + FULL CRUD round-trip" : "read-only (safe)"}`);
    console.log("─".repeat(60));

    await testHealth();
    await testIdentityStatus();
    await testModels();
    await testRoot();
    await testStaticPages();
    await testAdminUsers();
    await testVerifySession();
    await testCrud();

    const pass = results.filter((r) => r.status === "PASS").length;
    const fail = results.filter((r) => r.status === "FAIL").length;
    const missing = results.filter((r) => r.status === "MISSING").length;

    console.log(JSON.stringify({ target: BASE_URL, crud: CRUD, summary: { pass, fail, missing, total: results.length }, results }, null, 2));
    console.log("─".repeat(60));
    console.log(`SUMMARY: ${pass} passed, ${fail} failed, ${missing} missing (endpoint not deployed) — total ${results.length}`);
    process.exit(fail > 0 ? 1 : 0);
})();
