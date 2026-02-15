#!/usr/bin/env node
/**
 * Valyrian Context MCP Server
 *
 * Exposes Valyrian Context functionality as MCP tools and resources
 * for Claude Code and other MCP-compatible clients.
 *
 * KEY FEATURE: Auto-resume on first tool call.
 * When the MCP client (IDE) connects and makes its first tool call,
 * the server automatically prepends the resumed context to the response.
 * This means the AI gets previous session context without needing to
 * explicitly call resume — it happens transparently.
 *
 * Usage:
 *   valyrianctx-mcp                    # stdio transport (default)
 *
 * Configure in Claude Code's MCP settings:
 *   {
 *     "mcpServers": {
 *       "valyrianctx": {
 *         "command": "valyrianctx-mcp"
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isInitialized, loadBranchContext, loadAllSessions, saveContext } from "./core/context";
import { getCurrentBranch, getRepoName, getRepoRoot, getChangedFiles, getStagedFiles, getRecentCommits, getAuthor } from "./core/git";
import { generatePrompt } from "./core/prompt";
import { injectContextIntoRules } from "./core/agent-rules";
import { ContextEntry } from "./core/types";
import { v4 as uuid } from "uuid";

const server = new McpServer({
    name: "valyrianctx",
    version: "0.5.0",
});

// ---------------------------------------------------------------------------
// Session State — Auto-Resume Engine
// ---------------------------------------------------------------------------
// 
// The MCP server runs as a child process of the IDE. Each new session starts
// a fresh process. We track whether we've already sent the auto-resume context
// so we only prepend it to the FIRST tool call response.

let sessionResumed = false;
let toolCallCount = 0;
let lastToolCallTime = 0;
let explicitSaveMade = false;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds

/** Track tool activity for idle detection */
function recordToolCall() {
    toolCallCount++;
    lastToolCallTime = Date.now();
}

/**
 * Get auto-resume context prefix for the first tool call of a session.
 * Returns formatted context on first call, empty string on subsequent calls.
 * If the tool being called IS the resume tool, returns empty (no double-up).
 */
