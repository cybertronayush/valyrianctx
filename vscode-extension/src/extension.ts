import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

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

    // Auto-resume on workspace open
    autoResume();

    // Update status bar
    updateStatusBar();
}

export function deactivate() {
    statusBarItem?.dispose();
    outputChannel?.dispose();
}

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

async function saveContext() {
    const message = await vscode.window.showInputBox({
        prompt: "What were you working on?",
        placeHolder: "e.g., Refactoring payment service to use event sourcing",
    });

    if (!message) return;

    try {
        await runValyrianCtx(`save "${message.replace(/"/g, '\\"')}"`);
        vscode.window.showInformationMessage(`Valyrian Context: Context saved ✓`);
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
