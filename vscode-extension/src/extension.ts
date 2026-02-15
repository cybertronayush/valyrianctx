import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

// ---------------------------------------------------------------------------
// Activity Tracking — Idle Timer + Debounced Save
// ---------------------------------------------------------------------------

let lastActivityTime = 0;
let idleTimer: ReturnType<typeof setInterval> | null = null;
let idleSaveFired = false;

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds

function recordActivity(): void {
    lastActivityTime = Date.now();
    idleSaveFired = false; // Reset on new activity
}

async function checkIdleAndSave(): Promise<void> {
    if (lastActivityTime === 0 || idleSaveFired) return;

    const idleMs = Date.now() - lastActivityTime;
    if (idleMs < IDLE_TIMEOUT_MS) return;

    idleSaveFired = true;
    try {
        await runValyrianCtx('save --auto "Session idle in VS Code"');
        outputChannel.appendLine(`[ValyrianCtx] Auto-saved on idle (${Math.round(idleMs / 60000)}m inactive)`);
    } catch {
        // Best-effort
    }
}

function startIdleTimer(): void {
    idleTimer = setInterval(() => {
        checkIdleAndSave().catch(() => {});
    }, IDLE_CHECK_INTERVAL_MS);
}

function stopIdleTimer(): void {
    if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
    }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Valyrian Context");

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.command = "valyrianctx.resume";
    statusBarItem.tooltip = "Click to resume Valyrian Context";
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand("valyrianctx.save", saveContext),
        vscode.commands.registerCommand("valyrianctx.resume", resumeContext),
        vscode.commands.registerCommand("valyrianctx.log", showLog),
        vscode.commands.registerCommand("valyrianctx.diff", showDiff)
    );

    // 3c: Track file saves as activity (debounced via recordActivity)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            recordActivity();
        })
    );

    // 3d: Terminal close detection — auto-save when a terminal closes
    // (often signals end of a dev session / test run)
    context.subscriptions.push(
        vscode.window.onDidCloseTerminal(async () => {
            try {
                await runValyrianCtx('save --auto "Terminal closed in VS Code"');
                outputChannel.appendLine("[ValyrianCtx] Auto-saved on terminal close");
                updateStatusBar();
            } catch {
                // Best-effort
            }
        })
    );

    // Auto-resume on workspace open
    autoResume();

    // Update status bar
    updateStatusBar();

    // Start idle timer
    recordActivity();
    startIdleTimer();
}

// ---------------------------------------------------------------------------
// Deactivation — 3a: Auto-save when VS Code closes
// ---------------------------------------------------------------------------

export function deactivate(): Thenable<void> | undefined {
    stopIdleTimer();

    // Attempt a quick auto-save before shutdown.
    // VS Code gives deactivate() a limited window, so we use execSync-style
    // approach via a short-timeout async exec.
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            // Return a thenable so VS Code waits for it (up to its timeout)
            return execAsync('npx valyrianctx save --auto "VS Code session ending"', {
                cwd: workspaceFolder,
                timeout: 5000, // 5s max — VS Code may kill us sooner
            }).then(
                () => {
                    statusBarItem?.dispose();
                    outputChannel?.dispose();
                },
                () => {
                    statusBarItem?.dispose();
                    outputChannel?.dispose();
                }
            );
        }
    } catch {
        // Best-effort
    }

    statusBarItem?.dispose();
    outputChannel?.dispose();
    return undefined;
}

// ---------------------------------------------------------------------------
// Core Helpers
// ---------------------------------------------------------------------------

async function runValyrianCtx(
    args: string,
    cwd?: string
): Promise<{ stdout: string; stderr: string }> {
    const workspaceFolder = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        throw new Error("No workspace folder open");
    }

    return execAsync(`npx valyrianctx ${args}`, { cwd: workspaceFolder });
}

async function autoResume() {
    try {
        const { stdout } = await runValyrianCtx("resume --stdout");
        if (stdout.trim() && !stdout.includes("not initialized") && !stdout.includes("No context")) {
            outputChannel.clear();
            outputChannel.appendLine("═══ Valyrian Context Auto-Resume ═══\n");
            outputChannel.appendLine(stdout);
            outputChannel.show(true); // true = preserve focus
        }
    } catch {
        // Silently fail — valyrianctx may not be initialized
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function saveContext() {
    const message = await vscode.window.showInputBox({
        prompt: "What were you working on?",
        placeHolder: "e.g., Refactoring payment service to use event sourcing",
    });

    if (!message) return;

    try {
        await runValyrianCtx(`save "${message.replace(/"/g, '\\"')}"`);
        vscode.window.showInformationMessage(`Valyrian Context: Context saved`);
        recordActivity(); // Explicit save resets idle
        idleSaveFired = true; // Don't idle-save right after explicit save
        updateStatusBar();
    } catch (err: any) {
        vscode.window.showErrorMessage(`Valyrian Context: ${err.message}`);
    }
}

async function resumeContext() {
    try {
        const { stdout } = await runValyrianCtx("resume --stdout");
        outputChannel.clear();
        outputChannel.appendLine("═══ Valyrian Context Resume ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    } catch (err: any) {
        vscode.window.showErrorMessage(`Valyrian Context: ${err.message}`);
    }
}

async function showLog() {
    try {
        const { stdout } = await runValyrianCtx("log");
        outputChannel.clear();
        outputChannel.appendLine("═══ Valyrian Context Log ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    } catch (err: any) {
        vscode.window.showErrorMessage(`Valyrian Context: ${err.message}`);
    }
}

async function showDiff() {
    try {
        const { stdout } = await runValyrianCtx("diff");
        outputChannel.clear();
        outputChannel.appendLine("═══ Valyrian Context Diff ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    } catch (err: any) {
        vscode.window.showErrorMessage(`Valyrian Context: ${err.message}`);
    }
}

async function updateStatusBar() {
    try {
        const { stdout } = await runValyrianCtx("log -n 1");
        if (stdout.includes("[")) {
            // Extract timestamp from log output
            const match = stdout.match(/\[([^\]]+)\]/);
            if (match) {
                statusBarItem.text = `$(history) ValCtx: ${match[1]}`;
                statusBarItem.show();
                return;
            }
        }
        statusBarItem.text = "$(history) ValCtx";
        statusBarItem.show();
    } catch {
        statusBarItem.text = "$(history) ValCtx: No context";
        statusBarItem.show();
    }
}
