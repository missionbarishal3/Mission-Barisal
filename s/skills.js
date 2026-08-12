#!/usr/bin/env node
// =============================================================================
// Mission Barisal v3 — ACP Skills Integration Module
// Extracted from JetBrains ACP Agent Registry (38 agents)
// =============================================================================
// This module provides:
//   1. Searchable database of 38 ACP agent skills
//   2. Agent invocation helpers (npx/binary)
//   3. ACP registry registration data for our server
// =============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_DB_PATH = path.resolve(__dirname, 'data', 'acp-skills.json');

// ─── Load skills database ─────────────────────────────────────
let skillsDB = [];
try {
  if (fs.existsSync(SKILLS_DB_PATH)) {
    skillsDB = JSON.parse(fs.readFileSync(SKILLS_DB_PATH, 'utf8'));
    console.log('DEBUG: Successfully loaded', skillsDB.length, 'skills from', SKILLS_DB_PATH);
  } else {
    console.log('DEBUG: Skills database file not found at', SKILLS_DB_PATH);
  }
} catch (e) {
  console.log('DEBUG: Error loading skills database:', e.message);
  // File not found or invalid — will use empty array
}

// ─── Categorized access ───────────────────────────────────────
const NPX_AGENTS = skillsDB.filter((s) => s.hasNpx);
const BINARY_AGENTS = skillsDB.filter((s) => s.hasBinary);
const OTHER_AGENTS = skillsDB.filter(
  (s) => !s.hasNpx && !s.hasBinary,
);

// ─── Search skills by keyword ─────────────────────────────────
function searchSkills(query) {
  if (!query || !query.trim()) return skillsDB;
  const q = query.toLowerCase().trim();
  return skillsDB.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q),
  );
}

// ─── Get a specific skill by ID ───────────────────────────────
function getSkill(id) {
  return skillsDB.find((s) => s.id === id) || null;
}

// ─── Get invocation command for a skill ───────────────────────
function getInvokeCommand(skillId) {
  const skill = getSkill(skillId);
  if (!skill) return null;

  // Prefer npx over binary (npx is cross-platform)
  if (skill.hasNpx && skill.npxCommand) {
    return { type: 'npx', command: skill.npxCommand };
  }

  // Binary available (platform-specific)
  if (skill.hasBinary) {
    return {
      type: 'binary',
      platforms: skill.binaryInfo
        ? skill.binaryInfo.split(', ').map((p) => p.trim())
        : [],
      note: 'Pre-built binary — must match system architecture',
    };
  }

  return { type: 'unsupported', note: 'No distribution method available' };
}

// ─── Execute an ACP agent via npx (async wrapper) ─────────────
function invokeNpxAgent(skillId, args) {
  return new Promise((resolve) => {
    const skill = getSkill(skillId);
    if (!skill) {
      resolve({ success: false, error: 'Skill not found: ' + skillId });
      return;
    }

    const cmd = getInvokeCommand(skillId);
    if (!cmd || cmd.type !== 'npx') {
      resolve({
        success: false,
        error:
          'Skill "' +
          skillId +
          '" cannot be invoked via npx. ' +
          (cmd ? cmd.note : 'No distribution available'),
      });
      return;
    }

    try {
      const result = execSync(cmd.command + ' ' + (args || ''), {
        timeout: 30000,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      });
      resolve({ success: true, output: result.slice(0, 50000) });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// ─── Our server's ACP registration ────────────────────────────
const ACP_REGISTRATION = {
  id: 'mission-barisal',
  name: 'Mission Barisal',
  version: '3.0.0',
  description:
    'ZombieCoder multi-agent AI platform with 6 specialist agents: ' +
    'Code Guru (architecture), Bug Hunter (debugging), Security Hero (security), ' +
    'Performance Wizard (performance), Documentation King (docs), QA Tyrant (quality)',
  website: 'https://zombiecoder.my.id/',
  repository: '',
  authors: ['Sahon Srabon — Developer Zone (Dhaka, Bangladesh)'],
  license: 'Proprietary — Local Freedom Protocol',
  icon: '',
  distribution: {
    url: 'http://localhost:${port}/mcp',
    type: 'mcp',
  },
};

// ─── Helpers ──────────────────────────────────────────────────
function getSummary() {
  return {
    total: skillsDB.length,
    npx_agents: NPX_AGENTS.length,
    binary_agents: BINARY_AGENTS.length,
    other_agents: OTHER_AGENTS.length,
    top_agents: skillsDB.slice(0, 5).map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
    })),
  };
}

module.exports = {
  skillsDB,
  NPX_AGENTS,
  BINARY_AGENTS,
  OTHER_AGENTS,
  searchSkills,
  getSkill,
  getInvokeCommand,
  invokeNpxAgent,
  ACP_REGISTRATION,
  getSummary,
  totalSkills: skillsDB.length,
};
