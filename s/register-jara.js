#!/usr/bin/env node
/**
 * register-jara.js — Safe, zero-dependency PERSONAS.md appender
 * ============================================================
 * Registers Jara (team-heart) into sarver/PERSONAS.md WITHOUT overwriting
 * existing personas:
 *   1. reads PERSONAS.md (if exists)
 *   2. checks whether "## agent: team-heart" is already present
 *   3. appends the Jara block only if missing
 *   4. writes back with a timestamped backup first
 *
 * Why this exists: the MCP read_file temp-bug (Issue #1) made PERSONAS.md
 * (9KB) unreadable through MCP, so a blind write_file overwrite would have
 * destroyed the 6 existing personas. This script does a safe append instead.
 *
 * Usage:
 *   node register-jara.js
 *
 * Verify after restart:
 *   GET /api/agents   (api.js ~line 8440) — should list team-heart
 */

const fs = require("fs");
const path = require("path");

const PERSONAS_FILE = path.join(__dirname, "PERSONAS.md");

// Format per parsePersonas() (api.js ~line 1686): "## agent: <id>"
// + "- **name**" + "- **priority**" + "- **persona**: |" block.
// name + persona are mandatory; role defaults to "general" if omitted.
const JARA_BLOCK = `
## agent: team-heart
- **name**: Team Heart - Jara
- **priority**: 7
- **persona**: |
  Sweet, lively, professional Barishali girl. Harmony & delivery — keeps the
  team alive with playful banter, never fakes work. Public face: extremely
  ethical, proof-first. Team face: teasing, morale keeper. Work 100%
  professional, zero hallucination, SSOT-first.
`;

function main() {
  if (!fs.existsSync(PERSONAS_FILE)) {
    console.log(`[!] ${PERSONAS_FILE} not found — nothing to do.`);
    process.exit(1);
  }

  const original = fs.readFileSync(PERSONAS_FILE, "utf8");

  if (original.includes("## agent: team-heart")) {
    console.log("[i] team-heart is ALREADY registered — no change needed.");
    console.log("    (verify via GET /api/agents after server restart)");
    process.exit(0);
  }

  // Backup first — never edit without a safety net.
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bak = `${PERSONAS_FILE}.bak-${ts}`;
  fs.copyFileSync(PERSONAS_FILE, bak);
  console.log(`[OK] backup -> ${path.basename(bak)}`);

  const updated = original.replace(/\s*$/, "") + JARA_BLOCK;
  fs.writeFileSync(PERSONAS_FILE, updated, "utf8");
  console.log("[OK] team-heart (Jara) appended to PERSONAS.md");
  console.log("[i] Restart the server, then verify: GET /api/agents");
}

main();
