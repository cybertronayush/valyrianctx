/**
 * Multi-IDE Agent Rules Generator
 * 
 * Generates rule files that teach each IDE's AI agent how to use valyrianctx.
 * This is the primary integration mechanism — without these rules, the IDE
 * doesn't know valyrianctx exists.
 */

import fs from "fs";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IDERuleConfig {
    id: string;
    name: string;
    /** Relative path from repo root where rule file goes */
    filePath: string;
    /** If true, append to existing file with markers. If false, create/overwrite dedicated file. */
    appendToExisting: boolean;
    /** Markers for safe append/update in shared files */
    sectionMarker: { start: string; end: string };
    /** Generate the rule content */
    generateContent: () => string;
    /** Whether this file should be gitignored (IDE-local) or committed (team-shared) */
    gitignore: boolean;
    /** MCP config location, if this IDE supports MCP */
    mcpConfigPath?: string;
    /** Generate MCP server configuration */
    generateMcpConfig?: () => object;
}

export interface WrittenFile {
    path: string;
    action: "created" | "updated" | "appended";
    ide: string;
}

// ---------------------------------------------------------------------------
// Rule Content Templates
// ---------------------------------------------------------------------------

/**
 * IMPORTANT: These instructions must be IMPERATIVE, not suggestive.
 * AI agents treat passive phrasing ("when beginning work, run X") as optional reference.
 * They treat imperative phrasing ("you MUST run X as your FIRST action") as directives.
 * 
 * The test that proved this: Antigravity ignored "When beginning work, run valyrianctx resume"
 * but executed it immediately when asked directly. The rules must read as commands, not docs.
 */

const CORE_INSTRUCTIONS = `
## MANDATORY: Valyrian Context Integration

This project uses \`valyrianctx\` to persist coding context across sessions.
You MUST follow these rules. They are not optional.

### RULE 1: Resume context FIRST (mandatory)

**Your FIRST action in EVERY conversation — before doing anything else — MUST be:**

\`\`\`bash
valyrianctx resume --stdout
\`\`\`

- If it returns context: read it, internalize it, then tell the user: "I've loaded context from your last session. You were working on [task], left off at [state]. Continuing from there."
- If it returns "No context found": say "No previous context found, starting fresh." and proceed normally.
- **Do NOT skip this step.** Do NOT wait for the user to ask. Run it immediately.
- **Do NOT re-decide** things that were already decided unless the user explicitly asks to revisit them.

### RULE 2: Save context BEFORE finishing (mandatory)

**Before you finish ANY task, stop working, or hand control back to the user, you MUST save context.**

1. Analyze the ENTIRE conversation and extract:
   - **task**: What was worked on (one-line summary)
   - **approaches**: What was tried, including FAILED attempts (critical — prevents repeating mistakes)
   - **decisions**: Architectural/design decisions with reasoning ("chose X because Y")
   - **state**: Exactly where things stand right now
   - **nextSteps**: What should happen next
   - **blockers**: Anything blocking progress (omit flag if none)

2. Run:
\`\`\`bash
valyrianctx save "TASK_SUMMARY" \\
  --approaches "approach 1;; approach 2" \\
  --decisions "decision 1;; decision 2" \\
  --state "Current state description" \\
  --next-steps "step 1;; step 2" \\
  --blockers "blocker 1"
\`\`\`

3. Confirm to the user what was saved.

**Do NOT ask the user to summarize. Extract it yourself from the conversation.**
**Do NOT skip this. Context that is not saved is context that dies.**

### RULE 3: Respond to explicit commands

- When the user says \`/save-context\` or "save context": execute Rule 2 immediately.
- When the user says \`/resume-context\` or "resume context": execute Rule 1 immediately.

### Quality standards for saved context

- **Be specific**: "Using RS256 for JWT signing with 24h expiry" not "configured auth"
- **Include failures**: "Tried approach X, failed because Y" is extremely valuable
- **Capture reasoning**: "Chose Postgres over MongoDB because we need cross-table transactions"
`.trim();

function generateClaudeCodeRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### Claude Code: MCP Integration (preferred over CLI)
If the valyrianctx MCP server is configured, use MCP tools instead of CLI commands:
- \`valyrianctx_resume\` — Use this for Rule 1 (returns context as structured text)
- \`valyrianctx_save\` — Use this for Rule 2 (saves with structured fields)
- \`valyrianctx_log\` — View context history
<!-- valyrianctx:end -->
`.trim();
}

