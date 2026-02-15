import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

export interface ExtractedContext {
    task: string;
    approaches: string[];
    decisions: string[];
    currentState: string;
    nextSteps: string[];
    blockers: string[];
    source: string;
}

/**
 * Attempt to auto-extract context from AI editor session data.
 * Scans Claude Code, Antigravity, Cursor, and Windsurf storage.
 */
export async function extractFromEditorSessions(
    repoPath: string
): Promise<ExtractedContext | null> {
    // Try each source in priority order
    const extractors = [
        extractFromClaudeCode,
        extractFromAntigravity,
        extractFromCursor,
        extractFromOpenCode,
        extractFromTrae,
        extractFromWarp,
    ];

    for (const extractor of extractors) {
        try {
            const result = await extractor(repoPath);
            if (result && result.task) return result;
        } catch {
            // Continue to next extractor
        }
    }

    return null;
}

// -------------------------------------------------------------------
// Claude Code: ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
// -------------------------------------------------------------------
async function extractFromClaudeCode(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const claudeDir = path.join(home, ".claude", "projects");

    if (!fs.existsSync(claudeDir)) return null;

    // Find the project folder matching this repo path
    // Claude encodes paths by replacing / with -
    const encodedPath = repoPath.replace(/\//g, "-");
    const projectDirs = fs.readdirSync(claudeDir);
    const matchingDir = projectDirs.find((d) => encodedPath.endsWith(d) || d.endsWith(encodedPath.slice(1)));

    if (!matchingDir) return null;

    const projectPath = path.join(claudeDir, matchingDir);

    // 1. Try memory files first (most structured)
    const memoryDir = path.join(projectPath, "memory");
    if (fs.existsSync(memoryDir)) {
        const memoryResult = parseClaudeMemory(memoryDir);
        if (memoryResult) return memoryResult;
    }

    // 2. Parse the most recent session JSONL
    const jsonlFiles = fs
        .readdirSync(projectPath)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(projectPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (jsonlFiles.length === 0) return null;

    const latestSession = path.join(projectPath, jsonlFiles[0].name);
    return await parseClaudeSession(latestSession);
}

function parseClaudeMemory(memoryDir: string): ExtractedContext | null {
    const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
    if (files.length === 0) return null;

    let task = "";
    const decisions: string[] = [];
    const approaches: string[] = [];
    let currentState = "";
    const nextSteps: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(path.join(memoryDir, file), "utf-8");

        // Extract project description from memory
        if (file === "MEMORY.md") {
            const projectMatch = content.match(/##\s*Project\s*(?:Location|Overview)?\s*\n([\s\S]*?)(?=\n##|$)/i);
            if (projectMatch) {
                const lines = projectMatch[1].trim().split("\n").filter(Boolean);
                task = lines[0]?.replace(/^[-*]\s*\*\*.*?\*\*:\s*/, "").trim() || "";
            }
        }

        // Extract conventions as decisions
        const conventionMatch = content.match(/##\s*Conventions?\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (conventionMatch) {
            const lines = conventionMatch[1].trim().split("\n").filter(Boolean);
            for (const line of lines.slice(0, 5)) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length > 10) decisions.push(cleaned);
            }
        }

        // Extract patterns as approaches
        const patternMatch = content.match(/##\s*Patterns?\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (patternMatch) {
            const lines = patternMatch[1].trim().split("\n").filter(Boolean);
            for (const line of lines.slice(0, 5)) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length > 10) approaches.push(cleaned);
            }
        }
    }

    if (!task && decisions.length === 0) return null;

    return {
        task: task || "Project session (from Claude Code memory)",
        approaches,
        decisions,
        currentState: currentState || "Loaded from Claude Code memory files",
        nextSteps,
        blockers: [],
        source: "claude-code-memory",
    };
}

