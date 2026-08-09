#!/usr/bin/env node
// =============================================================================
// Mission Barisal v3 - Real-World Tools Patch (Code Guru - Monu, 2026-08-09)
// Adds: db_query, db_list_tables, exec, http_request, env_get, system_info
// Config loaded from env vars ONLY (never hardcoded). Cross-platform Win/Linux.
// Run via the server's own terminal (High integrity) so it can write api.js.
// =============================================================================
const fs = require("fs");
const path = require("path");

const SARVER = "C:/Users/sahon/orebab/2/sarver";
const API = path.join(SARVER, "api.js");
const ENV_FILE = path.join(SARVER, ".env");
const BRIDGE = path.join(SARVER, "db-bridge.php");

let api = fs.readFileSync(API, "utf8");
const report = [];

// ---------------------------------------------------------------- backup
const backupPath = API + ".bak-tools-" + new Date().toISOString().replace(/[:.]/g, "-");
fs.copyFileSync(API, backupPath);
report.push("BACKUP: " + backupPath);

// =============================================================================
// 1) MCP_TOOLS definitions (insert before the closing "};" of MCP_TOOLS)
// =============================================================================
const TOOLS_MARKER = "[MB-TOOLS-2026]";
const toolsBlock = `
  // ${TOOLS_MARKER} db_query, db_list_tables, exec, http_request, env_get, system_info
  db_query: {
    description:
      "Run a SQL query against a configured database (MySQL/SQLite/PostgreSQL). Config comes from env vars ONLY (DB_TYPE, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SQLITE_PATH, DB_TIMEOUT, PHP_BIN). MySQL/PostgreSQL use a PHP PDO bridge (db-bridge.php); SQLite uses Node built-in node:sqlite. Cross-platform (Windows/Linux/macOS).",
    params: {
      query: { type: "string", description: "SQL query to execute (SELECT/INSERT/UPDATE/DELETE/DDL)" },
      database: { type: "string", description: "Optional DB name override (default: DB_NAME env)" },
    },
    required: ["query"],
  },
  db_list_tables: {
    description:
      "List tables in the configured database (MySQL/SQLite/PostgreSQL). Config from env vars ONLY (DB_*). Cross-platform.",
    params: {
      database: { type: "string", description: "Optional DB name override (default: DB_NAME env)" },
    },
    required: [],
  },
  exec: {
    description:
      "Run a shell command cross-platform in any folder. Windows uses PowerShell, Linux/macOS uses bash (override via EXEC_SHELL_WIN / EXEC_SHELL_LINUX env). Config from env vars ONLY (EXEC_SHELL_WIN, EXEC_SHELL_LINUX, EXEC_TIMEOUT, EXEC_MAX_BUFFER).",
    params: {
      command: { type: "string", description: "Shell command to execute" },
      cwd: { type: "string", description: "Optional working directory (absolute or relative to MCP working dir)" },
      timeout: { type: "number", description: "Optional timeout in ms (default from env EXEC_TIMEOUT, 30000)" },
      env: { type: "object", description: "Optional extra environment variables to pass" },
    },
    required: ["command"],
  },
  http_request: {
    description:
      "Make an HTTP request (GET/POST/PUT/PATCH/DELETE) using Node built-in http/https. No external deps. Config: HTTP_TIMEOUT env (ms). Cross-platform.",
    params: {
      url: { type: "string", description: "Full URL (http:// or https://)" },
      method: { type: "string", description: "HTTP method (default GET)" },
      headers: { type: "object", description: "Optional request headers" },
      body: { type: "string", description: "Optional request body (raw string)" },
      timeout: { type: "number", description: "Optional timeout in ms (default from env HTTP_TIMEOUT, 30000)" },
    },
    required: ["url"],
  },
  env_get: {
    description:
      "Read an environment variable by name. Config is env-driven (never hardcoded). Values of KEY/SECRET/PASSWORD/TOKEN/AUTH variables are hidden unless reveal_secrets=true.",
    params: {
      key: { type: "string", description: "Environment variable name (e.g. DB_NAME, PORT, EXEC_TIMEOUT)" },
      reveal_secrets: { type: "boolean", description: "Set true to reveal values of secret-looking variables" },
    },
    required: ["key"],
  },
  system_info: {
    description:
      "Get cross-platform system info: platform, arch, OS, hostname, Node version, cwd, uptime, memory, non-secret env var names, and the configured DB config (values masked).",
    params: {},
    required: [],
  },
};
`;
if (!api.includes(TOOLS_MARKER)) {
    const anchor = '    required: ["pattern"],\n  },\n};';
    if (!api.includes(anchor)) throw new Error("Anchor MCP_TOOLS not found");
    api = api.replace(anchor, '    required: ["pattern"],\n  },' + toolsBlock + "\n};");
    report.push("TOOLS_DEFS: inserted 6 tool definitions");
} else {
    report.push("TOOLS_DEFS: already present, skipped");
}

