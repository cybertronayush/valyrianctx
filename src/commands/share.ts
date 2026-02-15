import fs from "fs";
import path from "path";
import chalk from "chalk";
import simpleGit from "simple-git";
import { getRepoRoot } from "../core/git";

const git = simpleGit();

export async function shareCommand(options?: { stop?: boolean }) {
    try {
        const root = await getRepoRoot();
        const gitignorePath = path.join(root, ".gitignore");
        const valyrianCtxDir = path.join(root, ".valyrianctx");

        if (!fs.existsSync(valyrianCtxDir)) {
            console.log(chalk.red("✗ ValyrianCtx not initialized. Run `valyrianctx init` first."));
            return;
        }

        if (options?.stop) {
            // Add .valyrianctx/ back to .gitignore
            const gitignoreContent = fs.existsSync(gitignorePath)
                ? fs.readFileSync(gitignorePath, "utf-8")
                : "";

            if (!gitignoreContent.includes(".valyrianctx/")) {
                fs.appendFileSync(gitignorePath, "\n.valyrianctx/\n");
            }

            console.log(chalk.green("✓ Stopped sharing ValyrianCtx"));
            console.log(chalk.gray("  .valyrianctx/ added back to .gitignore"));
            console.log(
                chalk.gray("  Note: Existing .valyrianctx/ files remain in git history.")
            );
            return;
        }

        // Remove .valyrianctx/ from .gitignore
        if (fs.existsSync(gitignorePath)) {
            let content = fs.readFileSync(gitignorePath, "utf-8");
            content = content
                .split("\n")
                .filter(
                    (line) =>
                        line.trim() !== ".valyrianctx/" &&
                        line.trim() !== ".valyrianctx" &&
                        line.trim() !== "# ValyrianCtx - AI coding context"
                )
                .join("\n");
            fs.writeFileSync(gitignorePath, content);
        }

        // Stage .valyrianctx/ and commit
        await git.add([".valyrianctx/", ".gitignore"]);
        await git.commit("chore: share ValyrianCtx with team");

        console.log(chalk.green("✓ ValyrianCtx is now shared with your team!"));
        console.log(chalk.gray("  .valyrianctx/ removed from .gitignore"));
        console.log(chalk.gray("  Committed: \"chore: share ValyrianCtx with team\""));
        console.log(chalk.gray("\n  Push to share: git push"));
        console.log(chalk.gray("  Stop sharing: valyrianctx share --stop"));
    } catch (err: any) {
        console.log(chalk.red(`✗ Error: ${err.message}`));
    }
}
