#!/usr/bin/env node
// =============================================================================
// Mission Barisal v3 — Cross-Platform Start Script
// Entry point with two user-facing options:
//   1) CONFIG ALL  — write config.json to the OS default directory
//                    (Windows: %USERPROFILE%\.zombiecoder\, Linux/macOS: $HOME/.zombiecoder/)
//   2) START ALL   — load .env + config, then boot the main server (api.js)
// No hardcoded paths — every location is resolved at runtime per-OS.
// =============================================================================

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const VERSION = "3.0.0";
const CONFIG_DIR = path.join(os.homedir(), ".zombiecoder");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// ---------------------------------------------------------------------------
// Environment loader (unchanged behavior, kept dependency-free)
// ---------------------------------------------------------------------------
function loadEnv() {
  try {
    const envPath = path.resolve(".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
      console.log("[ENV] Loaded:", envPath);
    }
  } catch (_) { }
}

// ---------------------------------------------------------------------------
// OS default directory resolution (no hardcoded C:\ or /home paths)
// ---------------------------------------------------------------------------
function getDefaultConfig() {
  return {
    version: VERSION,
    serverPort: Number(process.env.SERVER_PORT) || Number(process.env.PORT) || 5000,
    udsPath:
      process.env.ZOMBIECODER_UDS_PATH ||
      path.join(os.tmpdir(), "zombiecoder", "mcp.sock"),
    workingDir: process.cwd(),
    homeDir: os.homedir(),
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CONFIG ALL — write config.json to the OS default directory
// ---------------------------------------------------------------------------
function configAll() {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const cfg = getDefaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
    console.log("");
    console.log("[CONFIG ALL] config.json created at:");
    console.log("  " + CONFIG_PATH);
    console.log("");
    console.log("  serverPort :", cfg.serverPort);
    console.log("  udsPath    :", cfg.udsPath);
    console.log("  workingDir :", cfg.workingDir);
    console.log("  homeDir    :", cfg.homeDir);
    console.log("");
    console.log("This location is OS-default (os.homedir()). The server and the");
    console.log("extension can both read it from any working directory.");
    return 0;
  } catch (err) {
    console.error("[CONFIG ALL] Failed:", err.message);
    return 1;
  }
}

// ---------------------------------------------------------------------------
// START ALL — load env + config, then boot the main server
// ---------------------------------------------------------------------------
function startAll() {
  loadEnv();

  // Auto-ensure config exists in the OS default directory (idempotent).
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(getDefaultConfig(), null, 2), "utf8");
      console.log("[CONFIG] Auto-created:", CONFIG_PATH);
    } else {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      console.log("[CONFIG] Loaded:", CONFIG_PATH);
      // Env vars take priority over config.json (so PORT/SERVER_PORT in .env win)
      if (cfg.serverPort && !process.env.SERVER_PORT && !process.env.PORT) {
        process.env.PORT = String(cfg.serverPort);
      }
    }
  } catch (err) {
    console.warn("[CONFIG] Warning — continuing without config:", err.message);
  }

  console.log("[START ALL] Booting Mission Barisal v" + VERSION + " ...");
  require("./api.js");
}

// ---------------------------------------------------------------------------
// Interactive prompt (user-facing strings stay in English)
// ---------------------------------------------------------------------------
function showMenu() {
  console.log("");
  console.log("==============================================");
  console.log("  Mission Barisal v" + VERSION + " — Starter");
  console.log("==============================================");
  console.log("");
  console.log("  1) CONFIG ALL — write config to the OS default directory");
  console.log("                  Windows: %USERPROFILE%\\.zombiecoder\\");
  console.log("                  Linux  : $HOME/.zombiecoder/");
  console.log("  2) START ALL  — load .env + config, then boot the server");
  console.log("  0) Exit");
  console.log("");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Choose an option (1/2/0): ", (answer) => {
    rl.close();
    const a = (answer || "").trim();
    if (a === "1") process.exitCode = configAll();
    else if (a === "2") startAll();
    else {
      console.log("Bye!");
      process.exit(0);
    }
  });
}

// ---------------------------------------------------------------------------
// CLI flag parsing (non-interactive mode)
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage:");
  console.log("  node start.js                  interactive menu (CONFIG ALL / START ALL)");
  console.log("  node start.js --config-all -c  run CONFIG ALL (write config.json)");
  console.log("  node start.js --start-all -s   run START ALL (boot the server)");
  process.exit(0);
}

if (args.includes("--config-all") || args.includes("-c")) {
  process.exitCode = configAll();
} else if (args.includes("--start-all") || args.includes("-s")) {
  startAll();
} else {
  showMenu();
}
