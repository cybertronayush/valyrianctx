import chalk from "chalk";
import inquirer from "inquirer";
import { v4 as uuid } from "uuid";
import { isInitialized, saveContext, loadBranchContext } from "../core/context";
import {
  getCurrentBranch,
  getRepoName,
  getRepoRoot,
  getChangedFiles,
  getStagedFiles,
  getRecentCommits,
  getAuthor,
} from "../core/git";
import { ContextEntry } from "../core/types";
import { extractFromEditorSessions } from "../core/parser";
import { generatePrompt } from "../core/prompt";
import { injectContextIntoRules } from "../core/agent-rules";

interface SaveOptions {
  goal?: string;
  approaches?: string;
  decisions?: string;
  state?: string;
  nextSteps?: string;
  blockers?: string;
  assignee?: string;
  handoffNote?: string;
  auto?: boolean;
}

export async function saveCommand(message?: string, options?: SaveOptions) {
  if (!(await isInitialized())) {
    console.log(chalk.red("✗ ValyrianCtx not initialized. Run `valyrianctx init` first."));
    return;
  }

  try {
    const [branch, repo, filesChanged, filesStaged, recentCommits, author] = await Promise.all([
      getCurrentBranch(),
      getRepoName(),
      getChangedFiles(),
      getStagedFiles(),
      getRecentCommits(),
      getAuthor(),
    ]);

    let task = message || "";
    let approaches: string[] = [];
    let decisions: string[] = [];
    let currentState = "";
    let nextSteps: string[] = [];
    let blockers: string[] = [];

    // Check if structured flags were provided (AI agent mode)
    const hasStructuredInput =
      options?.approaches || options?.decisions || options?.state || options?.nextSteps;

    if (options?.auto) {
      // Guard: skip auto-save if a rich structured save was made recently (within 5 min).
      // This prevents the post-commit hook from overwriting a high-quality manual save
      // with a lower-quality auto-extracted one — since generatePrompt() uses the latest entry.
      const existing = await loadBranchContext(branch);
      if (existing.length > 0) {
        const latest = existing[existing.length - 1];
        const ageMs = Date.now() - new Date(latest.timestamp).getTime();
        const isRichSave = latest.approaches.length > 0 || latest.decisions.length > 0;
        if (isRichSave && ageMs < 5 * 60 * 1000) {
          console.log(chalk.gray("  Recent structured save found, skipping auto-save."));
          return;
        }
      }

      // Auto-extract mode — read from editor session data
      console.log(chalk.gray("  Scanning editor sessions for context..."));
      const cwd = process.cwd();
      const extracted = await extractFromEditorSessions(cwd);

      if (extracted) {
        task = message || extracted.task;
        approaches = extracted.approaches;
        decisions = extracted.decisions;
        currentState = extracted.currentState;
        nextSteps = extracted.nextSteps;
        blockers = extracted.blockers;
        console.log(chalk.gray(`  Found context from: ${extracted.source}`));
      } else {
        console.log(chalk.yellow("⚠ No editor session data found. Using message only."));
        task = message || "Session (auto-extract found nothing)";
        currentState = message || "";
      }
    } else if (hasStructuredInput && message) {
      // Programmatic mode — AI agent is passing structured context
      task = message;
      approaches = options?.approaches
        ? options.approaches.split(";;").map((s) => s.trim()).filter(Boolean)
        : [];
      decisions = options?.decisions
        ? options.decisions.split(";;").map((s) => s.trim()).filter(Boolean)
        : [];
      currentState = options?.state || message;
      nextSteps = options?.nextSteps
        ? options.nextSteps.split(";;").map((s) => s.trim()).filter(Boolean)
        : [];
      blockers = options?.blockers
        ? options.blockers.split(";;").map((s) => s.trim()).filter(Boolean)
        : [];
    } else if (!message) {
      // Interactive mode
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "task",
          message: "What were you working on?",
          validate: (input: string) => input.length > 0 || "Task description is required",
        },
        {
          type: "input",
          name: "approaches",
          message: "What approaches did you try? (comma-separated, or skip)",
          default: "",
        },
        {
          type: "input",
          name: "decisions",
          message: "Key decisions made? (comma-separated, or skip)",
          default: "",
        },
        {
          type: "input",
          name: "currentState",
          message: "Where did you leave off?",
          validate: (input: string) => input.length > 0 || "Current state is required",
        },
        {
          type: "input",
          name: "nextSteps",
          message: "What comes next? (comma-separated, or skip)",
          default: "",
        },
        {
          type: "input",
          name: "blockers",
          message: "Any blockers? (comma-separated, or skip)",
          default: "",
        },
      ]);

      task = answers.task;
      approaches = answers.approaches
        ? answers.approaches.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
      decisions = answers.decisions
        ? answers.decisions.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
      currentState = answers.currentState;
      nextSteps = answers.nextSteps
        ? answers.nextSteps.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
      blockers = answers.blockers
        ? answers.blockers.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
    } else {
      // Simple message mode
      currentState = message;
    }

    const entry: ContextEntry = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      branch,
      repo,
      author,
      task,
      goal: options?.goal,
      approaches,
      decisions,
      currentState,
      nextSteps,
      blockers: blockers.length > 0 ? blockers : undefined,
      filesChanged,
      filesStaged,
      recentCommits,
      assignee: options?.assignee,
      handoffNote: options?.handoffNote,
    };

    const savedTo = await saveContext(entry);
    console.log(chalk.green(`✓ Context saved for branch: ${chalk.bold(branch)}`));
    console.log(
      chalk.gray(
        `  ${filesChanged.length} files changed, ${recentCommits.length} recent commits captured`
      )
    );
    if (approaches.length > 0) {
      console.log(chalk.gray(`  ${approaches.length} approaches, ${decisions.length} decisions recorded`));
    }

    // Auto-inject context into IDE rule files (the "living context" mechanism).
    // This writes the actual context into files the AI already reads, so the
    // next session picks it up automatically — no commands needed.
    try {
      const root = await getRepoRoot();
      const entries = await loadBranchContext(branch);
      const prompt = generatePrompt(entries);
      const injected = await injectContextIntoRules(root, prompt);
      if (injected > 0) {
        console.log(chalk.gray(`  Context synced to ${injected} IDE rule file(s) for auto-resume`));
      }
    } catch {
      // Non-fatal — injection is best-effort
    }
  } catch (err: any) {
    console.log(chalk.red(`✗ Error: ${err.message}`));
  }
}