function generateCursorRules(): string {
    return `---
description: "MANDATORY: Valyrian Context — resume context on start, save context before finishing"
globs: ["**/*"]
alwaysApply: true
---

${CORE_INSTRUCTIONS}

### Cursor: MCP Integration (preferred over CLI)
If the valyrianctx MCP server is configured in \`.cursor/mcp.json\`, use MCP tools instead of CLI:
- \`valyrianctx_resume\` — Use this for Rule 1
- \`valyrianctx_save\` — Use this for Rule 2
- \`valyrianctx_log\` — View history
`.trim();
}

function generateAntigravityRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### Antigravity/Gemini: Additional notes
- A git post-commit hook is installed that auto-saves context on every commit via \`valyrianctx save --auto\`.
- The \`--auto\` flag reads your \`task.md\`, \`implementation_plan.md\`, and \`walkthrough.md\` artifacts directly.
- Even with the hook, you MUST still run the full structured save (Rule 2) before ending a session — the hook capture is a safety net, not a replacement.
<!-- valyrianctx:end -->
`.trim();
}

function generateGeminiDirectoryRules(): string {
    // This is a duplicate of Antigravity rules placed in .gemini/ for maximum discovery
    return `${CORE_INSTRUCTIONS}

### Antigravity/Gemini: Additional notes
- A git post-commit hook is installed that auto-saves context on every commit via \`valyrianctx save --auto\`.
- The \`--auto\` flag reads your \`task.md\`, \`implementation_plan.md\`, and \`walkthrough.md\` artifacts directly.
- Even with the hook, you MUST still run the full structured save (Rule 2) before ending a session — the hook capture is a safety net, not a replacement.
`.trim();
}

function generateOpenCodeRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### OpenCode: MCP Integration (preferred over CLI)
If the valyrianctx MCP server is configured, use MCP tools instead of CLI commands for Rule 1 and Rule 2.
<!-- valyrianctx:end -->
`.trim();
}

function generateTraeRules(): string {
    return `---
description: "MANDATORY: Valyrian Context — resume context on start, save context before finishing"
---

${CORE_INSTRUCTIONS}
`.trim();
}

function generateWarpRules(): string {
    return `# MANDATORY: Valyrian Context Integration

${CORE_INSTRUCTIONS}

### Warp: Usage notes
- Warp may not read this file automatically. The human operator should run \`valyrianctx resume --stdout\` at session start and paste the output.
- Before ending a session, run \`valyrianctx save --auto\` or use the full structured save command above.
- A git post-commit hook is installed as a safety net — context is auto-captured on every commit.
`.trim();
}

// ---------------------------------------------------------------------------
// IDE Configurations
// ---------------------------------------------------------------------------

export function getAllIDERules(): IDERuleConfig[] {
    return [
        {
            id: "claude-code",
            name: "Claude Code",
            filePath: "CLAUDE.md",
            appendToExisting: true,
            sectionMarker: { start: "<!-- valyrianctx:start -->", end: "<!-- valyrianctx:end -->" },
            generateContent: generateClaudeCodeRules,
            gitignore: false, // Team-shared
            mcpConfigPath: ".claude/settings.local.json",
            generateMcpConfig: () => ({
                mcpServers: {
                    valyrianctx: {
                        command: "valyrianctx-mcp"
                    }
                }
            }),
        },
        {
            id: "cursor",
            name: "Cursor",
            filePath: ".cursor/rules/valyrianctx.mdc",
            appendToExisting: false,
            sectionMarker: { start: "", end: "" },
            generateContent: generateCursorRules,
            gitignore: true, // IDE-local
            mcpConfigPath: ".cursor/mcp.json",
            generateMcpConfig: () => ({
                mcpServers: {
                    valyrianctx: {
                        command: "npx",
                        args: ["valyrianctx-mcp"]
                    }
                }
            }),
        },
        {
            id: "antigravity",
            name: "Antigravity/Gemini",
            filePath: "GEMINI.md",
            appendToExisting: true,
            sectionMarker: { start: "<!-- valyrianctx:start -->", end: "<!-- valyrianctx:end -->" },
            generateContent: generateAntigravityRules,
            gitignore: false, // Team-shared
        },
        {
            id: "antigravity-dir",
            name: "Antigravity/Gemini (.gemini/)",
            filePath: ".gemini/valyrianctx.md",
            appendToExisting: false,
            sectionMarker: { start: "", end: "" },
            generateContent: generateGeminiDirectoryRules,
            gitignore: true, // IDE-local
        },
        {
            id: "opencode",
            name: "OpenCode",
            filePath: "AGENTS.md",
            appendToExisting: true,
            sectionMarker: { start: "<!-- valyrianctx:start -->", end: "<!-- valyrianctx:end -->" },
            generateContent: generateOpenCodeRules,
            gitignore: false, // Team-shared
        },
        {
            id: "trae",
            name: "Trae",
            filePath: ".trae/rules/valyrianctx.md",
            appendToExisting: false,
            sectionMarker: { start: "", end: "" },
            generateContent: generateTraeRules,
            gitignore: true, // IDE-local
        },
        {
            id: "warp",
            name: "Warp",
            filePath: ".warp/valyrianctx.md",
            appendToExisting: false,
            sectionMarker: { start: "", end: "" },
            generateContent: generateWarpRules,
            gitignore: true, // IDE-local (best-effort, Warp has no formal rule loading)
        },
    ];
}