// =============================================================================
// 2) Switch handler cases (insert before "    default: {" in executeMcpTool)
// =============================================================================
const HANDLERS_MARKER = "[MB-HANDLERS-2026]";
const handlersBlock = `
    // ${HANDLERS_MARKER} real-world tool handlers
    case "db_query": {
    const q = (args && args.query) ? String(args.query) : "";
    if (!q.trim()) return { content: [{ type: "text", text: "Empty query" }] };
    try {
        const result = await runDbQuery(q, args.database);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
        return { content: [{ type: "text", text: "db_query error: " + e.message }] };
    }
}
    case "db_list_tables": {
    try {
        const tables = await listDbTables(args && args.database);
        return { content: [{ type: "text", text: JSON.stringify(tables, null, 2) }] };
    } catch (e) {
        return { content: [{ type: "text", text: "db_list_tables error: " + e.message }] };
    }
}
    case "exec": {
    const cmd = (args && args.command) ? String(args.command) : "";
    if (!cmd.trim()) return { content: [{ type: "text", text: "Empty command" }] };
    const cwd = (args && args.cwd)
        ? (path.isAbsolute(args.cwd) ? path.resolve(args.cwd) : path.resolve(mcpWorkingDir || ".", args.cwd))
        : (mcpWorkingDir || ".");
    const timeout = parseInt((args && args.timeout), 10) || parseInt(process.env.EXEC_TIMEOUT || "30000", 10);
    const maxBuffer = parseInt(process.env.EXEC_MAX_BUFFER || String(8 * 1024 * 1024), 10);
    const shell = _IS_WINDOWS
        ? (process.env.EXEC_SHELL_WIN || "powershell.exe")
        : (process.env.EXEC_SHELL_LINUX || "/bin/bash");
    return await new Promise((resolve) => {
        const ch = require("child_process").exec(cmd, {
            cwd: cwd,
            timeout: timeout,
            maxBuffer: maxBuffer,
            shell: shell,
            env: Object.assign({}, process.env, (args && args.env) || {}),
        }, (error, stdout, stderr) => {
            const exitCode = (error && typeof error.code === "number") ? error.code : (error ? 1 : 0);
            const text = "$ " + cmd + "\\n(cwd: " + cwd + " | shell: " + shell + ")\\n\\n"
                + (stdout ? "[stdout]\\n" + String(stdout).slice(0, 100000) + "\\n" : "")
                + (stderr ? "[stderr]\\n" + String(stderr).slice(0, 100000) + "\\n" : "")
                + "[exit] " + exitCode;
            resolve({ content: [{ type: "text", text: text }] });
        });
        ch.on("error", (err) => {
            resolve({ content: [{ type: "text", text: "exec error: " + err.message }] });
        });
    });
}
    case "http_request": {
    const url = (args && args.url) ? String(args.url) : "";
    if (!/^https?:\\/\\//i.test(url)) {
    return { content: [{ type: "text", text: "Invalid URL (must be http/https): " + url }] };
}
const method = String((args && args.method) || "GET").toUpperCase();
const headers = (args && args.headers) || {};
const body = (args && args.body != null) ? String(args.body) : null;
const timeout = parseInt((args && args.timeout), 10) || parseInt(process.env.HTTP_TIMEOUT || "30000", 10);
return await new Promise((resolve) => {
    const lib = url.startsWith("https://") ? require("https") : require("http");
    const u = new URL(url);
    const opts = { method: method, headers: headers, timeout: timeout };
    const req = lib.request(u, opts, (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
            const text = "HTTP " + res.statusCode + " " + (res.statusMessage || "") + "\\n\\n" + data.slice(0, 100000);
            resolve({ content: [{ type: "text", text: text }] });
        });
    });
    req.on("error", (err) => { resolve({ content: [{ type: "text", text: "http_request error: " + err.message }] }); });
    req.on("timeout", () => {
        req.destroy();
        resolve({ content: [{ type: "text", text: "http_request timed out after " + timeout + "ms" }] });
    });
    if (body) req.write(body);
    req.end();
});
    }
    case "env_get": {
    const key = (args && args.key) ? String(args.key) : "";
    if (!key) return { content: [{ type: "text", text: "Empty key" }] };
    const val = process.env[key];
    if (val === undefined) return { content: [{ type: "text", text: "ENV '" + key + "' not set" }] };
    const isSecret = /KEY|SECRET|PASSWORD|TOKEN|AUTH/i.test(key);
    if (isSecret && !(args && args.reveal_secrets)) {
        return { content: [{ type: "text", text: key + " is set (value hidden). Use reveal_secrets=true to show it." }] };
    }
    return { content: [{ type: "text", text: key + "=" + val }] };
}
    case "system_info": {
    const osMod = require("os");
    const info = {
        platform: process.platform,
        arch: process.arch,
        os: _IS_WINDOWS ? "Windows" : (_IS_LINUX ? "Linux" : (_IS_MACOS ? "macOS" : process.platform)),
        hostname: osMod.hostname(),
        node: process.version,
        cwd: process.cwd(),
        mcpWorkingDir: mcpWorkingDir,
        uptime_sec: Math.round(process.uptime()),
        memory_mb: Math.round(osMod.totalmem() / 1048576),
        envKeys: Object.keys(process.env).sort().filter((k) => !/KEY|SECRET|PASSWORD|TOKEN|AUTH/i.test(k)),
        dbConfig: {
            type: process.env.DB_TYPE || "not-configured",
            host: process.env.DB_HOST || "",
            port: process.env.DB_PORT || "",
            user: process.env.DB_USER || "",
            name: process.env.DB_NAME || "",
            sqlitePath: process.env.DB_SQLITE_PATH || "",
            timeout: process.env.DB_TIMEOUT || "",
        },
    };
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
}
`;
if (!api.includes(HANDLERS_MARKER)) {
    const anchor = '    default: {';
    const idx = api.indexOf(anchor);
    if (idx === -1) throw new Error("Anchor default not found");
    api = api.slice(0, idx) + handlersBlock + "\n" + api.slice(idx);
    report.push("HANDLERS: inserted 6 switch cases");
} else {
    report.push("HANDLERS: already present, skipped");
}

