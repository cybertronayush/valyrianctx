#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { saveCommand } from "./commands/save";
import { resumeCommand } from "./commands/resume";
import { logCommand } from "./commands/log";
import { diffCommand } from "./commands/diff";
import { handoffCommand } from "./commands/handoff";
import { shareCommand } from "./commands/share";
import { watchCommand } from "./commands/watch";
import { hookCommand } from "./commands/hook";
import { summarizeCommand } from "./commands/summarize";
import { suggestCommand } from "./commands/suggest";
import { compressCommand } from "./commands/compress";
import { configCommand } from "./commands/config-cmd";
import { rulesCommand } from "./commands/rules";

const program = new Command();

program
  .name("valyrianctx")
  .description("Persistent AI coding context for teams")
  .version("0.5.0");

program
  .command("init")
  .description("Initialize Valyrian Context in the current repo")
  .action(initCommand);

program
  .command("save [message]")
  .description("Save current coding context")
  .option("-g, --goal <goal>", "Goal or ticket reference")
  .option("-a, --auto", "Auto-extract context from editor sessions (Claude Code, Antigravity, Cursor)")
  .option("--approaches <approaches>", "Approaches tried (;; separated)")
  .option("--decisions <decisions>", "Key decisions made (;; separated)")
  .option("--state <state>", "Current state / where you left off")
  .option("--next-steps <nextSteps>", "Next steps (;; separated)")
  .option("--blockers <blockers>", "Blockers (;; separated)")
  .action(saveCommand);

program
  .command("resume")
  .description("Generate context prompt for AI tools")
  .option("-b, --branch <branch>", "Resume context from a specific branch")
  .option("--stdout", "Output to stdout instead of clipboard")
  .option("--inject", "Inject context into IDE rule files (used by git hooks)")
  .action(resumeCommand);

program
  .command("log")
  .description("View context history")
  .option("-a, --all", "Show all branches")
  .option("-n, --count <n>", "Number of entries to show", "10")
  .action(logCommand);

program
  .command("diff")
  .description("Show what changed since the last context save")
  .action(diffCommand);

// v0.2 — Team Features
program
  .command("handoff [assignee] [message]")
  .description("Hand off context to a teammate")
  .action(handoffCommand);

program
  .command("share")
  .description("Share .valyrianctx/ via git for team collaboration")
  .option("--stop", "Stop sharing (add .valyrianctx/ back to .gitignore)")
  .action(shareCommand);

// v0.3 — Auto-Capture
program
  .command("watch")
  .description("Watch for file changes and auto-save context")
  .option("-i, --interval <minutes>", "Auto-save interval in minutes", "5")
  .action(watchCommand);

program
  .command("hook <action>")
  .description("Manage git hooks (install/remove)")
  .action(hookCommand);

// v0.4 — AI-Powered
program
  .command("summarize")
  .description("Auto-generate context from git diff + commits using AI")
  .action(summarizeCommand);

program
  .command("suggest")
  .description("AI-powered next step suggestions")
  .action(suggestCommand);

program
  .command("compress")
  .description("Compress old context entries using AI")
  .action(compressCommand);

program
  .command("config [action] [key] [value]")
  .description("Manage Valyrian Context configuration (list/get/set)")
  .action(configCommand);

program
  .command("rules [action]")
  .description("Manage IDE integration rules (generate/remove/list)")
  .option("--ide <ids>", "Comma-separated IDE IDs to target")
  .option("--no-mcp", "Skip MCP server configuration")
  .action(rulesCommand);

program.parse();

