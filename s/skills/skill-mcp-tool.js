/**
 * 🎯 SKILL.md Plugin MCP Tool v2.0
 * 
 * An MCP tool that reads/parses skill files in two formats:
 *   1. Subdirectory/SKILL.md — YAML frontmatter format (industry standard)
 *   2. Flat .md files — Simple key-value format used in Mission Barisal
 * 
 * Usable internally (by our agents) AND externally (by other editors).
 * 
 * This tool spreads the "skill kingdom" everywhere —
 * any editor that supports MCP can use our skills.
 */

// ─── Dependencies ──────────────────────────────────────────
// Pure Node.js — no npm install needed
const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────
const SKILLS_ROOT = process.env.SKILLS_DIR || path.join(__dirname);
const SUPPORTED_FORMATS = ['SKILL.md', 'skill.md'];

// ─── Tool: list_skills ─────────────────────────────────────
// Lists all available skills with metadata
// Supports BOTH subdirectory/SKILL.md AND flat .md files
function listSkills() {
  const results = [];

  if (!fs.existsSync(SKILLS_ROOT)) {
    return { error: `Skills directory not found: ${SKILLS_ROOT}` };
  }

  const entries = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });

  // ── Pass 1: Subdirectory/SKILL.md format ──
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(SKILLS_ROOT, entry.name);
    const skillFile = findSkillFile(skillDir);

    if (!skillFile) continue;

    const parsed = parseSkillFile(skillFile);
    if (parsed) {
      results.push({
        name: parsed.name,
        description: parsed.description,
        shortDescription: parsed.metadata['short-description'] || parsed.metadata.description || '',
        author: parsed.metadata.author || 'unknown',
        source: parsed.metadata.source || '',
        category: parsed.metadata.category || '',
        path: skillFile,
        format: 'SKILL.md',
      });
    }
  }

  // ── Pass 2: Flat .md files in root (Mission Barisal format) ──
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md') && !entry.name.endsWith('.MD')) continue;
    // Skip known non-skill files
    if (entry.name.startsWith('_') || entry.name === 'README.md' || entry.name === 'Ethical.md' || entry.name === 'skill-mcp-tool.js') continue;

    const skillFile = path.join(SKILLS_ROOT, entry.name);

    // Check if already added via subdirectory format
    const skillName = entry.name.replace(/\.md$/i, '');
    if (results.some(r => r.name === skillName)) continue;

    const parsed = parseSimpleSkillFile(skillFile);
    if (parsed) {
      results.push({
        name: parsed.name || skillName,
        description: parsed.description || (parsed.metadata && parsed.metadata.description) || '',
        shortDescription: parsed.metadata && (parsed.metadata['short-description'] || parsed.metadata.description || ''),
        author: (parsed.metadata && parsed.metadata.author) || 'Mission Barisal',
        source: (parsed.metadata && parsed.metadata.source) || '',
        category: (parsed.metadata && parsed.metadata.category) || 'general',
        path: skillFile,
        format: 'flat-md',
      });
    }
  }

  // Sort: subdirectory skills first, then alphabetical
  results.sort((a, b) => {
    if (a.format !== b.format) return a.format === 'SKILL.md' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { skills: results, count: results.length };
}

// ─── Tool: read_skill ─────────────────────────────────────
// Reads a specific skill's full content by name
// Supports BOTH subdirectory/SKILL.md AND flat .md files
function readSkill(skillName) {
  if (!skillName || typeof skillName !== 'string') {
    return { error: 'Skill name is required' };
  }

  const normalized = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // ── Try 1: Subdirectory with SKILL.md ──
  const skillDir = path.join(SKILLS_ROOT, normalized);
  if (fs.existsSync(skillDir)) {
    const skillFile = findSkillFile(skillDir);
    if (skillFile) {
      const parsed = parseSkillFile(skillFile);
      if (parsed) return parsed;
    }
  }

  // ── Try 2: Flat .md file in root ──
  const flatFile = path.join(SKILLS_ROOT, normalized + '.md');
  if (fs.existsSync(flatFile)) {
    const parsed = parseSimpleSkillFile(flatFile);
    if (parsed) return parsed;
  }

  // ── Try 3: Case-insensitive flat file search ──
  const entries = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const baseName = entry.name.replace(/\.md$/i, '').toLowerCase();
    if (baseName === normalized) {
      const parsed = parseSimpleSkillFile(path.join(SKILLS_ROOT, entry.name));
      if (parsed) return parsed;
    }
  }

  return { error: `Skill "${skillName}" not found in directory or flat files` };
}

