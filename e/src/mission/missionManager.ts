/**
 * MissionManager — orchestrates the client-side Mission Barisal system.
 *
 * On activation it silently (no user permission) creates the three-file
 * memory layout (SSOT.md + syllabus.md + memory.json), starts the workspace
 * watcher for runtime SSOT updates, and exposes the assembled Mission
 * context consumed by the Phase 2 context builder.
 *
 * Phase 1 — Mission Foundation.
 *
 * NOTE: Config directory (.zombiecoder/) lives at OS home root ($HOME/.zombiecoder/)
 * so all projects share the same SSOT/syllabus/memory. This matches the server's
 * start.js behavior which also uses os.homedir()/.zombiecoder/.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { SsotManager } from './ssotManager';
import { WorkspaceWatcher } from './workspaceWatcher';
import { FootprintScanner } from './footprintScanner';
import { MemoryManager } from './memoryManager';

/**
 * Dependency-injection bag handed in by the provider. Lets the manager
 * pull a live MCP tool summary at request time without a circular import
 * back into the connector.
 */
export interface MissionManagerDeps {
    getMcpTools?: () => string;
}

/**
 * The clean, evidence-first Mission context block (persona + SSOT +
 * syllabus + session memory + MCP tools) that replaces the stripped
 * Microsoft boilerplate in the system message.
 */
export interface MissionContext {
    workspaceRoot: string;
    sessionId: string;
    ssot: string;
    syllabus: string;
    memorySummary: string;
    mcpTools: string;
}

export class MissionManager implements vscode.Disposable {
    private readonly log: (msg: string) => void;
    private readonly deps: MissionManagerDeps;
    private readonly sessionId: string;
    private readonly ssot: SsotManager;
    private readonly watcher: WorkspaceWatcher;
    private readonly footprint: FootprintScanner;
    private readonly memory: MemoryManager;
    private initialized = false;

    constructor(
        context: vscode.ExtensionContext,
        log: (msg: string) => void,
        deps?: MissionManagerDeps
    ) {
        this.log = log;
        this.deps = deps ?? {};
        // Config directory lives at OS home root ($HOME/.zombiecoder/) for global sharing
        const configRoot = os.homedir();
        // Active workspace root — used for SSOT scanning
        const activeRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath;
        this.sessionId = computeWorkspaceSessionId(activeRoot);
        this.ssot = new SsotManager(configRoot, log, activeRoot);
        this.footprint = new FootprintScanner(activeRoot, log);
        this.watcher = new WorkspaceWatcher(this.ssot, this.footprint, log);
        this.memory = new MemoryManager(configRoot, log);
    }

    get workspaceRoot(): string {
        return this.ssot.rootDir;
    }

    /** Active workspace root (for SSOT scanning, not config storage) */
    get activeWorkspaceRoot(): string {
        return this.ssot.projectRoot ?? this.ssot.rootDir;
    }

