#!/usr/bin/env node
/**
 * align-server.js — Mission Barisal Server Alignment Tool
 * -------------------------------------------------------
 * The server code (api.js, start.js, etc.) was copied across many folders
 * and updated piecemeal — creating dozens of slightly different versions
 * ("তালবাহানা"). This script aligns EVERY scattered copy to the MAIN
 * (canonical) server in /home/sahon/dev/Engine.
 *
 * Usage:
 *   node align-server.js --check          # report which copies are stale (default)
 *   node align-server.js --apply          # copy MAIN files to all copies (with backup)
 *   node align-server.js --apply --dry    # show what WOULD be copied, don't write
 *   node align-server.js --main /path     # use a different MAIN server folder
 *   node align-server.js --list           # just list the known scattered folders
 *
 * Safety:
 *   - --apply backs up each overwritten file to <file>.bak-<timestamp>
 *   - never touches the MAIN folder itself
 *   - --dry shows the plan without writing anything
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Configuration ────────────────────────────────────────────────
const DEFAULT_MAIN = '/home/sahon/dev/Engine';
const CORE_FILES = ['api.js', 'start.js', 'domain-config.js', 'note-store.js', 'mcp-client.js'];

// Known scattered server folders (auto-discovered + manual additions).
// The script ALSO scans the home dir for api.js copies, so this list is
// just a seed — new copies get found automatically.
const KNOWN_SCATTERED = [
    '/home/sahon/dev/sarver',
    '/home/sahon/Music/chak/server',
    '/home/sahon/Music/chak/home',
    '/home/sahon/1.zombiecoder',
    '/home/sahon/.opencode',
    '/home/sahon/Desktop/v3',
    '/home/sahon/Desktop/hlw',
    '/home/sahon/Desktop/exam/monu',
    '/home/sahon/Desktop/exam/hlw',
    '/home/sahon/Desktop/missionbarisal/mini-services',
    '/home/sahon/Desktop/missionbarisal_admin/mini-services',
];

// Extra roots to auto-scan for api.js copies (bounded depth to stay fast).
const SCAN_ROOTS = [
    '/home/sahon/dev',
    '/home/sahon/Music',
    '/home/sahon/Desktop',
    '/home/sahon/1.zombiecoder',
    '/home/sahon/.opencode',
];
const SCAN_MAX_DEPTH = 4;

// ── Helpers ──────────────────────────────────────────────────────
function log(msg) { console.log(msg); }

function findApiCopies() {
    const found = new Set();
    const seenDirs = new Set();

    function walk(dir, depth) {
        if (depth > SCAN_MAX_DEPTH || seenDirs.has(dir)) return;
        seenDirs.add(dir);
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { return; }
        for (const e of entries) {
            if (e.name === 'node_modules' || e.name === '.git' || e.name === '.cache') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full, depth + 1);
            } else if (e.name === 'api.js') {
                // Only treat as a server copy if it's not inside node_modules
                if (!full.includes('node_modules')) found.add(dir);
            }
        }
    }

    for (const root of SCAN_ROOTS) {
        if (fs.existsSync(root)) walk(root, 0);
    }
    for (const k of KNOWN_SCATTERED) {
        if (fs.existsSync(k)) found.add(k);
    }
    return [...found].sort();
}

function fileDiffLines(a, b) {
    try {
        const out = execSync(`diff "${a}" "${b}" | wc -l`, { encoding: 'utf8' });
        return parseInt(out.trim(), 10) || 0;
    } catch { return -1; }
}

function copyWithBackup(src, dest) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    if (fs.existsSync(dest)) {
        const bak = `${dest}.bak-${ts}`;
        fs.copyFileSync(dest, bak);
        log(`  📦 backup: ${path.basename(dest)} → ${path.basename(bak)}`);
    }
    fs.copyFileSync(src, dest);
}

// ── Main ─────────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const dry = args.includes('--dry');
    const listOnly = args.includes('--list');
    const mainFlagIdx = args.indexOf('--main');
    const MAIN = mainFlagIdx >= 0 && args[mainFlagIdx + 1]
        ? path.resolve(args[mainFlagIdx + 1])
        : DEFAULT_MAIN;

    if (!fs.existsSync(path.join(MAIN, 'api.js'))) {
        log(`❌ MAIN server not found at ${MAIN}/api.js`);
        log(`   Use --main /path/to/server to point at the canonical server.`);
        process.exit(1);
    }

    const copies = findApiCopies().filter((d) => path.resolve(d) !== path.resolve(MAIN));

    log('');
    log('🧟 ZombieCoder Mission Barisal — Server Alignment Tool');
    log('========================================================');
    log(`MAIN server: ${MAIN}`);
    log(`Mode: ${apply ? (dry ? 'APPLY (dry run)' : 'APPLY') : 'CHECK (read-only)'}`);
    log(`Found ${copies.length} scattered server folder(s):`);
    log('');

    if (listOnly) {
        for (const c of copies) log(`  • ${c}`);
        return;
    }

    let staleCount = 0;
    let alignedCount = 0;

    for (const dir of copies) {
        const rel = dir.replace('/home/sahon/', '~/');
        const hasApi = fs.existsSync(path.join(dir, 'api.js'));
        if (!hasApi) {
            log(`  ⚠️ ${rel} — no api.js (skipping)`);
            continue;
        }
        const diff = fileDiffLines(path.join(MAIN, 'api.js'), path.join(dir, 'api.js'));
        if (diff === 0) {
            log(`  ✅ ${rel} — ALIGNED (identical api.js)`);
            alignedCount++;
            continue;
        }
        staleCount++;
        log(`  🔴 ${rel} — STALE (${diff} diff lines)`);

        if (apply) {
            log(`     Aligning ${rel} ...`);
            for (const f of CORE_FILES) {
                const src = path.join(MAIN, f);
                const dest = path.join(dir, f);
                if (fs.existsSync(src)) {
                    if (dry) {
                        log(`     [dry] would copy ${f}`);
                    } else {
                        copyWithBackup(src, dest);
                        log(`     ✅ copied ${f}`);
                    }
                }
            }
        }
    }

    log('');
    if (apply) {
        if (dry) {
            log(`📋 DRY RUN complete — ${staleCount} stale, ${alignedCount} aligned. Nothing written.`);
        } else {
            log(`✅ ALIGNMENT complete — ${staleCount} stale folder(s) aligned, ${alignedCount} already aligned.`);
            log('   Each overwritten file has a .bak-<timestamp> backup in place.');
            log('   ⚠️ RESTART each server after alignment (start.js).');
        }
    } else {
        log(`📊 CHECK complete — ${staleCount} stale, ${alignedCount} aligned.`);
        log('   Run `node align-server.js --apply` to align them all (with backups).');
    }
    log('');
    log(`🔑 KEY RULE: ALL server edits happen in ${MAIN}/api.js, then run:`);
    log(`   node align-server.js --apply`);
    log('   This keeps every copy in sync — no more "তালবাহানা".');
}

main();