// ─── Tool: search_skills ───────────────────────────────────
// Searches skills by keyword (name, description, content)
function searchSkills(query) {
  if (!query || typeof query !== 'string') {
    return { error: 'Search query is required' };
  }

  const all = listSkills();
  if (all.error) return all;

  const q = query.toLowerCase();
  const matched = all.skills.filter(skill => {
    return (
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q) ||
      (skill.shortDescription || '').toLowerCase().includes(q) ||
      (skill.category || '').toLowerCase().includes(q)
    );
  });

  return { results: matched, count: matched.length, query };
}

// ─── Tool: install_skill ───────────────────────────────────
// Installs a skill from a SKILL.md file path or flat .md file
// Can copy from external sources into our skills directory
function installSkill(sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    return { error: 'Source path is required' };
  }

  const resolvedPath = path.resolve(sourcePath);

  if (!fs.existsSync(resolvedPath)) {
    return { error: `Source not found: ${sourcePath}` };
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile() && !stat.isDirectory()) {
    return { error: 'Source must be a file or directory' };
  }

  // ── Determine skill name ──
  let srcFile = resolvedPath;
  let parsed;
  let skillName;

  if (stat.isDirectory()) {
    // Try SKILL.md first, then any .md file
    srcFile = findSkillFile(resolvedPath);
    if (!srcFile) {
      // Look for any .md file in the directory
      const dirEntries = fs.readdirSync(resolvedPath);
      const mdFile = dirEntries.find(e => e.endsWith('.md') && !e.startsWith('_'));
      if (mdFile) {
        srcFile = path.join(resolvedPath, mdFile);
      }
    }
    if (!srcFile) {
      return { error: `No skill file found in directory: ${sourcePath}` };
    }
    parsed = parseSkillFile(srcFile) || parseSimpleSkillFile(srcFile);
  } else {
    // It's a file — try standard format first, then simple format
    parsed = parseSkillFile(srcFile) || parseSimpleSkillFile(srcFile);
  }

  if (!parsed || !parsed.name) {
    // Fallback: use filename without extension
    skillName = path.basename(srcFile).replace(/\.\w+$/, '').toLowerCase();
  } else {
    skillName = parsed.name;
  }

  // ── Check if already exists (both formats) ──
  const existingSubDir = path.join(SKILLS_ROOT, skillName);
  const existingFlat = path.join(SKILLS_ROOT, skillName + '.md');
  if (fs.existsSync(existingSubDir) || fs.existsSync(existingFlat)) {
    return { error: `Skill "${skillName}" already exists` };
  }

  // ── Check if it has YAML frontmatter → subdirectory format ──
  const content = fs.readFileSync(srcFile, 'utf-8');
  const hasFrontmatter = /^---\n/.test(content);

  if (hasFrontmatter) {
    // Industry standard: subdirectory/SKILL.md
    fs.mkdirSync(existingSubDir, { recursive: true });
    const targetFile = path.join(existingSubDir, 'SKILL.md');
    fs.copyFileSync(srcFile, targetFile);

    // Copy associated files if source is a directory
    if (stat.isDirectory()) {
      const srcDir = resolvedPath;
      const dirEntries = fs.readdirSync(srcDir);
      for (const entry of dirEntries) {
        if (entry === 'SKILL.md' || entry === 'skill.md') continue;
        const srcEntry = path.join(srcDir, entry);
        const tgtEntry = path.join(existingSubDir, entry);
        const entryStat = fs.statSync(srcEntry);
        if (entryStat.isFile()) {
          fs.copyFileSync(srcEntry, tgtEntry);
        } else if (entryStat.isDirectory()) {
          copyDirRecursive(srcEntry, tgtEntry);
        }
      }
    }

    return {
      success: true,
      name: skillName,
      description: parsed.description || '',
      path: path.join(existingSubDir, 'SKILL.md'),
      format: 'SKILL.md',
      message: `Skill "${skillName}" installed successfully (SKILL.md format)`,
    };
  } else {
    // Simple format: flat .md file in root
    fs.copyFileSync(srcFile, existingFlat);
    return {
      success: true,
      name: skillName,
      description: parsed.description || '',
      path: existingFlat,
      format: 'flat-md',
      message: `Skill "${skillName}" installed successfully (flat .md format)`,
    };
  }
}

