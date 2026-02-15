import chalk from "chalk";
import { getRepoRoot } from "../core/git";
import { isInitialized } from "../core/context";
import {
    writeIDERules,
    removeIDERules,
    listIDERules,
    getAllIDERules,
} from "../core/agent-rules";

interface RulesOptions {
    ide?: string;
    noMcp?: boolean;
}

export async function rulesCommand(
    action?: string,
    options: RulesOptions = {}
) {
    try {
        const root = await getRepoRoot();

        // Validate action
        const validActions = ["generate", "remove", "list"];
        if (!action || !validActions.includes(action)) {
            console.log(chalk.yellow("Usage: valyrianctx rules <generate|remove|list>"));
            console.log("");
            console.log("Commands:");
            console.log("  generate    Generate IDE rule files (teaches IDEs to use valyrianctx)");
            console.log("  remove      Remove all valyrianctx rule files and sections");
            console.log("  list        Show status of IDE rule files");
            console.log("");
            console.log("Options:");
            console.log("  --ide <ids>   Comma-separated IDE IDs to target (default: all)");
            console.log("                Available: claude-code, cursor, antigravity, opencode, trae, warp");
            console.log("  --no-mcp      Skip MCP server configuration");
            return;
        }

        switch (action) {
            case "generate":
                await handleGenerate(root, options);
                break;
            case "remove":
                await handleRemove(root);
                break;
            case "list":
                await handleList(root);
                break;
        }
    } catch (err: any) {
        if (err.message?.includes("not a git repository")) {
            console.log(chalk.red("✗ Not a git repository."));
        } else {
            console.log(chalk.red(`✗ Error: ${err.message}`));
        }
    }
}

async function handleGenerate(root: string, options: RulesOptions) {
    const ides = options.ide?.split(",").map(s => s.trim());
    const includeMcp = !options.noMcp;

    // Validate IDE IDs if provided
    if (ides) {
        const validIds = getAllIDERules().map(r => r.id);
        const invalid = ides.filter(id => !validIds.includes(id));
        if (invalid.length > 0) {
            console.log(chalk.red(`✗ Unknown IDE(s): ${invalid.join(", ")}`));
            console.log(chalk.gray(`  Valid IDs: ${validIds.join(", ")}`));
            return;
        }
    }

    console.log(chalk.blue("Generating IDE rule files..."));
    console.log("");

    const written = await writeIDERules(root, { ides, includeMcp });

    if (written.length === 0) {
        console.log(chalk.yellow("No files written."));
        return;
    }

    // Group by action for cleaner output
    const created = written.filter(w => w.action === "created");
    const updated = written.filter(w => w.action === "updated");
    const appended = written.filter(w => w.action === "appended");

    if (created.length > 0) {
        console.log(chalk.green("Created:"));
        for (const f of created) {
            console.log(chalk.gray(`  + ${f.path} (${f.ide})`));
        }
    }

    if (updated.length > 0) {
        console.log(chalk.yellow("Updated:"));
        for (const f of updated) {
            console.log(chalk.gray(`  ~ ${f.path} (${f.ide})`));
        }
    }

    if (appended.length > 0) {
        console.log(chalk.cyan("Appended:"));
        for (const f of appended) {
            console.log(chalk.gray(`  + ${f.path} (${f.ide})`));
        }
    }

    console.log("");
    console.log(chalk.green(`✓ Generated ${written.length} file(s)`));
    console.log("");
    console.log(chalk.gray("Team-shared files (commit these): CLAUDE.md, GEMINI.md, AGENTS.md"));
    console.log(chalk.gray("IDE-local files (gitignored): .cursor/, .trae/, .warp/, MCP configs"));
}

async function handleRemove(root: string) {
    console.log(chalk.blue("Removing valyrianctx rule files..."));
    console.log("");

    const removed = await removeIDERules(root);

    if (removed.length === 0) {
        console.log(chalk.yellow("No valyrianctx rules found to remove."));
        return;
    }

    for (const f of removed) {
        console.log(chalk.gray(`  - ${f}`));
    }

    console.log("");
    console.log(chalk.green(`✓ Removed ${removed.length} file(s)/section(s)`));
}

async function handleList(root: string) {
    const statuses = await listIDERules(root);

    console.log(chalk.blue("IDE Rule Status:"));
    console.log("");

    const maxIdeLen = Math.max(...statuses.map(s => s.ide.length));
    const maxPathLen = Math.max(...statuses.map(s => s.filePath.length));

    for (const s of statuses) {
        const ruleStatus = s.exists
            ? chalk.green("✓")
            : chalk.gray("○");
        const mcpStatus = s.hasMcpConfig
            ? chalk.green(" +MCP")
            : "";
        
        const ide = s.ide.padEnd(maxIdeLen);
        const filePath = chalk.gray(s.filePath.padEnd(maxPathLen));
        
        console.log(`  ${ruleStatus} ${ide}  ${filePath}${mcpStatus}`);
    }

    console.log("");
    
    const activeCount = statuses.filter(s => s.exists).length;
    const mcpCount = statuses.filter(s => s.hasMcpConfig).length;
    
    if (activeCount === 0) {
        console.log(chalk.yellow("No IDE rules configured. Run `valyrianctx rules generate` to set up."));
    } else {
        console.log(chalk.gray(`${activeCount}/${statuses.length} IDEs configured, ${mcpCount} with MCP`));
    }
}
