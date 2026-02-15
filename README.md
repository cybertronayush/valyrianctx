# ValyrianCtx

> *"The Citadel (Git) tracks the history of the realm. ValyrianCtx tracks the memory of your intent."*

**The immortal memory forge for AI-assisted coding.** Like Valyrian steel, once forged -- it never dulls, never breaks, and never forgets.

---

## The Long Night of Lost Context

You've been deep in a Cursor session, refactoring the payment service -- the Dragon Queen's treasury system. You've explained the architecture to your AI, tried three approaches, found the one true path. Then the session dies. The Long Night falls. Next morning -- or worse, your bannerman picks up the branch -- and the AI remembers **nothing**. You spend 15 minutes re-explaining everything. Every. Single. Time.

This plague spreads across **every** AI tool in the Seven Kingdoms: Cursor, Claude Code, Antigravity, OpenCode, Trae, Warp -- none of them carry memory across sessions, across forges, or across houses.

**The realm needed Valyrian steel. We forged it.**

## What Is ValyrianCtx?

**ValyrianCtx** is a CLI weapon that automatically captures and restores AI coding context -- scoped to your repo and branch, persisted like words carved into weirwood.

```bash
# Forge context after a session
valyrianctx save "Refactoring the Iron Bank's ledger to event sourcing"

# Summon it back in any forge, on any machine
valyrianctx resume
```

Your AI wakes up knowing everything. The Night King loses.

---

## Bend the Knee (Install)

```bash
npm install -g valyrianctx
```

## The First Forging (Quick Start)

```bash
# 1. Plant the weirwood in your repo
valyrianctx init
# -> Sets up .valyrianctx/ directory
# -> Generates rule files for all 6 IDEs (Claude Code, Cursor, Antigravity, OpenCode, Trae, Warp)
# -> Configures MCP servers for compatible IDEs

# 2. Code your battles... then forge the memory
valyrianctx save
# -> Interactive prompts capture: Task, Approaches, Decisions, Next Steps

# 3. Summon memory in ANY forge
valyrianctx resume
# -> Copies a perfectly forged prompt to your clipboard
# -> Paste into Cursor, Claude, ChatGPT -- your dragon remembers everything

# Your AI agent now auto-saves and resumes context -- no manual prompting needed
```

---

## The Arsenal -- Commands & Powers

### The Armory (Core -- No Dragon Glass Required)
**These commands work locally with zero dependencies. No API keys. No ravens. Just steel.**

| Command | Power |
|---------|-------|
| `valyrianctx init` | Plant the weirwood tree in your repository |
| `valyrianctx save [msg]` | Forge context into Valyrian steel (interactive or quick) |
| `valyrianctx save --auto` | Auto-forge from editor session scrolls (non-interactive) |
| `valyrianctx resume` | Summon full memory & copy to clipboard |
| `valyrianctx log` | Read the chronicle of past sessions |
| `valyrianctx diff` | Reveal what changed since the last forging |

### The Small Council (Team & Automation -- No Dragon Glass Required)

| Command | Power |
|---------|-------|
| `valyrianctx handoff @user` | Send a raven with full battle context to a bannerman |
| `valyrianctx share` | Commit `.valyrianctx/` to git -- share the memory across the realm |
| `valyrianctx watch` | The Night's Watch -- auto-forge context when files change |
| `valyrianctx hook install` | Plant wildfire traps -- auto-capture on every git commit |

### Dragon Magic (AI-Powered -- Experimental)
**Requires a dragon (LLM Provider).** Bind one via `VALYRIANCTX_AI_KEY` env var or `valyrianctx config set aiApiKey <key>`. Defaults to OpenAI-compatible endpoints. Works with OpenAI, Ollama, LM Studio, Together.ai, and any OpenAI-compatible API.

| Command | Power |
|---------|-------|
| `valyrianctx summarize` | The Three-Eyed Raven sees your git diff + commits and generates context |
| `valyrianctx suggest` | The Hand of the King advises your next strategic moves |
| `valyrianctx compress` | Maester's art -- distill volumes of history into a single potent scroll |

### The Forge Master (IDE Integration)