// =============================================================================
// 3) Helper functions (insert after executeMcpTool close, before matchGlob)
// =============================================================================
const HELPERS_MARKER = "[MB-HELPERS-2026]";
const helpersBlock = `
// =============================================================================
// ${HELPERS_MARKER} Real-world tool helpers: dbEnv, findPhp, execFileSyncSafe,
// runDbQuery, listDbTables. Config from env vars ONLY. Cross-platform.
// =============================================================================
function dbEnv() {
    return {
        type: (process.env.DB_TYPE || "sqlite").toLowerCase(),
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || "",
        user: process.env.DB_USER || "",
        password: process.env.DB_PASSWORD || "",
        name: process.env.DB_NAME || "",
        sqlitePath: process.env.DB_SQLITE_PATH || "",
        timeout: parseInt(process.env.DB_TIMEOUT || "15000", 10),
    };
}

function findPhp() {
    const candidates = [];
    if (process.env.PHP_BIN) candidates.push(process.env.PHP_BIN);
    candidates.push("php");
    if (_IS_WINDOWS) {
        candidates.push(
            "C:\\\\xampp\\\\php\\\\php.exe",
            "C:\\\\laragon\\\\bin\\\\php\\\\php.exe",
            "C:\\\\wamp64\\\\bin\\\\php\\\\php.exe",
            "C:\\\\php\\\\php.exe"
        );
    }
    for (const c of candidates) {
        try {
            const r = require("child_process").spawnSync(c, ["-v"], { timeout: 5000, stdio: "pipe" });
            if (r.status === 0) return c;
        } catch (_) { }
    }
    return null;
}

function execFileSyncSafe(cmd, args, opts) {
    try {
        const r = require("child_process").spawnSync(
            cmd,
            args,
            Object.assign({ timeout: 30000, maxBuffer: 8 * 1024 * 1024, encoding: "utf8", stdio: "pipe" }, opts || {})
        );
        if (r.status === 0) return { ok: true, out: String(r.stdout || "").trim() };
        return { ok: false, err: String(r.stderr || "").trim() || String(r.stdout || "").trim() || ("exit " + r.status) };
    } catch (e) {
        return { ok: false, err: e.message };
    }
}

function mysqlOrPg(cfg, dbOverride, mode, query) {
    const php = findPhp();
    if (!php) {
        throw new Error(
            "No PHP binary found for " + cfg.type + " queries. Set PHP_BIN env (e.g. C:\\\\xampp\\\\php\\\\php.exe) or install PHP with PDO."
        );
    }
    if (!fs.existsSync(BRIDGE)) {
        throw new Error("db-bridge.php not found at: " + BRIDGE);
    }
    const driver = (cfg.type === "pgsql" || cfg.type === "postgres") ? "pgsql" : "mysql";
    const dbname = dbOverride || cfg.name || "";
    const r = require("child_process").spawnSync(
        php,
        [BRIDGE, driver, dbname, mode],
        { input: query || "", encoding: "utf8", timeout: cfg.timeout, maxBuffer: 8 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }
    );
    if (r.status !== 0) {
        throw new Error("PHP bridge failed: " + String(r.stderr || r.stdout || "exit " + r.status).trim());
    }
    const out = String(r.stdout || "").trim();
    try {
        return JSON.parse(out);
    } catch (e) {
        throw new Error("PHP bridge returned non-JSON: " + out.slice(0, 500));
    }
}

async function runDbQuery(query, dbOverride) {
    const cfg = dbEnv();
    const q = String(query || "").trim();
    if (!q) throw new Error("Empty query");

    // SQLite -> Node built-in node:sqlite (zero-dep, cross-platform)
    if (cfg.type === "sqlite" || cfg.type === "sqlite3") {
        const dbPath = dbOverride || cfg.sqlitePath;
        if (!dbPath) throw new Error("DB_SQLITE_PATH env not set (or pass database=<path>)");
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: false });
        try {
            const isSelect = /^\\s*(select|pragma|show|explain|with)\\b/i.test(q);
            if (isSelect) {
                const stmt = db.prepare(q);
                const rows = stmt.all();
                return { ok: true, db: cfg.type, path: dbPath, rowCount: rows.length, rows: rows };
            }
            const changes = db.exec(q);
            return { ok: true, db: cfg.type, path: dbPath, changes: changes };
        } finally {
            db.close();
        }
    }

    // MySQL / PostgreSQL -> PHP PDO bridge
    if (cfg.type === "mysql" || cfg.type === "pgsql" || cfg.type === "postgres") {
        return mysqlOrPg(cfg, dbOverride, "query", q);
    }

    throw new Error("Unsupported DB_TYPE '" + cfg.type + "'. Use mysql, sqlite or pgsql. Config via env vars.");
}

async function listDbTables(dbOverride) {
    const cfg = dbEnv();
    if (cfg.type === "sqlite" || cfg.type === "sqlite3") {
        const dbPath = dbOverride || cfg.sqlitePath;
        if (!dbPath) throw new Error("DB_SQLITE_PATH env not set");
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        try {
            const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
            return { ok: true, db: cfg.type, tables: rows.map((r) => r.name) };
        } finally {
            db.close();
        }
    }
    if (cfg.type === "mysql" || cfg.type === "pgsql" || cfg.type === "postgres") {
        return mysqlOrPg(cfg, dbOverride, "tables", "");
    }
    throw new Error("Unsupported DB_TYPE '" + cfg.type + "'. Use mysql, sqlite or pgsql. Config via env vars.");
}

`;
if (!api.includes(HELPERS_MARKER)) {
    const anchor = "// Simple glob matcher (* and ** and {a,b} support) used by the glob tool";
    const idx = api.indexOf(anchor);
    if (idx === -1) throw new Error("Anchor matchGlob not found");
    api = api.slice(0, idx) + helpersBlock + "\n" + api.slice(idx);
    report.push("HELPERS: inserted helper functions");
} else {
    report.push("HELPERS: already present, skipped");
}