// ─── Tool: skill_info ──────────────────────────────────────
// Returns info about what skills are available + how to use them
function skillInfo() {
  return {
    tool: 'SKILL.md Plugin MCP Tool',
    version: '2.0.0',
    description: 'MCP tool for reading/parsing SKILL.md + flat .md skill files',
    formats: ['SKILL.md', 'skill.md', 'flat .md'],
    commands: [
      { name: 'list_skills', description: 'List all available skills (supports category filter)' },
      { name: 'read_skill', description: 'Read a specific skill by name', params: ['skillName'] },
      { name: 'search_skills', description: 'Search skills by keyword', params: ['query'] },
      { name: 'install_skill', description: 'Install a skill from a source path', params: ['sourcePath'] },
    ],
    usage: 'Call these via MCP. Works internally (agents) + externally (editors).',
  };
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Parse a flat .md skill file using the Mission Barisal key-value format.
 * 
 * Format (used in skills/ folder):
 *   ### skill-name
 *   **id**: skill-name
 *   **name**: Full Name
 *   **description**: Brief description
 *   **version**: 1.0.0
 *   **category**: general
 *   **hasNpx**: true
 *   **tools**: tool1, tool2
 *   **permissions**: read, write
 * 
 * Also falls back to:
 *   # Title
 *   > Description
 *   ... markdown content ...
 */
function parseSimpleSkillFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n');
    const fileName = path.basename(filePath).replace(/\.md$/i, '');

    const parsed = {
      name: fileName,
      description: '',
      metadata: {},
      content: normalized,
      filePath,
      format: 'flat-md-simple',
    };

    // ── Strategy 1: Key-value pairs (**key**: value) ──
    const kvPattern = /^\*\*([^*]+)\*\*\s*:\s*(.+)$/gm;
    let match;
    let hasKv = false;
    while ((match = kvPattern.exec(normalized)) !== null) {
      hasKv = true;
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();

      if (key === 'name') parsed.name = value;
      else if (key === 'description') parsed.description = value;
      else if (key === 'id') parsed.metadata.id = value;
      else if (key === 'version') parsed.metadata.version = value;
      else if (key === 'category') parsed.metadata.category = value;
      else if (key === 'author') parsed.metadata.author = value;
      else if (key === 'source') parsed.metadata.source = value;
      else if (key === 'tools') parsed.metadata.tools = value.split(',').map(t => t.trim());
      else if (key === 'permissions') parsed.metadata.permissions = value.split(',').map(p => p.trim());
      else if (key === 'hasnpx') parsed.metadata['has-npx'] = value;
      else if (key === 'hasbinary') parsed.metadata['has-binary'] = value;
      else parsed.metadata[key] = value;
    }

    // ── Strategy 2: ### Header line ──
    if (!hasKv || !parsed.name || parsed.name === fileName) {
      const headerMatch = normalized.match(/^###\s+(.+)$/m);
      if (headerMatch) {
        parsed.name = headerMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      }
    }

    // ── Strategy 3: # Title + > Description ──
    const titleMatch = normalized.match(/^#\s+(.+)$/m);
    const descMatch = normalized.match(/^>\s*(.+)$/m);
    if (!parsed.description && descMatch) {
      parsed.description = descMatch[1].trim();
    }
    if (titleMatch && parsed.name === fileName) {
      parsed.name = titleMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
    }

    return parsed;
  } catch (err) {
    return null;
  }
}

function findSkillFile(dirPath) {
  for (const fmt of SUPPORTED_FORMATS) {
    const filePath = path.join(dirPath, fmt);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

function parseSkillFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseSkillContent(content, filePath);
  } catch (err) {
    return null;
  }
}

function parseSkillContent(content, filePath) {
  // Normalize line endings first (handle CRLF too)
  const normalized = content.replace(/\r\n/g, '\n');

  // Parse YAML frontmatter
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    // No frontmatter — treat whole file as markdown
    return {
      name: path.basename(path.dirname(filePath)),
      description: '',
      metadata: {},
      content: content.trim(),
      filePath,
      format: 'markdown-only',
    };
  }

  const frontmatterStr = match[1];
  const markdownContent = match[2].trim();

  const parsed = {
    raw: frontmatterStr,
    name: '',
    description: '',
    metadata: {},
    content: markdownContent,
    filePath,
    format: 'skill-md',
  };

  // Parse YAML-like frontmatter (simple parser, no yaml deps)
  const lines = frontmatterStr.split('\n').filter(l => l.trim());
  let currentKey = null;
  let currentIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check indentation for nested structure
    const indent = line.search(/\S/);

    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIdx).trim();
      let value = trimmed.substring(colonIdx + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (indent === 0) {
        // Top-level key
        if (key === 'name') parsed.name = value;
        else if (key === 'description') parsed.description = value;
        else if (key === 'license') parsed.metadata.license = value;
        else {
          currentKey = key;
          if (typeof parsed.metadata[key] === 'undefined') {
            parsed.metadata[key] = {};
          }
          currentIndent = indent;
        }
      } else if (indent > 0 && currentKey) {
        // Nested key (metadata fields)
        if (typeof parsed.metadata[currentKey] === 'object' && !Array.isArray(parsed.metadata[currentKey])) {
          parsed.metadata[currentKey][key] = value;
        } else {
          parsed.metadata[key] = value;
        }
      }
    }
  }

  // Fallback: use folder name if no name in frontmatter
  if (!parsed.name) {
    parsed.name = path.basename(path.dirname(filePath));
  }

  return parsed;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── MCP Handler ───────────────────────────────────────────
// Processes incoming MCP requests for skill operations
function handleMCPRequest(request) {
  const { method, params } = request;

  switch (method) {
    case 'list_skills':
      return listSkills();

    case 'read_skill':
      return readSkill(params?.skillName);

    case 'search_skills':
      return searchSkills(params?.query);

    case 'install_skill':
      return installSkill(params?.sourcePath);

    case 'skill_info':
      return skillInfo();

    default:
      return { error: `Unknown method: ${method}` };
  }
}

// ─── Exports ───────────────────────────────────────────────
module.exports = {
  listSkills,
  readSkill,
  searchSkills,
  installSkill,
  skillInfo,
  handleMCPRequest,
  parseSkillContent,
  parseSimpleSkillFile,
};

// ─── CLI Usage ─────────────────────────────────────────────
// Run directly: node skill-mcp-tool.js list_skills
// Run with args: node skill-mcp-tool.js read_skill skill-name
if (require.main === module) {
  const method = process.argv[2] || 'skill_info';
  const param = process.argv[3];

  const request = {
    method,
    params: param ? { skillName: param, query: param, sourcePath: param } : {},
  };

  const result = handleMCPRequest(request);
  console.log(JSON.stringify(result, null, 2));
}