| Command | Power |
|---------|-------|
| `valyrianctx rules generate` | Generate rule files for all supported IDEs |
| `valyrianctx rules generate --ide cursor,claude-code` | Generate for specific IDEs only |
| `valyrianctx rules remove` | Remove all ValyrianCtx rule files and sections |
| `valyrianctx rules list` | Show which IDEs are configured and their MCP status |

### The Maester's Desk (Configuration)

| Command | Power |
|---------|-------|
| `valyrianctx config set <key> <val>` | Set realm preferences (`aiProvider`, `watchInterval`, etc.) |
| `valyrianctx config list` | Survey all configuration across the realm |

---

## How the Forging Works

ValyrianCtx stores a `.valyrianctx/` directory in your repo -- your project's weirwood tree. Each entry is a memory carved into the bark:

| Memory Facet | What It Captures |
|---|---|
| **Task** | What quest you are on |
| **Goal** | Why the quest matters |
| **Approaches** | What strategies you tried (and which ones fell in battle) |
| **Decisions** | Key architectural oaths sworn |
| **State** | Where you sheathed your sword -- exactly where you left off |
| **Next Steps** | The battle plan for whoever picks up the blade next |
| **Blockers** | The enemies at the gate |
| **Files Changed** | The territories affected |
| **Recent Commits** | The recent history of the realm |
| **Handoff Note** | Raven scroll for your bannerman |

It works with **every** AI coding tool because it manages the *prompt* -- the universal tongue that all dragons understand.

---

## Alliances & Integrations

ValyrianCtx supports **6 AI coding IDEs** out of the box. When you run `valyrianctx init`, it automatically generates the correct rule files, MCP configurations, and integration hooks for every supported tool.

```
valyrianctx init
# -> Creates .valyrianctx/ directory
# -> Generates IDE rules for: Claude Code, Cursor, Antigravity, OpenCode, Trae, Warp
# -> Configures MCP servers for IDEs that support it
```

| IDE | Agent Rules | MCP | Auto-Extract | Status |
|---|---|---|---|---|
| **Claude Code** | `CLAUDE.md` | `.claude/settings.local.json` | Session JSONL + memory | Full support |
| **Cursor** | `.cursor/rules/valyrianctx.mdc` | `.cursor/mcp.json` | Composer + workspace JSON | Full support |
| **Antigravity (Gemini)** | `GEMINI.md` | -- | task.md, plans, walkthroughs | Full support |
| **OpenCode** | `AGENTS.md` | Via config | Session JSON/JSONL | Full support |
| **Trae** | `.trae/rules/valyrianctx.md` | Emerging | Session history + rules | Full support |
| **Warp** | `.warp/valyrianctx.md` | -- | AI conversation logs | Best-effort |

