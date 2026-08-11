/**
 * WorkspaceWatcher — runtime SSOT + syllabus footprint updates.
 *
 * AUTO-REGENERATION IS DISABLED. SSOT/syllabus are only updated when
 * the agent explicitly calls the update functions. This prevents
 * unwanted auto-refreshes and ensures agents manually verify before updating.
 *
 * The watcher still monitors file changes for LOGGING purposes only.
 *
 * Phase 1 — Mission Foundation.
 */

import * as vscode from 'vscode';
import { SsotManager } from './ssotManager';
import { FootprintScanner } from './footprintScanner';

export class WorkspaceWatcher implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor(
        _ssot: SsotManager,
        _footprint: FootprintScanner,
        private readonly log: (message: string) => void
    ) { }

    public start(): void {
        // AUTO-REGENERATION DISABLED — agents must manually trigger updates
        // This prevents unwanted SSOT refreshes and ensures evidence-first workflow
        this.log('WorkspaceWatcher started — SSOT/syllabus manual-only (auto-refresh disabled)');
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