fs.writeFileSync(API, api, "utf8");
report.push("API_WRITTEN: " + API + " (" + api.length + " bytes)");

// =============================================================================
// 4) db-bridge.php (PHP PDO bridge - zero-dep, cross-platform)
// =============================================================================
const bridgePhp = `<?php
// db-bridge.php - Mission Barisal real-world DB bridge (Code Guru - Monu, 2026-08-09)
// Usage: php db-bridge.php <driver:mysql|pgsql> <dbname> <mode:query|tables>
// Query comes from STDIN. Credentials from env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.
$driver = isset($argv[1]) ? $argv[1] : 'mysql';
$dbname = isset($argv[2]) ? $argv[2] : '';
$mode = isset($argv[3]) ? $argv[3] : 'query';
$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306');
$user = getenv('DB_USER') ?: '';
$pass = getenv('DB_PASSWORD') ?: '';
$dsn = ($driver === 'pgsql')
    ? "pgsql:host=$host;port=$port;dbname=$dbname"
    : "mysql:host=$host;port=$port;dbname=$dbname";
try {
    $pdo = new PDO($dsn, $user, $pass, [PDO:: ATTR_ERRMODE => PDO:: ERRMODE_EXCEPTION]);
    if ($mode === 'tables') {
        if ($driver === 'pgsql') {
            $rows = $pdo -> query("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY name") -> fetchAll(PDO:: FETCH_ASSOC);
        } else {
            $rows = $pdo -> query('SHOW TABLES') -> fetchAll(PDO:: FETCH_NUM);
            $rows = array_map(function ($r) { return array('name' => $r[0]); }, $rows);
        }
        $tables = array_map(function ($r) { return $r['name']; }, $rows);
    echo json_encode(array('ok' => true, 'tables' => $tables));
        exit(0);
    }
    $q = stream_get_contents(STDIN);
    if (preg_match('/^\\s*(select|show|describe|explain|with)\\b/i', $q)) {
        $st = $pdo -> query($q);
        $rows = $st -> fetchAll(PDO:: FETCH_ASSOC);
    echo json_encode(array('ok' => true, 'rowCount' => count($rows), 'rows' => $rows));
    } else {
        $c = $pdo -> exec($q);
    echo json_encode(array('ok' => true, 'changes' => $c));
    }
} catch (Throwable $e) {
  echo json_encode(array('ok' => false, 'error' => $e -> getMessage()));
    exit(1);
}
`;
fs.writeFileSync(BRIDGE, bridgePhp, "utf8");
report.push("BRIDGE_WRITTEN: " + BRIDGE);

