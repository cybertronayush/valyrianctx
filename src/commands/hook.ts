import fs from "fs";
import path from "path";
import chalk from "chalk";
import { getRepoRoot } from "../core/git";

const HOOK_MARKER = "valyrianctx";

interface HookDefinition {
    name: string;
    /** Shell script content (appended after shebang) */
    script: string;
    /** Human description for install output */
    description: string;
}

/**
 * All git hooks that valyrianctx installs.
 * 
 * post-commit: Auto-save context on every commit + inject into rule files
 *   so the next AI session picks it up automatically.
 * 
 * post-checkout: When switching branches, inject that branch's context
 *   into rule files. The AI reads the correct context without any commands.
 */
const HOOKS: HookDefinition[] = [
    {
        name: "post-commit",
        script: [
            `# ValyrianCtx: auto-save context on commit + inject into IDE rule files`,
            `valyrianctx save --auto 2>/dev/null || valyrianctx save "Auto-saved on commit: $(git log -1 --pretty=%B | head -1)" 2>/dev/null || true`,
            `# Inject saved context into IDE rule files for automatic resume`,
            `valyrianctx resume --inject 2>/dev/null || true`,
        ].join("\n"),
        description: "Context auto-saved + injected into IDE rule files on every commit",
    },
    {
        name: "post-checkout",
        script: [
            `# ValyrianCtx: inject branch context into IDE rule files on branch switch`,
            `# $3 = 1 if branch checkout, 0 if file checkout`,
            `if [ "$3" = "1" ]; then`,
            `  valyrianctx resume --inject 2>/dev/null || true`,
            `fi`,
        ].join("\n"),
        description: "Branch context auto-injected into IDE rule files on checkout",
    },
];

export async function hookCommand(action?: string) {
    try {
        const root = await getRepoRoot();
        const hooksDir = path.join(root, ".git", "hooks");

        if (action === "remove") {
            await removeHooks(hooksDir);
            return;
        }

        // Default: install all hooks
        await installHooks(hooksDir);
    } catch (err: any) {
        console.log(chalk.red(`✗ Error: ${err.message}`));
    }
}

async function installHooks(hooksDir: string): Promise<void> {
    fs.mkdirSync(hooksDir, { recursive: true });

    for (const hook of HOOKS) {
        const hookPath = path.join(hooksDir, hook.name);

        let hookContent = "#!/bin/sh\n";

        if (fs.existsSync(hookPath)) {
            const existing = fs.readFileSync(hookPath, "utf-8");
            if (existing.includes(HOOK_MARKER)) {
                console.log(chalk.yellow(`  ⚠ ${hook.name}: already installed, skipping`));
                continue;
            }
            // Append to existing hook
            hookContent = existing.trimEnd() + "\n";
        }

        hookContent += `\n${hook.script}\n`;

        fs.writeFileSync(hookPath, hookContent);
        fs.chmodSync(hookPath, "755");

        console.log(chalk.green(`  ✓ ${hook.name}: ${hook.description}`));
    }

    console.log(chalk.gray("  Remove with: valyrianctx hook remove"));
}

async function removeHooks(hooksDir: string): Promise<void> {
    let removedCount = 0;

    for (const hook of HOOKS) {
        const hookPath = path.join(hooksDir, hook.name);

        if (!fs.existsSync(hookPath)) continue;

        const content = fs.readFileSync(hookPath, "utf-8");
        if (!content.includes(HOOK_MARKER)) continue;

        // Remove all valyrianctx lines (including comments with the marker)
        const lines = content.split("\n").filter(
            (l) => !l.includes(HOOK_MARKER) && !l.includes("valyrianctx")
        );

        const remaining = lines.filter(
            (l) => l.trim() && !l.startsWith("#!")
        );

        if (remaining.length === 0) {
            fs.unlinkSync(hookPath);
        } else {
            fs.writeFileSync(hookPath, lines.join("\n"));
            fs.chmodSync(hookPath, "755");
        }

        removedCount++;
    }

    if (removedCount === 0) {
        console.log(chalk.yellow("⚠ No ValyrianCtx git hooks found."));
    } else {
        console.log(chalk.green(`✓ Removed ${removedCount} ValyrianCtx git hook(s)`));
    }
}
