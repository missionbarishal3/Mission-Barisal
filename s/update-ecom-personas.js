// update-ecom-personas.js
// Sync Bangladesh-market personas from PERSONAS.md into the agents DB table.
// DB is the PRIMARY source in loadPersonas() (PHASE A), so file edits alone
// do NOT take effect for agents already registered in the DB.
//
// IMPORTANT: This mirrors the server's OWN extractPersona() logic from api.js
// so the DB content matches exactly what parsePersonas() would produce.
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = "data/models.db";
const PERSONAS_FILE = "PERSONAS.md";
const TARGET_IDS = new Set([
  "customer-experience-specialist",
  "ecommerce-operations-analyst",
]);

// Exact copy of api.js extractPersona() — keeps behavior identical
function extractPersona(block) {
  const match = block.match(
    /\*\*persona\*\*:\s*\|\s*\n([\s\S]*?)(?:^- \*\*|^##\s|^---|\n\n(?!  )|$(?![\s\S]))/m,
  );
  if (match) {
    return match[1]
      .split("\n")
      .map((l) => l.replace(/^  /, "").trim())
      .filter((l) => l && !l.startsWith("- "))
      .join("\n");
  }
  return null;
}

// Mirror parsePersonas() model-name stripping + whitespace collapse
const modelNames =
  /deepseek-v4-flash-free|mimo-v2\.5-free|big-pickle|nemotron-3-ultra-free|north-mini-code-free|hy3-free/gi;

function main() {
  const content = fs.readFileSync(PERSONAS_FILE, "utf8");
  const blocks = content.split(/^## agent:/m).slice(1);
  const db = new DatabaseSync(DB_PATH);
  let updated = 0;

  for (const block of blocks) {
    const idMatch = block.match(/^\s*([^\n]+)/);
    const id = idMatch ? idMatch[1].trim() : "";
    if (!TARGET_IDS.has(id)) continue;

    let persona = extractPersona(block);
    if (!persona) {
      console.log("FAILED to extract persona for", id);
      continue;
    }
    persona = persona.replace(modelNames, "AI model").replace(/\s{2,}/g, " ").trim();

    const result = db
      .prepare("UPDATE agents SET persona = ? WHERE id = ?")
      .run(persona, id);
    console.log(
      "UPDATED",
      id,
      "| persona chars:",
      persona.length,
      "| changes:",
      result.changes
    );
    updated++;
  }

  console.log("Total updated:", updated);

  // Verify
  const verify = db
    .prepare(
      "SELECT id, substr(persona, 1, 200) AS preview, length(persona) AS len FROM agents WHERE id IN ('customer-experience-specialist','ecommerce-operations-analyst')"
    )
    .all();
  console.log("\n=== VERIFY ===");
  for (const v of verify) {
    console.log("\n---", v.id, "| len:", v.len, "---");
    console.log(v.preview);
  }
}

main();
