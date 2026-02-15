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

const CORE_INSTRUCTIONS = `
## Valyrian Context Integration

Valyrian Context tracks your coding intent, decisions, and progress across sessions.

### On Session Start
When beginning work or when the user says \`/resume-context\`:
1. Run: \`valyrianctx resume --stdout\`
2. Internalize the briefing — understand what was being worked on, what's been tried, what decisions were made
3. Acknowledge to the user: "I've loaded your context. You were working on [task], left off at [state]. Ready to continue?"
4. **Do not re-decide** things that were already decided unless explicitly asked

### On Task Completion
Before finishing a task, handing off, or when the user says \`/save-context\`:
1. Introspect the conversation and extract:
   - **task**: What was worked on (one-line summary)
   - **approaches**: What was tried, including failed attempts (valuable for future sessions)
   - **decisions**: Key architectural/design decisions with reasoning
   - **state**: Where things ended up
   - **nextSteps**: What comes next
   - **blockers**: Anything blocking progress
2. Run the save command with all fields:
\`\`\`bash
valyrianctx save "TASK_SUMMARY" \\
  --approaches "approach 1;; approach 2" \\
  --decisions "decision 1;; decision 2" \\
  --state "Current state" \\
  --next-steps "step 1;; step 2" \\
  --blockers "blocker 1"
\`\`\`
3. Confirm to the user what was saved

### Auto-Extract Mode
For quick saves, use \`--auto\` to let valyrianctx extract context from your session artifacts:
\`\`\`bash
valyrianctx save --auto
\`\`\`

### Key Principles
- **Be thorough**: Include failed approaches — they prevent repeating mistakes
- **Be specific**: "Using RS256 for JWT signing" beats "configured auth"
- **Capture reasoning**: "Chose Postgres over MongoDB because we need transactions"
- **Don't ask the user to summarize** — extract it from the conversation yourself
`.trim();

function generateClaudeCodeRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### MCP Integration (Preferred)
If the valyrianctx MCP server is configured, prefer using the MCP tools:
- \`valyrianctx_resume\` — Get context prompt for current branch
- \`valyrianctx_save\` — Save context with structured fields
- \`valyrianctx_log\` — View context history

### Slash Commands
- \`/resume-context\` — Load and acknowledge saved context
- \`/save-context\` — Extract and save context from this conversation
<!-- valyrianctx:end -->
`.trim();
}

function generateCursorRules(): string {
    return `---
description: Valyrian Context - Persistent AI coding context management
globs: ["**/*"]
alwaysApply: true
---

${CORE_INSTRUCTIONS}

### MCP Integration (Preferred)
If the valyrianctx MCP server is configured in \`.cursor/mcp.json\`, prefer using MCP tools:
- \`valyrianctx_resume\` — Get context prompt
- \`valyrianctx_save\` — Save context
- \`valyrianctx_log\` — View history
`.trim();
}

function generateAntigravityRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### Antigravity-Specific Notes
- Valyrianctx can auto-extract context from your \`task.md\`, \`implementation_plan.md\`, and \`walkthrough.md\` files
- Use \`valyrianctx save --auto\` to leverage this extraction
- Your checklist progress, decisions in \`[!NOTE]\` blocks, and implementation details are automatically captured
<!-- valyrianctx:end -->
`.trim();
}

function generateOpenCodeRules(): string {
    return `
<!-- valyrianctx:start -->
${CORE_INSTRUCTIONS}

### MCP Integration (Preferred)
If the valyrianctx MCP server is configured, prefer using MCP tools over CLI commands.
<!-- valyrianctx:end -->
`.trim();
}

function generateTraeRules(): string {
    return `---
description: Valyrian Context - Persistent AI coding context management
---

${CORE_INSTRUCTIONS}
`.trim();
}

function generateWarpRules(): string {
    return `# Valyrian Context Integration

${CORE_INSTRUCTIONS}

### Warp-Specific Notes
- Warp does not have formal rule loading — this file serves as documentation
- The human operator should run \`valyrianctx resume\` at session start and share the output
- Before ending a session, run \`valyrianctx save --auto\` or use the full structured save command
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
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