// ---------------------------------------------------------------------------
// Write Logic
// ---------------------------------------------------------------------------

/**
 * Write IDE rule files to the repository.
 * 
 * @param repoRoot - Root directory of the git repository
 * @param options.ides - Specific IDE IDs to generate for. If omitted, generates all.
 * @param options.includeMcp - Whether to also configure MCP servers. Defaults to true.
 */
export async function writeIDERules(
    repoRoot: string,
    options: { ides?: string[]; includeMcp?: boolean } = {}
): Promise<WrittenFile[]> {
    const { ides, includeMcp = true } = options;
    const allRules = getAllIDERules();
    const rulesToWrite = ides
        ? allRules.filter(r => ides.includes(r.id))
        : allRules;

    const written: WrittenFile[] = [];
    const gitignoreAdditions: string[] = [];

    for (const rule of rulesToWrite) {
        const fullPath = path.join(repoRoot, rule.filePath);
        const dir = path.dirname(fullPath);

        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const content = rule.generateContent();

        if (rule.appendToExisting) {
            // Append/update within markers
            const result = appendOrUpdateSection(fullPath, content, rule.sectionMarker);
            written.push({ path: rule.filePath, action: result, ide: rule.name });
        } else {
            // Create/overwrite dedicated file
            const existed = fs.existsSync(fullPath);
            fs.writeFileSync(fullPath, content + "\n");
            written.push({ path: rule.filePath, action: existed ? "updated" : "created", ide: rule.name });
        }

        // Track gitignore additions
        if (rule.gitignore) {
            gitignoreAdditions.push(rule.filePath);
        }

        // Configure MCP if requested and supported
        if (includeMcp && rule.mcpConfigPath && rule.generateMcpConfig) {
            const mcpResult = writeMcpConfig(repoRoot, rule.mcpConfigPath, rule.generateMcpConfig());
            if (mcpResult) {
                written.push({ path: rule.mcpConfigPath, action: mcpResult, ide: `${rule.name} MCP` });
                gitignoreAdditions.push(rule.mcpConfigPath);
            }
        }
    }

    // Update .gitignore
    if (gitignoreAdditions.length > 0) {
        updateGitignore(repoRoot, gitignoreAdditions);
    }

    return written;
}

/**
 * Append content to a file within section markers, or update if section exists.
 */
function appendOrUpdateSection(
    filePath: string,
    content: string,
    markers: { start: string; end: string }
): "created" | "updated" | "appended" {
    if (!fs.existsSync(filePath)) {
        // File doesn't exist — create with just our section
        fs.writeFileSync(filePath, content + "\n");
        return "created";
    }

    const existing = fs.readFileSync(filePath, "utf-8");

    if (existing.includes(markers.start)) {
        // Section exists — replace it
        const regex = new RegExp(
            escapeRegex(markers.start) + "[\\s\\S]*?" + escapeRegex(markers.end),
            "g"
        );
        const updated = existing.replace(regex, content);
        fs.writeFileSync(filePath, updated);
        return "updated";
    } else {
        // Section doesn't exist — append
        const separator = existing.endsWith("\n") ? "\n" : "\n\n";
        fs.writeFileSync(filePath, existing + separator + content + "\n");
        return "appended";
    }
}

