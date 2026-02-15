# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.5.x   | Yes                |
| < 0.5   | No                 |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in ValyrianCtx, please report it responsibly:

1. **Email:** Send details to the maintainer via GitHub private vulnerability reporting, or open a [Security Advisory](https://github.com/cybertronayush/valyrianctx/security/advisories/new).
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if any)

We will acknowledge receipt within **48 hours** and aim to release a patch within **7 days** for critical issues.

## Scope

The following areas are in scope for security reports:

- **API key handling:** ValyrianCtx stores and reads `aiApiKey` from config files and environment variables (`VALYRIANCTX_AI_KEY`). Any exposure of these values is a critical issue.
- **File system access:** The parser reads files from user home directories (`~/.claude/`, `~/.cursor/`, `~/.gemini/`, etc.). Path traversal or unintended file access is in scope.
- **MCP server:** The stdio-based MCP server accepts commands. Any injection or privilege escalation is in scope.
- **Dependency vulnerabilities:** Issues in direct dependencies that affect ValyrianCtx users.

## Out of Scope

- Issues in the user's AI editor or IDE
- Social engineering attacks
- Denial of service against the local CLI

## Best Practices for Users

- **Never commit API keys.** Use `VALYRIANCTX_AI_KEY` environment variable instead of `valyrianctx config set aiApiKey`.
- **Keep `.valyrianctx/` in `.gitignore`** unless you explicitly run `valyrianctx share` and have verified no secrets are in context entries.
- **Review context entries** before sharing via `valyrianctx share` — they may contain file paths, commit messages, or decision details you consider sensitive.