async function parseClaudeSession(
    sessionPath: string
): Promise<ExtractedContext | null> {
    // Read ALL lines — we need both the first messages (intent) and last messages (state)
    const allLines = await readLastLines(sessionPath, 500);

    // Separate into first messages (intent) and last messages (current state)
    const firstUserMessages: string[] = [];
    const lastUserMessages: string[] = [];
    const lastAssistantMessages: string[] = [];

    for (const line of allLines) {
        try {
            const entry = JSON.parse(line);
            const text = extractMessageText(entry);
            if (!text || text.length < 5) continue;

            if (entry.type === "user") {
                // Collect first 3 user messages as intent
                if (firstUserMessages.length < 3) {
                    firstUserMessages.push(text);
                }
                lastUserMessages.push(text);
            } else if (entry.type === "assistant" && text.length > 20) {
                lastAssistantMessages.push(text);
            }
        } catch {
            // Skip malformed lines
        }
    }

    if (firstUserMessages.length === 0) return null;

    // The FIRST user message is the intent — what they wanted to do
    const intent = firstUserMessages[0];
    const intentFirstLine = intent.split("\n")[0].trim();
    // Use first line if short, or first 200 chars
    const task = intentFirstLine.length < 300 ? intentFirstLine : intent.slice(0, 200);

    // Later user messages show what else was requested
    const additionalRequests = firstUserMessages.slice(1).map((m) => {
        const line = m.split("\n")[0].trim();
        return line.length < 200 ? line : line.slice(0, 200);
    });

    // Use assistant messages for decisions/approaches/state
    const recentAssistant = lastAssistantMessages.slice(-10);
    const decisions = extractDecisions(recentAssistant);
    const approaches = extractApproaches(recentAssistant);
    const currentState = extractState(recentAssistant);
    const nextSteps = extractNextSteps(recentAssistant);

    return {
        task,
        approaches: [...additionalRequests.map(r => `User also asked: ${r}`), ...approaches],
        decisions,
        currentState: currentState || "Session data parsed from Claude Code",
        nextSteps,
        blockers: [],
        source: "claude-code-session",
    };
}

function extractMessageText(entry: any): string {
    const content = entry.message?.content;
    if (!content) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");
    }
    return "";
}