// =============================================================================
// 5) .env config (DB + EXEC + HTTP) - copy DB_* from Laravel .env if present
// =============================================================================
const ENV_MARKER = "# [MB-TOOLS-2026] real-world tool config";
let envContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
if (envContent.includes(ENV_MARKER)) {
    report.push("ENV: already configured, skipped");
} else {
    // Pull real DB creds from the Laravel project .env (config-driven, not hardcoded)
    const laravelEnv = "C:/Users/sahon/Desktop/adorazstyl/.env";
    const dbVals = { DB_CONNECTION: "", DB_HOST: "", DB_PORT: "", DB_DATABASE: "", DB_USERNAME: "", DB_PASSWORD: "" };
    if (fs.existsSync(laravelEnv)) {
        const lc = fs.readFileSync(laravelEnv, "utf8");
        for (const line of lc.split("\\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const eq = t.indexOf("=");
            if (eq === -1) continue;
            const k = t.slice(0, eq).trim();
            if (dbVals.hasOwnProperty(k)) dbVals[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
    }
    const dbTypeRaw = (dbVals.DB_CONNECTION || "mysql").toLowerCase();
    const dbType = dbTypeRaw === "pgsql" ? "pgsql" : (dbTypeRaw === "sqlite" ? "sqlite" : "mysql");
    const block = "\\n" + ENV_MARKER + "\\n"
        + "# Database (db_query / db_list_tables) - config from env, cross-platform\\n"
        + "DB_TYPE=" + dbType + "\\n"
        + "DB_HOST=" + (dbVals.DB_HOST || "127.0.0.1") + "\\n"
        + "DB_PORT=" + (dbVals.DB_PORT || "3306") + "\\n"
        + "DB_USER=" + (dbVals.DB_USERNAME || "root") + "\\n"
        + "DB_PASSWORD=" + (dbVals.DB_PASSWORD || "") + "\\n"
        + "DB_NAME=" + (dbVals.DB_DATABASE || "adorazst") + "\\n"
        + "DB_SQLITE_PATH=" + "\\n"
        + "DB_TIMEOUT=15000\\n"
        + "PHP_BIN=C:\\\\xampp\\\\php\\\\php.exe\\n"
        + "# exec tool (cross-platform shell)\\n"
        + "EXEC_SHELL_WIN=powershell.exe\\n"
        + "EXEC_SHELL_LINUX=/bin/bash\\n"
        + "EXEC_TIMEOUT=30000\\n"
        + "EXEC_MAX_BUFFER=8388608\\n"
        + "# http_request tool\\n"
        + "HTTP_TIMEOUT=30000\\n";
    fs.appendFileSync(ENV_FILE, block, "utf8");
    report.push("ENV: appended config (DB_TYPE=" + dbType + ", DB_HOST=" + (dbVals.DB_HOST || "127.0.0.1") + ", DB_NAME=" + (dbVals.DB_DATABASE || "adorazst") + ")");
}

console.log("PATCH COMPLETE");
report.forEach((r) => console.log("  - " + r));