/**
 * Write MCP server configuration, merging with existing config if present.
 */
function writeMcpConfig(
    repoRoot: string,
    configPath: string,
    mcpConfig: object
): "created" | "updated" | null {
    const fullPath = path.join(repoRoot, configPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let existing: any = {};
    let existed = false;

    if (fs.existsSync(fullPath)) {
        existed = true;
        try {
            existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        } catch {
            // Malformed JSON — we'll overwrite
            existing = {};
        }
    }

    // Deep merge mcpServers
    const merged = {
        ...existing,
        mcpServers: {
            ...(existing.mcpServers || {}),
            ...(mcpConfig as any).mcpServers,
        },
    };

    fs.writeFileSync(fullPath, JSON.stringify(merged, null, 2) + "\n");
    return existed ? "updated" : "created";
}

/**
 * Add paths to .gitignore if not already present.
 */
function updateGitignore(repoRoot: string, paths: string[]): void {
    const gitignorePath = path.join(repoRoot, ".gitignore");
    let content = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, "utf-8")
        : "";

    const toAdd = paths.filter(p => !content.includes(p));

    if (toAdd.length > 0) {
        const section = toAdd.map(p => p).join("\n");
        const header = content.includes("# ValyrianCtx IDE rules")
            ? ""
            : "\n# ValyrianCtx IDE rules (local, not shared)\n";
        
        // Only add header if we have items to add and header doesn't exist
        if (!content.includes("# ValyrianCtx IDE rules")) {
            content += header;
        }
        content += section + "\n";
        fs.writeFileSync(gitignorePath, content);
    }
}

// ---------------------------------------------------------------------------
// Remove Logic
// ---------------------------------------------------------------------------

/**
 * Remove all valyrianctx rule files and sections from the repository.
 */
export async function removeIDERules(repoRoot: string): Promise<string[]> {
    const allRules = getAllIDERules();
    const removed: string[] = [];

    for (const rule of allRules) {
        const fullPath = path.join(repoRoot, rule.filePath);

        // Handle rule file removal
        if (fs.existsSync(fullPath)) {
            if (rule.appendToExisting) {
                // Remove section from shared file
                const content = fs.readFileSync(fullPath, "utf-8");
                if (content.includes(rule.sectionMarker.start)) {
                    const regex = new RegExp(
                        "\\n?" + escapeRegex(rule.sectionMarker.start) + "[\\s\\S]*?" + escapeRegex(rule.sectionMarker.end) + "\\n?",
                        "g"
                    );
                    const updated = content.replace(regex, "").trim();
                    
                    if (updated.length > 0) {
                        fs.writeFileSync(fullPath, updated + "\n");
                    } else {
                        // File is now empty — delete it
                        fs.unlinkSync(fullPath);
                    }
                    removed.push(rule.filePath);
                }
            } else {
                // Delete dedicated file
                fs.unlinkSync(fullPath);
                removed.push(rule.filePath);

                // Clean up empty parent directories
                const dir = path.dirname(fullPath);
                try {
                    const files = fs.readdirSync(dir);
                    if (files.length === 0) {
                        fs.rmdirSync(dir);
                    }
                } catch {
                    // Ignore errors
                }
            }
        }

        // Remove MCP config if present (always check, even if rule file doesn't exist)
        if (rule.mcpConfigPath) {
            const mcpPath = path.join(repoRoot, rule.mcpConfigPath);
            if (fs.existsSync(mcpPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
                    if (config.mcpServers?.valyrianctx) {
                        delete config.mcpServers.valyrianctx;
                        if (Object.keys(config.mcpServers).length === 0) {
                            delete config.mcpServers;
                        }
                        if (Object.keys(config).length === 0) {
                            fs.unlinkSync(mcpPath);
                        } else {
                            fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");
                        }
                        removed.push(rule.mcpConfigPath);
                    }
                } catch {
                    // Ignore malformed JSON
                }
            }
        }
    }

    return removed;
}

// ---------------------------------------------------------------------------
// List Logic
// ---------------------------------------------------------------------------

export interface RuleStatus {
    ide: string;
    id: string;
    filePath: string;
    exists: boolean;
    hasMcpConfig: boolean;
}