// -------------------------------------------------------------------
// Antigravity: ~/.gemini/antigravity/brain/<id>/
// -------------------------------------------------------------------
async function extractFromAntigravity(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const brainDir = path.join(home, ".gemini", "antigravity", "brain");

    if (!fs.existsSync(brainDir)) return null;

    // Find most recent conversation that has artifacts
    const conversations = fs
        .readdirSync(brainDir)
        .map((d) => {
            const dir = path.join(brainDir, d);
            const taskFile = path.join(dir, "task.md");
            try {
                const stat = fs.existsSync(taskFile)
                    ? fs.statSync(taskFile)
                    : fs.statSync(dir);
                return { name: d, dir, taskFile, mtime: stat.mtime.getTime(), valid: true };
            } catch {
                return { name: d, dir, taskFile, mtime: 0, valid: false };
            }
        })
        .filter((d) => d.valid && fs.existsSync(d.taskFile))
        .sort((a, b) => b.mtime - a.mtime);

    if (conversations.length === 0) return null;

    const latest = conversations[0];

    // 1. Try to get the USER'S INTENT from implementation_plan.md
    //    The plan title and overview section capture what the user wanted
    let task = "";
    const decisions: string[] = [];
    const approaches: string[] = [];
    const planFile = path.join(latest.dir, "implementation_plan.md");
    if (fs.existsSync(planFile)) {
        const plan = fs.readFileSync(planFile, "utf-8");

        // First heading is the goal/intent
        const titleMatch = plan.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            task = titleMatch[1].trim();
        }
    }

    // 2. Parse task.md for MORE SPECIFIC active task
    //    If we have a specific checklist item that is In Progress or Recently Done, use that as the main task
    const taskContent = fs.existsSync(latest.taskFile) ? fs.readFileSync(latest.taskFile, "utf-8") : "";
    if (taskContent) {
        // Look for in-progress items first (user specific notations like [-] or [/])
        const inProgressMatch = taskContent.match(/-\s+\[[/-]\]\s+(.+)$/m);
        if (inProgressMatch) {
            task = inProgressMatch[1].trim();
        } else {
            // Look for last completed item (likely what was just finished)
            const completedMatches = [...taskContent.matchAll(/-\s+\[x\]\s+(.+)$/gm)];
            if (completedMatches.length > 0) {
                // Use the last TWO completed items if available, to capture context + verification
                const lastTwo = completedMatches.slice(-2).map(m => m[1].trim());
                const combinedTask = lastTwo.join(" + ");

                // Combine with plan title if available for context
                task = task ? `${combinedTask} (Structure: ${task})` : combinedTask;
            }
        }
    }

    if (fs.existsSync(planFile)) {
        const plan = fs.readFileSync(planFile, "utf-8");

        // Proposed changes sections often contain file lists - WE WANT TO IGNORE THESE
        // Instead, look for "Important" or "Note" alerts which contain architectural decisions
        const alertMatches = plan.matchAll(/>\s*\[!(?:IMPORTANT|NOTE|WARNING|CAUTION)\]\s*\n((?:>\s*.*?\n)+)/gi);
        for (const match of alertMatches) {
            const alertText = match[1].replace(/^>\s*/gm, "").replace(/\*\*/g, "").trim();
            if (alertText.length > 20) {
                // Split into sentences and keep robust ones
                const sentences = alertText.split(/(\. |\n)/).filter(s => s.length > 20);
                decisions.push(...sentences.map(s => s.trim()));
            }
        }

        // Also look for bullet points in text that explain "why" (filtering out file links)
        const bulletPoints = plan.matchAll(/^-\s+(.+?)$/gm);
        for (const match of bulletPoints) {
            const text = match[1].trim();
            // Ignore file links or simple task lists
            if (text.startsWith("[") || text.includes("](file://")) continue;

            const sentences = text.split(/(\. |\n)/).filter(s => s.length > 20);
            for (const sentence of sentences) {
                // Use more flexible matching for decision verbs (decided, choosing, etc.)
                if (sentence.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                    const cleaned = sentence.trim();
                    if (cleaned.length > 20) decisions.push(cleaned);
                }
            }
        }
        // Overview/description section captures the WHY
        const overviewMatch = plan.match(/##\s*(?:Overview|Context|Background)\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (overviewMatch) {
            const overviewText = overviewMatch[1].trim();
            if (overviewText.length > 10) {
                approaches.push(overviewText.split("\n")[0].trim());
            }
        }

        // Proposed changes sections capture decisions - OLD LOGIC DEPRECATED
        // We now rely on Alerts and specific text patterns above
        // const decisionPatterns = plan.match(/####\s*\[.*?\]\s*\[(.+?)\]/gm) || [];
        // for (const d of decisionPatterns.slice(0, 5)) {
        //    const fileName = d.match(/\[([^\]]+)\]\s*$/)?.[1]?.trim();
        //    if (fileName) decisions.push(`Modified: ${fileName}`);
        // }
    }

    // 2. Try metadata.json files for stored summaries
    const metaFiles = ["task.md.metadata.json", "implementation_plan.md.metadata.json"];
    for (const metaFile of metaFiles) {
        const metaPath = path.join(latest.dir, metaFile);
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
                if (meta.Summary && !task) {
                    task = meta.Summary.split("\n")[0].trim();
                }
                if (meta.Summary && meta.Summary.length > 50) {
                    // The metadata summary often contains the full intent
                    approaches.push(meta.Summary.split("\n")[0].trim());
                }
            } catch { }
        }
    }

    // 3. Parse task.md for next steps (already read content above)
    if (!task && taskContent) {
        task = extractTaskFromMarkdown(taskContent);
    }
    const nextSteps = extractIncompleteItems(taskContent);
    const completed = extractCompletedItems(taskContent);

    // 4. Parse walkthrough.md for current state
    let currentState = "";
    const walkthroughFile = path.join(latest.dir, "walkthrough.md");
    if (fs.existsSync(walkthroughFile)) {
        const walkthrough = fs.readFileSync(walkthroughFile, "utf-8");

        // The walkthrough title is often a good summary of what was accomplished
        const walkTitle = walkthrough.match(/^#\s+(.+)$/m);
        if (walkTitle && !currentState) {
            currentState = walkTitle[1].trim();
        }

        // Parse "Changes" or "What Was Built" or "Implementation" sections for Approaches/Decisions
        // These are usually more current than the plan. Support Level 2-4 headers.
        // Priority: Changes > Implementation Details > What Was Built
        let changesMatch = walkthrough.match(/#{2,4}\s*(?:Changes)\s*\n([\s\S]*?)(?=\n#{2,4} |$)/i);
        if (!changesMatch) {
            changesMatch = walkthrough.match(/#{2,4}\s*(?:Implementation Details?|What Was Built)\s*\n([\s\S]*?)(?=\n#{2,4} |$)/i);
        }
        if (changesMatch) {
            const changesText = changesMatch[1].trim();
            const changeLines = changesText.split("\n");

            for (const line of changeLines) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length < 10) continue;

                // If line contains decision keywords, treat as decision
                if (cleaned.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                    // Only add if not already present (avoid dupes from plan)
                    if (!decisions.includes(cleaned)) {
                        decisions.push(cleaned);
                    }
                } else if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
                    // Treat other bullet points as approaches/actions taken
                    if (!approaches.includes(cleaned) && !cleaned.startsWith("[")) {
                        approaches.push(cleaned);
                    }
                }
            }
        }

        // First section gives more detail for current state
        const firstSection = walkthrough.match(/##\s*.*?\n([\s\S]*?)(?=\n##|$)/);
        if (firstSection && !changesMatch) { // Only use first section if we didn't find specific changes
            const detail = firstSection[1].trim().slice(0, 300);
            currentState = currentState ? `${currentState}. ${detail}` : detail;
        } else if (changesMatch) {
            currentState = currentState ? `${currentState}. See approaches for details.` : "See approaches for details.";
        }
    }

    return {
        task: task || "Antigravity session",
        approaches: [
            ...approaches,
            ...completed.slice(0, 5).map((c) => `Done: ${c}`),
        ],
        decisions,
        currentState: currentState || "Loaded from Antigravity brain artifacts",
        nextSteps,
        blockers: [],
        source: "antigravity",
    };
}