**Team-shared files** (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`) are committed to git so every team member benefits.
**IDE-local files** (`.cursor/`, `.trae/`, `.warp/`, MCP configs) are gitignored -- each developer generates their own via `init`.

---

### Claude Code

`valyrianctx init` creates two things:

1. **`CLAUDE.md`** at project root -- Claude Code reads this automatically and learns to save/resume context.
2. **`.claude/settings.local.json`** -- Registers the MCP server so Claude Code can call `valyrianctx_save` and `valyrianctx_resume` natively.

You can also use slash commands in Claude Code:
```
/resume-context    # Load saved context and continue where you left off
/save-context      # Extract and save context from the current conversation
```

Or use the MCP tools directly -- Claude Code will call them when it knows about valyrianctx through the CLAUDE.md rules.

**Manual MCP setup** (if you skipped `init`):
```json
// .claude/settings.local.json
{
  "mcpServers": {
    "valyrianctx": {
      "command": "valyrianctx-mcp"
    }
  }
}
```

---

### Cursor

`valyrianctx init` creates:

1. **`.cursor/rules/valyrianctx.mdc`** -- Cursor loads all `.mdc` files from this directory as agent rules.
2. **`.cursor/mcp.json`** -- Registers the MCP server for native tool calls.

The rule file is set to `alwaysApply: true`, so Cursor's AI agent will automatically save and resume context without any manual prompting.

**Manual MCP setup:**
```json
// .cursor/mcp.json
{
  "mcpServers": {
    "valyrianctx": {
      "command": "npx",
      "args": ["valyrianctx-mcp"]
    }
  }
}
```

---

### Antigravity (Gemini CLI)

`valyrianctx init` creates **`GEMINI.md`** at project root. Gemini CLI reads this file automatically.

Antigravity does not support MCP, so the integration works entirely through CLI commands. The rules instruct Gemini to:
- Run `valyrianctx resume --stdout` at session start
- Run `valyrianctx save` with structured flags before finishing

ValyrianCtx also has **deep auto-extraction** for Antigravity -- it reads your `task.md`, `implementation_plan.md`, and `walkthrough.md` artifacts directly from `~/.gemini/antigravity/brain/`.

---

### OpenCode

`valyrianctx init` creates **`AGENTS.md`** at project root. OpenCode reads this for project-level agent instructions.

OpenCode supports MCP servers -- configure it in your OpenCode settings to enable native `valyrianctx_save` and `valyrianctx_resume` tool calls.

---

### Trae

`valyrianctx init` creates **`.trae/rules/valyrianctx.md`**. Trae loads rule files from this directory.

Trae's MCP support is emerging. The rules instruct Trae to use CLI commands as the primary integration path, with MCP as an optional enhancement when available.

---

### Warp

`valyrianctx init` creates **`.warp/valyrianctx.md`** as a best-effort integration. Warp does not have a formal project-level rule loading mechanism, so this file serves as documentation.

For Warp, the recommended workflow is:
```bash
# At the start of a session
valyrianctx resume

# Before ending a session
valyrianctx save --auto
```

---

### The Iron Throne Protocol (MCP Server)

ValyrianCtx exposes a **Model Context Protocol** server so AI agents can natively read and write context -- no clipboard needed.

**Exposed tools:** `valyrianctx_save`, `valyrianctx_resume`, `valyrianctx_log`
**Exposed resource:** `valyrianctx://context`

The MCP server is auto-configured for compatible IDEs during `valyrianctx init`. To configure it manually for any MCP-compatible client:

```json
{
  "mcpServers": {
    "valyrianctx": {
      "command": "valyrianctx-mcp"
    }
  }
}
```

### The Maester's Lens (VS Code Extension)
Auto-resumes context when you open the project -- like walking through the gates and having your steward brief you instantly. Works with VS Code and VS Code-based editors (Cursor, potentially Trae).

*Build from source:* `cd vscode-extension && npm install && npm run package`

---

## Auto-Extraction -- The Greensight

ValyrianCtx doesn't just store what you tell it. With `--auto` mode and `watch`, it has **greensight** -- it can read the session memories of your AI editors:

| Source | What It Reads |
|---|---|
| **Claude Code** | `~/.claude/projects/` -- parses JSONL sessions and MEMORY.md files |
| **Antigravity (Gemini)** | `~/.gemini/antigravity/brain/` -- reads task.md, implementation plans, walkthroughs |
| **Cursor** | `~/.cursor/` -- composer history, workspace JSON, and rule files |
| **OpenCode** | `~/.opencode/` -- session JSON/JSONL files and project context |
| **Trae** | `~/.trae/` -- session history and rule files |
| **Warp** | `~/.warp/` -- AI conversation logs and session data |

The extractors try each source in priority order and return the first successful match. Each extractor pulls out: **task**, **approaches** (including failed ones), **decisions**, **current state**, and **next steps**.

```bash
# Let the Three-Eyed Raven extract context from your last editor session
valyrianctx save --auto

# Or let the Night's Watch do it continuously
valyrianctx watch --interval 5
```

---

## The Raven Network -- Team Handoffs

Context doesn't die when a bannerman falls. It gets passed on.

```bash
# Hand off your battle context to Ser Brienne
valyrianctx handoff @brienne "Treasury refactor is 80% done. 
The event sourcing approach works. Don't touch the legacy adapter."

# Brienne picks it up from anywhere
valyrianctx resume

# Share the weirwood tree with the entire realm via git
valyrianctx share
```

When you run `handoff`, ValyrianCtx captures everything -- the task, state, files changed, recent commits, and your personal raven scroll -- then tags it for the recipient. When they `resume`, they get the full war table briefing.

---

## The Night's Watch -- Auto-Capture

Set it and forget it. The watchers on the wall guard your context while you code.

```bash
# Start the Watch (auto-saves every 5 minutes when changes detected)
valyrianctx watch

# Custom patrol interval
valyrianctx watch --interval 10

# Or plant wildfire in git hooks -- auto-save on every commit
valyrianctx hook install
```

The watch mode uses `chokidar` for efficient file system monitoring, ignores noise (node_modules, dist, dotfiles), and enriches auto-captures with editor session data when available.

---

## Dragon Magic -- AI-Powered Commands

When you bind a dragon (LLM), ValyrianCtx unlocks three ancient powers:

### `valyrianctx summarize` -- The Three-Eyed Raven
Analyzes your git diff, staged files, and recent commits, then generates a full context entry automatically. No interactive prompts. The Raven sees all.

### `valyrianctx suggest` -- The Hand of the King
Reads your current context, recent changes, and known blockers, then provides 3-5 specific, actionable next steps with reasoning. Your own personal Tyrion.

### `valyrianctx compress` -- The Maester's Art
When your branch accumulates too many context entries (the scrolls pile up), compress them into a single potent summary. Keeps the latest entry intact, distills everything else into concentrated wisdom.

```bash
# Set your dragon
export VALYRIANCTX_AI_KEY=sk-...

# Or configure permanently
valyrianctx config set aiApiKey sk-...
valyrianctx config set aiProvider https://api.openai.com/v1
valyrianctx config set aiModel gpt-4o-mini
```

---

## Architecture of the Forge

```
.valyrianctx/
  config.json          # Realm configuration
  sessions/            # Every forging, timestamped
    2025-01-15T10-30.json
    2025-01-15T14-22.json
  branches/            # Latest context per branch (the active war table)
    main.json
    feature__payments.json
```

Each context entry is a JSON document containing: task, goal, approaches, decisions, currentState, nextSteps, blockers, filesChanged, filesStaged, recentCommits, author, timestamp, branch, and optional handoff metadata.

The `resume` command reads the branch context, formats it into a structured markdown prompt, and copies it to your clipboard. Paste it into any AI tool. The dragon remembers everything.

---

## Configuration Reference

| Key | Default | Description |
|---|---|---|
| `defaultOutput` | `"clipboard"` | Resume output: `"clipboard"` or `"stdout"` |
| `autoGitCapture` | `true` | Auto-include git metadata in saves |
| `recentCommitCount` | `5` | Number of recent commits to capture |
| `defaultLogCount` | `10` | Default entries shown by `log` |
| `watchInterval` | `5` | Auto-save interval in minutes (watch mode) |
| `autoHook` | `false` | Auto-install git hook on `init` |
| `aiProvider` | `"https://api.openai.com/v1"` | LLM API base URL (OpenAI-compatible) |
| `aiModel` | `"gpt-4o-mini"` | Model name for AI commands |
| `aiApiKey` | -- | API key (prefer `VALYRIANCTX_AI_KEY` env var) |

---

## The Philosophy

Every AI coding tool -- Cursor, Claude Code, Antigravity, OpenCode, Trae, Warp -- they are all dragons. Powerful. Brilliant. But they have the memory of a goldfish. They forget everything between sessions.

**ValyrianCtx is not another AI tool.** It is the memory layer that sits beneath all of them. It manages the one thing every LLM understands: **the prompt**. That's the universal interface. That's the common tongue.

Git tracks your **code** history. ValyrianCtx tracks your **intent** history.

> *"When you play the game of code, you win or your context dies. There is no middle ground."*

---

## Contributing

The realm is open. Pull requests, issues, and raven scrolls are welcome.

```bash
# Clone the forge
git clone https://github.com/valyrianctx/valyrianctx.git

# Enter the smithy
cd valyrianctx

# Forge the dependencies
npm install

# Light the furnace
npm run dev

# Test the steel
npm test
```

---

## License

MIT -- Free as the wind across the Narrow Sea.

---

<p align="center">
<i>"The things I do for context."</i><br>
<b>-- Jaime Lannister, probably, after losing a session</b>
</p>
