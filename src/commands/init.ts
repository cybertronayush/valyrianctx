import fs from "fs";
import path from "path";
import chalk from "chalk";
import { getRepoRoot, getRepoName } from "../core/git";
import { ValyrianCtxConfig } from "../core/types";
import { writeIDERules, listIDERules } from "../core/agent-rules";
import { hookCommand } from "./hook";

export async function initCommand() {
  try {
    const root = await getRepoRoot();
    const valyrianCtxDir = path.join(root, ".valyrianctx");

    const alreadyInitialized = fs.existsSync(valyrianCtxDir);

    if (!alreadyInitialized) {
      // Create directory structure
      fs.mkdirSync(path.join(valyrianCtxDir, "sessions"), { recursive: true });
      fs.mkdirSync(path.join(valyrianCtxDir, "branches"), { recursive: true });

      // Write config
      const config: ValyrianCtxConfig = {
        version: "0.1.0",
        createdAt: new Date().toISOString(),
        repo: await getRepoName(),
      };
      fs.writeFileSync(path.join(valyrianCtxDir, "config.json"), JSON.stringify(config, null, 2));

      // Add to .gitignore
      const gitignorePath = path.join(root, ".gitignore");
      const gitignoreContent = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, "utf-8")
        : "";

      if (!gitignoreContent.includes(".valyrianctx/")) {
        fs.appendFileSync(gitignorePath, "\n# ValyrianCtx - AI coding context\n.valyrianctx/\n");
        console.log(chalk.gray("  Added .valyrianctx/ to .gitignore"));
      }

      console.log(chalk.green(`✓ Initialized ValyrianCtx in ${root}`));
    } else {
      console.log(chalk.green(`✓ ValyrianCtx already initialized in ${root}`));
    }

    // Always generate/update IDE rule files
    // Check if any IDE rules are missing
    const statuses = await listIDERules(root);
    const missingCount = statuses.filter(s => !s.exists).length;

    if (alreadyInitialized && missingCount === 0) {
      console.log(chalk.gray(`  All ${statuses.length} IDE integrations already configured.`));
      console.log(chalk.gray("  Run `valyrianctx rules generate` to regenerate, or `valyrianctx rules list` to check status."));
      return;
    }

    console.log("");
    console.log(chalk.blue("Setting up IDE integrations..."));
    const written = await writeIDERules(root);

    const teamShared = written.filter(w => 
      ["CLAUDE.md", "GEMINI.md", "AGENTS.md"].some(f => w.path.includes(f))
    );
    const ideLocal = written.filter(w => 
      !["CLAUDE.md", "GEMINI.md", "AGENTS.md"].some(f => w.path.includes(f))
    );

    if (teamShared.length > 0) {
      console.log(chalk.gray("  Team-shared (commit these):"));
      for (const f of teamShared) {
        console.log(chalk.gray(`    ${f.action === "created" ? "+" : "~"} ${f.path}`));
      }
    }

    if (ideLocal.length > 0) {
      console.log(chalk.gray("  IDE-local (gitignored):"));
      for (const f of ideLocal) {
        console.log(chalk.gray(`    + ${f.path}`));
      }
    }

    console.log("");
    console.log(chalk.green(`✓ Configured ${written.length} IDE integration(s)`));
    console.log("");
    console.log(chalk.gray("Supported IDEs: Claude Code, Cursor, Antigravity, OpenCode, Trae, Warp"));

    // Auto-install git hooks for fully automatic context management:
    // - post-commit: auto-save + inject context into rule files
    // - post-checkout: inject correct branch context on switch
    const hooksDir = path.join(root, ".git", "hooks");
    const postCommitPath = path.join(hooksDir, "post-commit");
    const postCheckoutPath = path.join(hooksDir, "post-checkout");
    const hasPostCommit = fs.existsSync(postCommitPath) && fs.readFileSync(postCommitPath, "utf-8").includes("valyrianctx");
    const hasPostCheckout = fs.existsSync(postCheckoutPath) && fs.readFileSync(postCheckoutPath, "utf-8").includes("valyrianctx");

    if (!hasPostCommit || !hasPostCheckout) {
      console.log("");
      console.log(chalk.blue("Installing git hooks..."));
      await hookCommand("install");
    }

    if (!alreadyInitialized) {
      console.log("");
      console.log(chalk.gray("Run `valyrianctx save` to capture your first context."));
    }
  } catch (err: any) {
    if (err.message?.includes("not a git repository")) {
      console.log(chalk.red("✗ Not a git repository. Run `git init` first."));
    } else {
      console.log(chalk.red(`✗ Error: ${err.message}`));
    }
  }
}