// -------------------------------------------------------------------
// Cursor: ~/.cursor/ - Multiple data sources
// -------------------------------------------------------------------
async function extractFromCursor(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const cursorDir = path.join(home, ".cursor");

    if (!fs.existsSync(cursorDir)) return null;

    // Try multiple data sources in priority order

    // 1. Check for .cursor/rules/*.mdc files in the repo (may contain project context)
    const repoRulesDir = path.join(repoPath, ".cursor", "rules");
    if (fs.existsSync(repoRulesDir)) {
        const mdcFiles = fs.readdirSync(repoRulesDir).filter(f => f.endsWith(".mdc") || f.endsWith(".md"));
        for (const file of mdcFiles) {
            if (file === "valyrianctx.mdc") continue; // Skip our own rules
            const content = fs.readFileSync(path.join(repoRulesDir, file), "utf-8");
            const result = parseCursorRuleFile(content);
            if (result && result.task) return result;
        }
    }

    // 2. Check for Cursor's composer history (JSON format in newer versions)
    const composerDir = path.join(cursorDir, "User", "globalStorage", "cursor.composer");
    if (fs.existsSync(composerDir)) {
        const result = await parseCursorComposer(composerDir);
        if (result && result.task) return result;
    }

    // 3. Look for workspace storage JSON files (non-SQLite)
    const workspaceStorage = path.join(cursorDir, "User", "workspaceStorage");
    if (fs.existsSync(workspaceStorage)) {
        const workspaces = fs
            .readdirSync(workspaceStorage)
            .map((d) => {
                const dir = path.join(workspaceStorage, d);
                try {
                    return {
                        name: d,
                        path: dir,
                        mtime: fs.statSync(dir).mtime.getTime(),
                    };
                } catch {
                    return null;
                }
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 5);

        for (const ws of workspaces) {
            // Look for JSON-based state files
            const jsonFiles = ["workspace.json", "chat.json", "conversations.json"];
            for (const jsonFile of jsonFiles) {
                const jsonPath = path.join(ws.path, jsonFile);
                if (fs.existsSync(jsonPath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
                        const result = parseCursorWorkspaceJson(data);
                        if (result && result.task) return result;
                    } catch {
                        // Continue to next file
                    }
                }
            }
        }
    }

    return null;
}

function parseCursorRuleFile(content: string): ExtractedContext | null {
    // Parse Cursor .mdc file format
    // These files have YAML frontmatter and markdown content
    const decisions: string[] = [];
    const approaches: string[] = [];
    let task = "";

    // Extract description from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const descMatch = frontmatterMatch[1].match(/description:\s*(.+)/);
        if (descMatch) {
            task = descMatch[1].trim();
        }
    }

    // Extract bullet points as decisions/approaches
    const bullets = content.matchAll(/^[-*]\s+(.+)$/gm);
    for (const match of bullets) {
        const text = match[1].trim();
        if (text.length > 20) {
            if (text.match(/\b(use|using|prefer|always|never|must|should)\b/i)) {
                decisions.push(text);
            } else {
                approaches.push(text);
            }
        }
    }

    if (!task && decisions.length === 0) return null;

    return {
        task: task || "Cursor project rules",
        approaches: approaches.slice(0, 5),
        decisions: decisions.slice(0, 10),
        currentState: "Loaded from Cursor rule files",
        nextSteps: [],
        blockers: [],
        source: "cursor-rules",
    };
}

