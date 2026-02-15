# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-01-15

### Added
- Multi-IDE support: Claude Code, Cursor, Antigravity, OpenCode, Trae, Warp
- `valyrianctx rules` command for managing IDE integration files
- Automatic IDE rule generation during `valyrianctx init`
- MCP auto-configuration for Claude Code and Cursor
- Parser extractors for OpenCode, Trae, and Warp
- VS Code extension with auto-resume and status bar
- `valyrianctx config` command for managing settings

### Changed
- `valyrianctx init` now generates IDE rule files for all 6 supported IDEs
- Cursor parser rewritten to use composer history and workspace JSON (replaces dead SQLite stub)
- Re-running `init` now detects missing IDE rules and regenerates them

### Fixed
- Naming inconsistency: all references to `devctx` updated to `valyrianctx`

## [0.4.0] - 2025-01-10

### Added
- `valyrianctx summarize` — AI-generated context from git diff + commits
- `valyrianctx suggest` — AI-powered next step suggestions
- `valyrianctx compress` — AI-powered context compression
- OpenAI-compatible AI client supporting any provider

## [0.3.0] - 2025-01-05

### Added
- `valyrianctx watch` — file system watcher with auto-save
- `valyrianctx hook` — git post-commit hook management
- Auto-extraction from Claude Code and Antigravity sessions

## [0.2.0] - 2025-01-01

### Added
- `valyrianctx handoff` — team context handoffs with assignee
- `valyrianctx share` — share `.valyrianctx/` via git

## [0.1.0] - 2024-12-28

### Added
- Initial release
- `valyrianctx init` — initialize context tracking in a repo
- `valyrianctx save` — save coding context (interactive, message, structured)
- `valyrianctx resume` — generate context prompt and copy to clipboard
- `valyrianctx log` — view context history
- `valyrianctx diff` — show changes since last save
- Branch-scoped context storage
- Git metadata auto-capture (files changed, staged, recent commits)