    /**
     * Stable per-workspace session id (see {@link MissionContext.sessionId}).
     * Used as the server-side `session_id` so every project folder keeps its
     * own session/memory/syllabus — no data mixing across projects.
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Option A — register THIS workspace (and every other open workspace
     * folder, multi-root aware) with the Mission Barisal server
     * (POST /api/workspace) so the server auto-generates
     * `.zombiecoder/SSOT.md` + `syllabus.md` INSIDE each project folder and
     * scopes memory/sessions per project. Fire-and-forget: failures are
     * logged, never thrown. Only fires over http(s) — UDS-only servers still
     * get per-project context via the chat payload (Option B). No hardcoded
     * paths; works on Windows and Linux.
     */
    async notifyServerWorkspace(serverUrl: string): Promise<void> {
        try {
            if (!/^https?:\/\//i.test(serverUrl)) {
                this.log(`Workspace register skipped (non-HTTP serverUrl: ${serverUrl})`);
                return;
            }
            // Register EVERY open workspace folder — so when the user opens
            // two (or fifty) folders, each one gets its own server-scoped
            // .zombiecoder (no data mixing, no "can't find the folder").
            const folders = vscode.workspace.workspaceFolders ?? [];
            const roots =
                folders.length > 0 ? folders.map((f) => f.uri.fsPath) : [this.workspaceRoot];
            for (const root of roots) {
                await this.registerWorkspace(serverUrl, root);
            }
        } catch (error) {
            this.log(
                `Workspace register skipped: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async registerWorkspace(serverUrl: string, root: string): Promise<void> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const sessionId = computeWorkspaceSessionId(root);
            const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspacePath: root,
                    xSessionId: sessionId,
                    source: 'extension',
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                this.log(`Workspace register failed (${root}): ${res.status} ${res.statusText}`);
            } else {
                this.log(`Workspace registered with server: ${root} (${sessionId})`);
            }
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Create `.zombiecoder/` (SSOT + syllabus + memory) client-side. Runs once
     * per extension activation. No user permission prompt on first run.
     */
    ensureMissionFiles(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        try {
            this.memory.ensureDirs();
            const ssotContent = this.ssot.regenerate();
            const footprint = this.footprint.scan();
            this.footprint.updateSyllabus(footprint);
            this.watcher.start();
            this.log(
                `Mission files ensured: SSOT (${ssotContent.length} chars), ${footprint.languages.length} language(s) detected`
            );
        } catch (error) {
            this.log(
                `Mission init failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Resolve the workspace folder the user is CURRENTLY working in:
     * the folder of the active text editor (multi-root aware), falling back
     * to the primary workspace root. This makes chat context follow the
     * active project instead of always using folder[0].
     */
    private resolveActiveWorkspaceRoot(): string {
        const folders = vscode.workspace.workspaceFolders ?? [];
        if (folders.length <= 1) {
            return this.workspaceRoot;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            if (folder) {
                return folder.uri.fsPath;
            }
        }
        return this.workspaceRoot;
    }

    /** Assemble the context block injected as the clean system message. */
    getMissionContext(): MissionContext {
        // Multi-root aware: use the ACTIVE editor's folder so the agent
        // context follows whichever project the user is actually working on.
        const activeRoot = this.resolveActiveWorkspaceRoot();
        const activeSessionId = computeWorkspaceSessionId(activeRoot);

        let syllabus = '';
        try {
            const syllabusPath = path.join(activeRoot, '.zombiecoder', 'agents', 'syllabus.md');
            if (fs.existsSync(syllabusPath)) {
                syllabus = fs.readFileSync(syllabusPath, 'utf8');
            }
        } catch {
            syllabus = '';
        }

        let ssot = '';
        try {
            const ssotPath = path.join(activeRoot, '.zombiecoder', 'SSOT.md');
            if (fs.existsSync(ssotPath)) {
                ssot = fs.readFileSync(ssotPath, 'utf8');
            }
        } catch {
            ssot = '';
        }

        let memorySummary = '(no session memory yet)';
        try {
            const memPath = path.join(activeRoot, '.zombiecoder', 'agents', 'memory.json');
            if (fs.existsSync(memPath)) {
                const parsed = JSON.parse(fs.readFileSync(memPath, 'utf8')) as {
                    entries?: Array<{ timestamp?: string; agent?: string; summary?: string }>;
                };
                const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
                if (entries.length > 0) {
                    memorySummary = entries
                        .slice(-5)
                        .map(
                            (entry) =>
                                `- [${entry.timestamp ?? ''}] ${entry.agent ?? ''}: ${entry.summary ?? ''}`
                        )
                        .join('\n');
                }
            }
        } catch {
            memorySummary = '(no session memory yet)';
        }

        return {
            workspaceRoot: activeRoot,
            sessionId: activeSessionId,
            ssot: ssot || this.ssot.readSSOT(),
            syllabus,
            memorySummary,
            mcpTools: this.deps.getMcpTools?.() ?? '(MCP tools not synced yet)',
        };
    }

    dispose(): void {
        this.watcher.dispose();
    }
}

/**
 * Derive a stable, cross-platform session id from a workspace folder path.
 * The path is normalized and lowercased before hashing so the same folder
 * always yields the same id on Windows and Linux (no hardcoded separators).
 */
function computeWorkspaceSessionId(workspaceRoot: string): string {
    const normalized = path.normalize(workspaceRoot).toLowerCase();
    const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
    return 'ws-' + hash.slice(0, 16);
}