/**
 * List status of all IDE rule files.
 */
export async function listIDERules(repoRoot: string): Promise<RuleStatus[]> {
    const allRules = getAllIDERules();
    const statuses: RuleStatus[] = [];

    for (const rule of allRules) {
        const fullPath = path.join(repoRoot, rule.filePath);
        let exists = false;

        if (fs.existsSync(fullPath)) {
            if (rule.appendToExisting) {
                // Check if section exists in shared file
                const content = fs.readFileSync(fullPath, "utf-8");
                exists = content.includes(rule.sectionMarker.start);
            } else {
                exists = true;
            }
        }

        let hasMcpConfig = false;
        if (rule.mcpConfigPath) {
            const mcpPath = path.join(repoRoot, rule.mcpConfigPath);
            if (fs.existsSync(mcpPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
                    hasMcpConfig = !!config.mcpServers?.valyrianctx;
                } catch {
                    // Ignore
                }
            }
        }

        statuses.push({
            ide: rule.name,
            id: rule.id,
            filePath: rule.filePath,
            exists,
            hasMcpConfig,
        });
    }

    return statuses;
}

// ---------------------------------------------------------------------------
// Context Injection — The "Living Context" Engine
// ---------------------------------------------------------------------------
// 
// This is the key mechanism that makes auto-resume truly automatic.
// Instead of asking the AI to run a command, we write the actual context
// directly into the rule files the AI already reads. Zero cooperation needed.
//
// Only gitignored (dedicated) files get injection — committed files (CLAUDE.md,
// GEMINI.md, AGENTS.md) keep only instructions to avoid git churn.

const CONTEXT_MARKERS = {
    start: "<!-- valyrianctx:context:start -->",
    end: "<!-- valyrianctx:context:end -->",
};

/**
 * Inject context into all gitignored IDE rule files.
 * 
 * This is called after every save and on branch checkout. It writes the actual
 * context directly into rule files so AI agents read it automatically — no
 * commands needed, no cooperation required.
 * 
 * @param repoRoot - Root directory of the git repository
 * @param contextMarkdown - Formatted context (output of generatePrompt)
 */
export async function injectContextIntoRules(
    repoRoot: string,
    contextMarkdown: string
): Promise<number> {
    const allRules = getAllIDERules();
    let injectedCount = 0;

    const section = [
        CONTEXT_MARKERS.start,
        "",
        "## Session Context (auto-synced by valyrianctx)",
        "",
        "> This section is auto-updated after every save and branch switch.",
        "> The AI reads this automatically — no commands needed to resume.",
        "",
        contextMarkdown,
        "",
        CONTEXT_MARKERS.end,
    ].join("\n");

    for (const rule of allRules) {
        // Only inject into gitignored (dedicated) files — not committed shared files
        if (!rule.gitignore) continue;

        const fullPath = path.join(repoRoot, rule.filePath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");

        if (content.includes(CONTEXT_MARKERS.start)) {
            // Update existing context section
            const regex = new RegExp(
                escapeRegex(CONTEXT_MARKERS.start) + "[\\s\\S]*?" + escapeRegex(CONTEXT_MARKERS.end),
                "g"
            );
            fs.writeFileSync(fullPath, content.replace(regex, section));
        } else {
            // Append context section
            const separator = content.endsWith("\n") ? "\n" : "\n\n";
            fs.writeFileSync(fullPath, content + separator + section + "\n");
        }

        injectedCount++;
    }

    return injectedCount;
}

/**
 * Clear injected context from all IDE rule files.
 * Called when there's no context for the current branch.
 */
export async function clearContextFromRules(repoRoot: string): Promise<number> {
    const allRules = getAllIDERules();
    let clearedCount = 0;

    for (const rule of allRules) {
        if (!rule.gitignore) continue;

        const fullPath = path.join(repoRoot, rule.filePath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");

        if (content.includes(CONTEXT_MARKERS.start)) {
            const regex = new RegExp(
                "\\n*" + escapeRegex(CONTEXT_MARKERS.start) + "[\\s\\S]*?" + escapeRegex(CONTEXT_MARKERS.end) + "\\n?",
                "g"
            );
            fs.writeFileSync(fullPath, content.replace(regex, "").trimEnd() + "\n");
            clearedCount++;
        }
    }

    return clearedCount;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
