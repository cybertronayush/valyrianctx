<!-- valyrianctx:start -->
## MANDATORY: Valyrian Context Integration

This project uses `valyrianctx` to persist coding context across sessions.
You MUST follow these rules. They are not optional.

### RULE 1: Resume context FIRST (mandatory)

**Your FIRST action in EVERY conversation — before doing anything else — MUST be:**

```bash
valyrianctx resume --stdout
```

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
```bash
valyrianctx save "TASK_SUMMARY" \
  --approaches "approach 1;; approach 2" \
  --decisions "decision 1;; decision 2" \
  --state "Current state description" \
  --next-steps "step 1;; step 2" \
  --blockers "blocker 1"
```

3. Confirm to the user what was saved.

**Do NOT ask the user to summarize. Extract it yourself from the conversation.**
**Do NOT skip this. Context that is not saved is context that dies.**

### RULE 3: Respond to explicit commands

- When the user says `/save-context` or "save context": execute Rule 2 immediately.
- When the user says `/resume-context` or "resume context": execute Rule 1 immediately.

### Quality standards for saved context

- **Be specific**: "Using RS256 for JWT signing with 24h expiry" not "configured auth"
- **Include failures**: "Tried approach X, failed because Y" is extremely valuable
- **Capture reasoning**: "Chose Postgres over MongoDB because we need cross-table transactions"

### OpenCode: MCP Integration (preferred over CLI)
If the valyrianctx MCP server is configured, use MCP tools instead of CLI commands for Rule 1 and Rule 2.
<!-- valyrianctx:end -->