async function getAutoResumePrefix(isResumeCall: boolean): Promise<string> {
    if (sessionResumed || isResumeCall) {
        sessionResumed = true;
        return "";
    }
    sessionResumed = true;

    try {
        if (!(await isInitialized())) return "";
        const branch = await getCurrentBranch();
        const entries = await loadBranchContext(branch);
        if (entries.length === 0) return "";

        const prompt = generatePrompt(entries);
        return [
            "═══ Auto-Resumed Context from Previous Session ═══",
            "",
            prompt,
            "",
            "═══ End of Auto-Resumed Context ═══",
            "",
            "---",
            "",
        ].join("\n");
    } catch {
        return "";
    }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

interface ResumeArgs {
    branch?: string;
}

const resumeSchema = {
    branch: z.string().optional().describe("Branch name to resume. Defaults to current branch."),
};

server.tool(
    "valyrianctx_resume",
    "Generate AI-ready context prompt for the current or specified branch",
    resumeSchema as any,
    async ({ branch }: ResumeArgs) => {
        recordToolCall();
        // Mark session as resumed (this IS the resume call)
        sessionResumed = true;

        if (!(await isInitialized())) {
            return { content: [{ type: "text" as const, text: "Valyrian Context not initialized. Run `valyrianctx init` first." }] };
        }

        const targetBranch = branch || (await getCurrentBranch());
        const entries = await loadBranchContext(targetBranch);

        if (entries.length === 0) {
            return {
                content: [{ type: "text" as const, text: `No context found for branch: ${targetBranch}. Run \`valyrianctx save\` first.` }],
            };
        }

        const prompt = generatePrompt(entries);
        return { content: [{ type: "text" as const, text: prompt }] };
    }
);

interface SaveArgs {
    message: string;
    goal?: string;
    approaches?: string[];
    decisions?: string[];
    currentState?: string;
    nextSteps?: string[];
}

const saveSchema = {
    message: z.string().describe("Description of what you were working on"),
    goal: z.string().optional().describe("Goal or ticket reference"),
    approaches: z.array(z.string()).optional().describe("Approaches tried"),
    decisions: z.array(z.string()).optional().describe("Key decisions made"),
    currentState: z.string().optional().describe("Current state of the work"),
    nextSteps: z.array(z.string()).optional().describe("Next steps"),
};

server.tool(
    "valyrianctx_save",
    "Save current coding context with a message",
    saveSchema as any,
    async ({ message, goal, approaches, decisions, currentState, nextSteps }: SaveArgs) => {
        recordToolCall();
        explicitSaveMade = true;
        // Auto-resume prefix for first tool call
        const prefix = await getAutoResumePrefix(false);

        if (!(await isInitialized())) {
            return { content: [{ type: "text" as const, text: prefix + "Valyrian Context not initialized. Run `valyrianctx init` first." }] };
        }

        const [branch, repo, filesChanged, filesStaged, recentCommits, author] = await Promise.all([
            getCurrentBranch(),
            getRepoName(),
            getChangedFiles(),
            getStagedFiles(),
            getRecentCommits(),
            getAuthor(),
        ]);

        const entry: ContextEntry = {
            id: uuid(),
            timestamp: new Date().toISOString(),
            branch,
            repo,
            author,
            task: message,
            goal,
            approaches: approaches || [],
            decisions: decisions || [],
            currentState: currentState || message,
            nextSteps: nextSteps || [],
            filesChanged,
            filesStaged,
            recentCommits,
        };

        await saveContext(entry);

        // Auto-inject context into IDE rule files for next session's auto-resume
        try {
            const root = await getRepoRoot();
            const entries = await loadBranchContext(branch);
            const prompt = generatePrompt(entries);
            await injectContextIntoRules(root, prompt);
        } catch {
            // Non-fatal
        }

        const result = `Context saved for branch: ${branch}\n${filesChanged.length} files changed, ${recentCommits.length} recent commits captured.`;
        return {
            content: [{ type: "text" as const, text: prefix + result }],
        };
    }
);

interface LogArgs {
    all?: boolean;
    count?: number;
}

const logSchema = {
    all: z.boolean().optional().describe("Show all branches"),
    count: z.number().optional().describe("Number of entries to show"),
};

server.tool(
    "valyrianctx_log",
    "View context history for the current branch or all branches",
    logSchema as any,
    async ({ all, count }: LogArgs) => {
        // Auto-resume prefix for first tool call
        const prefix = await getAutoResumePrefix(false);

        if (!(await isInitialized())) {
            return { content: [{ type: "text" as const, text: prefix + "Valyrian Context not initialized." }] };
        }

        const limit = count || 10;

        if (all) {
            const sessions = await loadAllSessions();
            if (sessions.length === 0) {
                return { content: [{ type: "text" as const, text: prefix + "No context entries found." }] };
            }

            const lines = sessions.slice(0, limit).map((s) => {
                const date = new Date(s.timestamp).toLocaleString();
                return `[${date}] ${s.branch} — ${s.task}`;
            });

            return { content: [{ type: "text" as const, text: prefix + `All branches:\n\n${lines.join("\n")}` }] };
        }

        const branch = await getCurrentBranch();
        const entries = await loadBranchContext(branch);

        if (entries.length === 0) {
            return { content: [{ type: "text" as const, text: prefix + `No context for branch: ${branch}` }] };
        }

        const lines = entries
            .slice(-limit)
            .reverse()
            .map((e) => {
                const date = new Date(e.timestamp).toLocaleString();
                return `[${date}] ${e.task}${e.currentState ? `\n  └─ ${e.currentState}` : ""}`;
            });

        return {
            content: [{ type: "text" as const, text: prefix + `Branch: ${branch}\n\n${lines.join("\n")}` }],
        };
    }
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.resource(
    "context",
    "valyrianctx://context",
    async (uri) => {
        if (!(await isInitialized())) {
            return { contents: [{ uri: uri.href, text: "Valyrian Context not initialized.", mimeType: "text/plain" }] };
        }

        const branch = await getCurrentBranch();
        const entries = await loadBranchContext(branch);

        if (entries.length === 0) {
            return { contents: [{ uri: uri.href, text: "No context found.", mimeType: "text/plain" }] };
        }

        const prompt = generatePrompt(entries);
        return { contents: [{ uri: uri.href, text: prompt, mimeType: "text/markdown" }] };
    }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error("MCP server error:", err);
    process.exit(1);
});
