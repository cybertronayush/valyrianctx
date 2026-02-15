import chalk from "chalk";
import { isInitialized, loadBranchContext } from "../core/context";
import { getCurrentBranch, getRepoRoot } from "../core/git";
import { generatePrompt } from "../core/prompt";
import { copyToClipboard } from "../utils/clipboard";
import { injectContextIntoRules, clearContextFromRules } from "../core/agent-rules";

export async function resumeCommand(options?: { branch?: string; stdout?: boolean; inject?: boolean }) {
  if (!(await isInitialized())) {
    console.log(chalk.red("✗ ValyrianCtx not initialized. Run `valyrianctx init` first."));
    return;
  }

  try {
    const branch = options?.branch || (await getCurrentBranch());
    const entries = await loadBranchContext(branch);
    const root = await getRepoRoot();

    if (entries.length === 0) {
      if (options?.inject) {
        // No context for this branch — clear any stale context from rule files
        await clearContextFromRules(root);
        return;
      }
      console.log(chalk.yellow(`⚠ No context found for branch: ${branch}`));
      console.log(chalk.gray("  Run `valyrianctx save` to capture context first."));
      return;
    }

    const prompt = generatePrompt(entries);

    if (options?.inject) {
      // Inject mode: write context directly into IDE rule files.
      // Called by git hooks (post-checkout, post-commit) so the AI reads
      // the context automatically on next session — no commands needed.
      const injected = await injectContextIntoRules(root, prompt);
      if (injected > 0) {
        console.log(chalk.gray(`  Context injected into ${injected} IDE rule file(s)`));
      }
      return;
    }

    if (options?.stdout) {
      console.log(prompt);
    } else {
      const copied = await copyToClipboard(prompt);
      if (copied) {
        console.log(chalk.green("📋 Context copied to clipboard!"));
        console.log(
          chalk.gray(`  Branch: ${branch} | ${entries.length} sessions | Paste into any AI tool`)
        );
      } else {
        // Fallback: print to stdout if clipboard failed
        console.log(prompt);
      }
    }
  } catch (err: any) {
    console.log(chalk.red(`✗ Error: ${err.message}`));
  }
}