async function parseCursorComposer(composerDir: string): Promise<ExtractedContext | null> {
    // Look for conversation files
    const files = fs.readdirSync(composerDir)
        .filter(f => f.endsWith(".json"))
        .map(f => ({
            name: f,
            path: path.join(composerDir, f),
            mtime: fs.statSync(path.join(composerDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return null;

    for (const file of files.slice(0, 3)) {
        try {
            const data = JSON.parse(fs.readFileSync(file.path, "utf-8"));
            if (data.messages || data.conversations || data.history) {
                const messages = data.messages || data.conversations || data.history;
                if (Array.isArray(messages) && messages.length > 0) {
                    return parseConversationMessages(messages, "cursor-composer");
                }
            }
        } catch {
            // Continue
        }
    }

    return null;
}

function parseCursorWorkspaceJson(data: any): ExtractedContext | null {
    // Handle various Cursor JSON formats
    if (data.chat?.messages) {
        return parseConversationMessages(data.chat.messages, "cursor-workspace");
    }
    if (data.conversations) {
        const latest = Array.isArray(data.conversations)
            ? data.conversations[data.conversations.length - 1]
            : data.conversations;
        if (latest?.messages) {
            return parseConversationMessages(latest.messages, "cursor-workspace");
        }
    }
    return null;
}

function parseConversationMessages(messages: any[], source: string): ExtractedContext | null {
    const userMessages: string[] = [];
    const assistantMessages: string[] = [];

    for (const msg of messages) {
        const role = msg.role || msg.type || msg.sender;
        const content = msg.content || msg.text || msg.message || "";
        
        if (typeof content !== "string" || content.length < 5) continue;

        if (role === "user" || role === "human") {
            userMessages.push(content);
        } else if (role === "assistant" || role === "ai" || role === "bot") {
            assistantMessages.push(content);
        }
    }

    if (userMessages.length === 0) return null;

    const task = userMessages[0].split("\n")[0].trim().slice(0, 200);
    const decisions = extractDecisions(assistantMessages);
    const approaches = extractApproaches(assistantMessages);
    const currentState = extractState(assistantMessages);
    const nextSteps = extractNextSteps(assistantMessages);

    return {
        task,
        approaches: [
            ...userMessages.slice(1, 4).map(m => `User also asked: ${m.split("\n")[0].slice(0, 100)}`),
            ...approaches,
        ],
        decisions,
        currentState: currentState || `Loaded from ${source}`,
        nextSteps,
        blockers: [],
        source,
    };
}

// -------------------------------------------------------------------
// OpenCode: ~/.opencode/
// -------------------------------------------------------------------
async function extractFromOpenCode(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    
    // OpenCode stores data in multiple possible locations
    const possibleDirs = [
        path.join(home, ".opencode"),
        path.join(home, ".config", "opencode"),
        path.join(repoPath, ".opencode"),
    ];

    for (const openCodeDir of possibleDirs) {
        if (!fs.existsSync(openCodeDir)) continue;

        // Look for session/conversation files
        const sessionDirs = ["sessions", "conversations", "history"];
        for (const sessionDir of sessionDirs) {
            const sessionsPath = path.join(openCodeDir, sessionDir);
            if (!fs.existsSync(sessionsPath)) continue;

            const files = fs.readdirSync(sessionsPath)
                .filter(f => f.endsWith(".json") || f.endsWith(".jsonl"))
                .map(f => {
                    const filePath = path.join(sessionsPath, f);
                    try {
                        return {
                            name: f,
                            path: filePath,
                            mtime: fs.statSync(filePath).mtime.getTime(),
                        };
                    } catch {
                        return null;
                    }
                })
                .filter((f): f is NonNullable<typeof f> => f !== null)
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length === 0) continue;

            // Parse the most recent file
            const latest = files[0];
            try {
                if (latest.name.endsWith(".jsonl")) {
                    const lines = await readLastLines(latest.path, 100);
                    const messages: any[] = [];
                    for (const line of lines) {
                        try {
                            messages.push(JSON.parse(line));
                        } catch {}
                    }
                    if (messages.length > 0) {
                        return parseConversationMessages(messages, "opencode");
                    }
                } else {
                    const data = JSON.parse(fs.readFileSync(latest.path, "utf-8"));
                    if (data.messages) {
                        return parseConversationMessages(data.messages, "opencode");
                    }
                    if (Array.isArray(data)) {
                        return parseConversationMessages(data, "opencode");
                    }
                }
            } catch {
                // Continue
            }
        }

        // Look for project-specific context
        const contextFile = path.join(openCodeDir, "context.json");
        if (fs.existsSync(contextFile)) {
            try {
                const ctx = JSON.parse(fs.readFileSync(contextFile, "utf-8"));
                if (ctx.task || ctx.goal || ctx.currentTask) {
                    return {
                        task: ctx.task || ctx.goal || ctx.currentTask || "OpenCode session",
                        approaches: ctx.approaches || [],
                        decisions: ctx.decisions || [],
                        currentState: ctx.state || ctx.currentState || "Loaded from OpenCode",
                        nextSteps: ctx.nextSteps || ctx.todos || [],
                        blockers: ctx.blockers || [],
                        source: "opencode-context",
                    };
                }
            } catch {
                // Continue
            }
        }
    }

    return null;
}

// -------------------------------------------------------------------
// Trae: ~/.trae/
// -------------------------------------------------------------------
async function extractFromTrae(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    
    const possibleDirs = [
        path.join(home, ".trae"),
        path.join(home, ".config", "trae"),
        path.join(repoPath, ".trae"),
    ];

    for (const traeDir of possibleDirs) {
        if (!fs.existsSync(traeDir)) continue;

        // Look for conversation/session history
        const historyPaths = [
            path.join(traeDir, "history"),
            path.join(traeDir, "sessions"),
            path.join(traeDir, "conversations"),
            path.join(traeDir, "User", "History"),
        ];

        for (const historyPath of historyPaths) {
            if (!fs.existsSync(historyPath)) continue;

            const files = fs.readdirSync(historyPath)
                .filter(f => f.endsWith(".json") || f.endsWith(".jsonl"))
                .map(f => {
                    const filePath = path.join(historyPath, f);
                    try {
                        return {
                            name: f,
                            path: filePath,
                            mtime: fs.statSync(filePath).mtime.getTime(),
                        };
                    } catch {
                        return null;
                    }
                })
                .filter((f): f is NonNullable<typeof f> => f !== null)
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length === 0) continue;

            const latest = files[0];
            try {
                if (latest.name.endsWith(".jsonl")) {
                    const lines = await readLastLines(latest.path, 100);
                    const messages: any[] = [];
                    for (const line of lines) {
                        try { messages.push(JSON.parse(line)); } catch {}
                    }
                    if (messages.length > 0) {
                        return parseConversationMessages(messages, "trae");
                    }
                } else {
                    const data = JSON.parse(fs.readFileSync(latest.path, "utf-8"));
                    if (data.messages) {
                        return parseConversationMessages(data.messages, "trae");
                    }
                    if (Array.isArray(data)) {
                        return parseConversationMessages(data, "trae");
                    }
                }
            } catch {
                // Continue
            }
        }

        // Check for Trae rules files (similar to Cursor)
        const rulesDir = path.join(traeDir, "rules");
        if (fs.existsSync(rulesDir)) {
            const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith(".md"));
            for (const file of ruleFiles) {
                if (file === "valyrianctx.md") continue;
                const content = fs.readFileSync(path.join(rulesDir, file), "utf-8");
                const result = parseTraeRuleFile(content);
                if (result && result.task) return result;
            }
        }
    }

    return null;
}

function parseTraeRuleFile(content: string): ExtractedContext | null {
    const decisions: string[] = [];
    const approaches: string[] = [];
    let task = "";

    // Extract from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const descMatch = frontmatterMatch[1].match(/description:\s*(.+)/);
        if (descMatch) {
            task = descMatch[1].trim();
        }
    }

    // Extract heading as task if not found
    if (!task) {
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) {
            task = headingMatch[1].trim();
        }
    }

    // Extract bullet points
    const bullets = content.matchAll(/^[-*]\s+(.+)$/gm);
    for (const match of bullets) {
        const text = match[1].trim();
        if (text.length > 15) {
            if (text.match(/\b(use|using|prefer|always|never|must|should|decided|chose)\b/i)) {
                decisions.push(text);
            } else {
                approaches.push(text);
            }
        }
    }

    if (!task && decisions.length === 0) return null;

    return {
        task: task || "Trae project rules",
        approaches: approaches.slice(0, 5),
        decisions: decisions.slice(0, 10),
        currentState: "Loaded from Trae rule files",
        nextSteps: [],
        blockers: [],
        source: "trae-rules",
    };
}

