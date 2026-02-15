import fs from "fs";
import path from "path";
import os from "os";
import {
    writeIDERules,
    removeIDERules,
    listIDERules,
    getAllIDERules,
} from "./agent-rules";

// Create a temporary directory for tests
const TEST_DIR = path.join(os.tmpdir(), `valyrianctx-test-${Date.now()}`);

beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    // Create a minimal .git directory to simulate a repo
    fs.mkdirSync(path.join(TEST_DIR, ".git"), { recursive: true });
});

afterAll(() => {
    // Clean up
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

beforeEach(() => {
    // Clean up any generated files before each test
    const filesToClean = [
        "CLAUDE.md",
        "GEMINI.md",
        "AGENTS.md",
        ".cursor",
        ".trae",
        ".warp",
        ".claude",
        ".gemini",
        ".gitignore",
    ];
    for (const file of filesToClean) {
        const fullPath = path.join(TEST_DIR, file);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    }
});

describe("Agent Rules Generator", () => {
    describe("getAllIDERules", () => {
        it("should return configurations for all 7 IDE rule targets", () => {
            const rules = getAllIDERules();
            expect(rules.length).toBe(7);
            
            const ids = rules.map(r => r.id);
            expect(ids).toContain("claude-code");
            expect(ids).toContain("cursor");
            expect(ids).toContain("antigravity");
            expect(ids).toContain("antigravity-dir");
            expect(ids).toContain("opencode");
            expect(ids).toContain("trae");
            expect(ids).toContain("warp");
        });

        it("should have valid content generators for all rules", () => {
            const rules = getAllIDERules();
            for (const rule of rules) {
                const content = rule.generateContent();
                expect(content).toBeTruthy();
                expect(content.length).toBeGreaterThan(100);
                // All rules should mention valyrianctx
                expect(content).toContain("valyrianctx");
            }
        });
    });

    describe("writeIDERules", () => {
        it("should create all rule files when generating for all IDEs", async () => {
            const written = await writeIDERules(TEST_DIR, { includeMcp: false });
            
            // Should have created files for all 7 rule targets
            expect(written.length).toBeGreaterThanOrEqual(7);

            // Check that key files exist
            expect(fs.existsSync(path.join(TEST_DIR, "CLAUDE.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".gemini", "valyrianctx.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, "GEMINI.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, "AGENTS.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".cursor", "rules", "valyrianctx.mdc"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".trae", "rules", "valyrianctx.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".warp", "valyrianctx.md"))).toBe(true);
        });

        it("should generate for specific IDEs only when --ide is provided", async () => {
            const written = await writeIDERules(TEST_DIR, { 
                ides: ["claude-code", "cursor"],
                includeMcp: false 
            });

            // Should only have 2 entries
            expect(written.length).toBe(2);
            
            // Claude and Cursor files should exist
            expect(fs.existsSync(path.join(TEST_DIR, "CLAUDE.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".cursor", "rules", "valyrianctx.mdc"))).toBe(true);
            
            // Others should not
            expect(fs.existsSync(path.join(TEST_DIR, "GEMINI.md"))).toBe(false);
            expect(fs.existsSync(path.join(TEST_DIR, "AGENTS.md"))).toBe(false);
        });

        it("should append to existing CLAUDE.md without destroying content", async () => {
            // Create existing CLAUDE.md with user content
            const existingContent = "# My Project\n\nThis is my project description.\n\n## Guidelines\n- Do X\n- Do Y\n";
            fs.writeFileSync(path.join(TEST_DIR, "CLAUDE.md"), existingContent);

            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: false });

            const newContent = fs.readFileSync(path.join(TEST_DIR, "CLAUDE.md"), "utf-8");
            
            // Original content should still be present
            expect(newContent).toContain("# My Project");
            expect(newContent).toContain("This is my project description");
            expect(newContent).toContain("## Guidelines");
            
            // New valyrianctx section should be added
            expect(newContent).toContain("<!-- valyrianctx:start -->");
            expect(newContent).toContain("<!-- valyrianctx:end -->");
            expect(newContent).toContain("valyrianctx resume");
        });

        it("should update existing valyrianctx section without duplicating", async () => {
            // First write
            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: false });
            const firstContent = fs.readFileSync(path.join(TEST_DIR, "CLAUDE.md"), "utf-8");
            
            // Second write (simulate update)
            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: false });
            const secondContent = fs.readFileSync(path.join(TEST_DIR, "CLAUDE.md"), "utf-8");

            // Content should be essentially the same (no duplicate sections)
            const firstMarkerCount = (firstContent.match(/<!-- valyrianctx:start -->/g) || []).length;
            const secondMarkerCount = (secondContent.match(/<!-- valyrianctx:start -->/g) || []).length;
            
            expect(firstMarkerCount).toBe(1);
            expect(secondMarkerCount).toBe(1);
        });

        it("should create MCP config when includeMcp is true", async () => {
            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: true });

            const mcpConfigPath = path.join(TEST_DIR, ".claude", "settings.local.json");
            expect(fs.existsSync(mcpConfigPath)).toBe(true);

            const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
            expect(config.mcpServers).toBeDefined();
            expect(config.mcpServers.valyrianctx).toBeDefined();
            expect(config.mcpServers.valyrianctx.command).toBe("valyrianctx-mcp");
        });

        it("should merge MCP config with existing config", async () => {
            // Create existing MCP config
            const mcpDir = path.join(TEST_DIR, ".claude");
            fs.mkdirSync(mcpDir, { recursive: true });
            fs.writeFileSync(
                path.join(mcpDir, "settings.local.json"),
                JSON.stringify({
                    mcpServers: {
                        "other-server": { command: "other-command" }
                    },
                    someOtherSetting: true
                }, null, 2)
            );

            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: true });

            const config = JSON.parse(fs.readFileSync(path.join(mcpDir, "settings.local.json"), "utf-8"));
            
            // Should have both servers
            expect(config.mcpServers["other-server"]).toBeDefined();
            expect(config.mcpServers.valyrianctx).toBeDefined();
            
            // Should preserve other settings
            expect(config.someOtherSetting).toBe(true);
        });

        it("should update .gitignore with IDE-local paths", async () => {
            await writeIDERules(TEST_DIR, { includeMcp: true });

            const gitignore = fs.readFileSync(path.join(TEST_DIR, ".gitignore"), "utf-8");
            
            // IDE-local paths should be gitignored
            expect(gitignore).toContain(".cursor/rules/valyrianctx.mdc");
            expect(gitignore).toContain(".trae/rules/valyrianctx.md");
            expect(gitignore).toContain(".warp/valyrianctx.md");
            
            // MCP configs should be gitignored
            expect(gitignore).toContain(".claude/settings.local.json");
        });
    });

    describe("removeIDERules", () => {
        it("should remove all valyrianctx rule files and sections", async () => {
            // First write rules
            await writeIDERules(TEST_DIR, { includeMcp: true });
            
            // Verify they exist
            expect(fs.existsSync(path.join(TEST_DIR, "CLAUDE.md"))).toBe(true);
            expect(fs.existsSync(path.join(TEST_DIR, ".cursor", "rules", "valyrianctx.mdc"))).toBe(true);

            // Remove rules
            const removed = await removeIDERules(TEST_DIR);

            // Should report what was removed
            expect(removed.length).toBeGreaterThan(0);

            // Dedicated files should be deleted
            expect(fs.existsSync(path.join(TEST_DIR, ".cursor", "rules", "valyrianctx.mdc"))).toBe(false);
            expect(fs.existsSync(path.join(TEST_DIR, ".trae", "rules", "valyrianctx.md"))).toBe(false);
            expect(fs.existsSync(path.join(TEST_DIR, ".warp", "valyrianctx.md"))).toBe(false);

            // Shared files should have section removed but still exist (if they had content)
            // Since we created them empty, they should be deleted too
        });

        it("should preserve user content in shared files when removing section", async () => {
            // Create CLAUDE.md with user content first
            const userContent = "# My Project\n\nMy content here.\n";
            fs.writeFileSync(path.join(TEST_DIR, "CLAUDE.md"), userContent);

            // Add valyrianctx section
            await writeIDERules(TEST_DIR, { ides: ["claude-code"], includeMcp: false });

            // Remove valyrianctx rules
            await removeIDERules(TEST_DIR);

            // File should still exist with user content
            expect(fs.existsSync(path.join(TEST_DIR, "CLAUDE.md"))).toBe(true);
            const content = fs.readFileSync(path.join(TEST_DIR, "CLAUDE.md"), "utf-8");
            expect(content).toContain("# My Project");
            expect(content).toContain("My content here");
            
            // Valyrianctx section should be gone
            expect(content).not.toContain("<!-- valyrianctx:start -->");
        });

        it("should remove valyrianctx from MCP config without deleting other servers", async () => {
            // Create MCP config with multiple servers
            const mcpDir = path.join(TEST_DIR, ".claude");
            fs.mkdirSync(mcpDir, { recursive: true });
            fs.writeFileSync(
                path.join(mcpDir, "settings.local.json"),
                JSON.stringify({
                    mcpServers: {
                        "other-server": { command: "other" },
                        valyrianctx: { command: "valyrianctx-mcp" }
                    }
                }, null, 2)
            );

            await removeIDERules(TEST_DIR);

            const config = JSON.parse(fs.readFileSync(path.join(mcpDir, "settings.local.json"), "utf-8"));
            
            // Other server should remain
            expect(config.mcpServers["other-server"]).toBeDefined();
            
            // Valyrianctx should be gone
            expect(config.mcpServers.valyrianctx).toBeUndefined();
        });
    });

    describe("listIDERules", () => {
        it("should report status of all IDE rule targets", async () => {
            const statuses = await listIDERules(TEST_DIR);
            
            expect(statuses.length).toBe(7);
            
            // All should be not configured initially
            for (const status of statuses) {
                expect(status.exists).toBe(false);
                expect(status.hasMcpConfig).toBe(false);
            }
        });

        it("should accurately report which rules are configured", async () => {
            // Configure only Claude Code and Cursor
            await writeIDERules(TEST_DIR, { 
                ides: ["claude-code", "cursor"], 
                includeMcp: true 
            });

            const statuses = await listIDERules(TEST_DIR);
            
            const claudeStatus = statuses.find(s => s.id === "claude-code");
            const cursorStatus = statuses.find(s => s.id === "cursor");
            const antigravityStatus = statuses.find(s => s.id === "antigravity");

            expect(claudeStatus?.exists).toBe(true);
            expect(claudeStatus?.hasMcpConfig).toBe(true);
            
            expect(cursorStatus?.exists).toBe(true);
            expect(cursorStatus?.hasMcpConfig).toBe(true);
            
            expect(antigravityStatus?.exists).toBe(false);
            expect(antigravityStatus?.hasMcpConfig).toBe(false);
        });
    });
});