// -------------------------------------------------------------------
// Warp: ~/.warp/
// -------------------------------------------------------------------
async function extractFromWarp(
    _repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const warpDir = path.join(home, ".warp");

    if (!fs.existsSync(warpDir)) return null;

    // Warp AI conversations might be stored in various locations
    const possiblePaths = [
        path.join(warpDir, "ai_conversations"),
        path.join(warpDir, "sessions"),
        path.join(warpDir, "history"),
        path.join(warpDir, "state"),
    ];

    for (const searchPath of possiblePaths) {
        if (!fs.existsSync(searchPath)) continue;

        // Check if it's a file or directory
        const stat = fs.statSync(searchPath);
        
        if (stat.isFile()) {
            const result = await parseWarpFile(searchPath);
            if (result) return result;
        } else if (stat.isDirectory()) {
            const files = fs.readdirSync(searchPath)
                .filter(f => f.endsWith(".json") || f.endsWith(".jsonl") || f.endsWith(".log"))
                .map(f => {
                    const filePath = path.join(searchPath, f);
                    try {
                        return {
                            name: f,
                            path: filePath,
                            mtime: fs.statSync(filePath).mtime.getTime(),
                        };
                    } catch {
                        return null;
                    }
                })
                .filter((f): f is NonNullable<typeof f> => f !== null)
                .sort((a, b) => b.mtime - a.mtime);

            for (const file of files.slice(0, 5)) {
                const result = await parseWarpFile(file.path);
                if (result) return result;
            }
        }
    }

    // Check for Warp's launch config or settings that might contain context
    const launchConfig = path.join(warpDir, "launch_configurations.yaml");
    if (fs.existsSync(launchConfig)) {
        // YAML parsing would require a dependency, so just look for obvious patterns
        const content = fs.readFileSync(launchConfig, "utf-8");
        const taskMatch = content.match(/name:\s*["']?([^"'\n]+)/);
        if (taskMatch) {
            return {
                task: taskMatch[1].trim(),
                approaches: [],
                decisions: [],
                currentState: "Loaded from Warp configuration",
                nextSteps: [],
                blockers: [],
                source: "warp-config",
            };
        }
    }

    return null;
}

async function parseWarpFile(filePath: string): Promise<ExtractedContext | null> {
    try {
        const ext = path.extname(filePath);
        
        if (ext === ".jsonl") {
            const lines = await readLastLines(filePath, 100);
            const messages: any[] = [];
            for (const line of lines) {
                try { messages.push(JSON.parse(line)); } catch {}
            }
            if (messages.length > 0) {
                return parseConversationMessages(messages, "warp");
            }
        } else if (ext === ".json") {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            
            // Handle various Warp JSON formats
            if (data.ai_conversations || data.conversations) {
                const convs = data.ai_conversations || data.conversations;
                const latest = Array.isArray(convs) ? convs[convs.length - 1] : convs;
                if (latest?.messages) {
                    return parseConversationMessages(latest.messages, "warp");
                }
            }
            if (data.messages) {
                return parseConversationMessages(data.messages, "warp");
            }
            if (Array.isArray(data)) {
                return parseConversationMessages(data, "warp");
            }
        } else if (ext === ".log") {
            // Parse log file for AI interactions
            const content = fs.readFileSync(filePath, "utf-8");
            const userPrompts: string[] = [];
            const aiResponses: string[] = [];
            
            // Look for common log patterns
            const promptMatches = content.matchAll(/(?:user|prompt|query):\s*(.+?)(?=\n|$)/gi);
            for (const match of promptMatches) {
                userPrompts.push(match[1].trim());
            }
            
            const responseMatches = content.matchAll(/(?:ai|assistant|response):\s*(.+?)(?=\n|$)/gi);
            for (const match of responseMatches) {
                aiResponses.push(match[1].trim());
            }

            if (userPrompts.length > 0) {
                return {
                    task: userPrompts[0].slice(0, 200),
                    approaches: userPrompts.slice(1, 4).map(p => `Also asked: ${p.slice(0, 100)}`),
                    decisions: extractDecisions(aiResponses),
                    currentState: "Loaded from Warp logs",
                    nextSteps: extractNextSteps(aiResponses),
                    blockers: [],
                    source: "warp-logs",
                };
            }
        }
    } catch {
        // Continue
    }
    
    return null;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

async function readLastLines(
    filePath: string,
    maxLines: number
): Promise<string[]> {
    const lines: string[] = [];
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const buffer: string[] = [];
    for await (const line of rl) {
        buffer.push(line);
        if (buffer.length > maxLines * 2) {
            buffer.splice(0, maxLines); // keep a sliding window
        }
    }

    return buffer.slice(-maxLines);
}

function extractTaskFromMessages(messages: string[]): string {
    // First user message is usually the task
    const first = messages[0] || "";

    // If it starts with "Implement", "Build", "Fix", etc., use first line
    const firstLine = first.split("\n")[0].trim();
    if (firstLine.length > 10 && firstLine.length < 300) {
        return firstLine;
    }

    // Try to find a task-like sentence
    for (const msg of messages) {
        const match = msg.match(
            /(?:implement|build|fix|create|add|refactor|debug|optimize|update|migrate)\s+(.+?)(?:\.|$)/i
        );
        if (match) return match[0].trim().slice(0, 200);
    }

    return first.slice(0, 200);
}

function extractDecisions(messages: string[]): string[] {
    const decisions: string[] = [];
    const patterns = [
        /(?:decided|choosing|using|going with|switched to|picked)\s+(.+?)(?:\.|$)/gi,
        /(?:decision|chose|selected|opted for)\s*:?\s*(.+?)(?:\.|$)/gi,
    ];

    for (const msg of messages.slice(-10)) {
        const sentences = msg.split(/[.!?]\s+/);
        for (const sentence of sentences) {
            // Use more flexible matching for decision verbs (decided, choosing, etc.)
            if (sentence.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                const cleaned = sentence.trim();
                // Avoid very short fragments
                if (cleaned.length > 20 && cleaned.length < 300 && !decisions.includes(cleaned)) {
                    decisions.push(cleaned);
                }
            }
        }
    }

    return decisions.slice(0, 10);
}

function extractApproaches(messages: string[]): string[] {
    const approaches: string[] = [];
    const patterns = [
        /(?:tried|approach|attempted|tested|experimented with)\s+(.+?)(?:\.|$)/gi,
        /(?:first|then|alternatively|instead)\s*,?\s*(?:I|we|let's)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const msg of messages.slice(-10)) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(msg)) !== null) {
                const a = match[0].trim();
                if (a.length > 10 && a.length < 200 && !approaches.includes(a)) {
                    approaches.push(a);
                }
            }
        }
    }

    return approaches.slice(0, 8);
}

function extractState(messages: string[]): string {
    // Look at last assistant message for state
    const last = messages[messages.length - 1] || "";

    // Look for state indicators
    const stateMatch = last.match(
        /(?:currently|now|at this point|so far|status:?)\s*(.+?)(?:\.|$)/i
    );
    if (stateMatch) return stateMatch[0].trim().slice(0, 300);

    // Use last meaningful line
    const lines = last.split("\n").filter((l) => l.trim().length > 20);
    return lines[lines.length - 1]?.trim()?.slice(0, 300) || "";
}

function extractNextSteps(messages: string[]): string[] {
    const steps: string[] = [];

    for (const msg of messages.slice(-5)) {
        const nextMatch = msg.match(
            /(?:next steps?|todo|remaining|still need to|should also)\s*:?\s*\n?((?:\s*[-*\d.]+\s*.+\n?)+)/i
        );
        if (nextMatch) {
            const items = nextMatch[1]
                .split("\n")
                .map((l) => l.replace(/^[\s\-*\d.]+/, "").trim())
                .filter((l) => l.length > 5);
            steps.push(...items);
        }
    }

    return [...new Set(steps)].slice(0, 8);
}

function extractTaskFromMarkdown(content: string): string {
    // Get title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch?.[1]?.trim() || "";
}

function extractIncompleteItems(content: string): string[] {
    const items: string[] = [];
    const matches = content.matchAll(/-\s+\[\s\]\s+(.+)$/gm);
    for (const m of matches) {
        items.push(m[1].trim());
    }
    return items.slice(0, 8);
}

function extractCompletedItems(content: string): string[] {
    const items: string[] = [];
    const matches = content.matchAll(/-\s+\[x\]\s+(.+)$/gm);
    for (const m of matches) {
        items.push(m[1].trim());
    }
    return items.slice(0, 8);
}
