import fs from "fs";
import path from "path";
import { ContextEntry, ValyrianCtxConfig } from "./types";
import { getRepoRoot } from "./git";

export async function getValyrianCtxDir(): Promise<string> {
  const root = await getRepoRoot();
  return path.join(root, ".valyrianctx");
}

export async function isInitialized(): Promise<boolean> {
  const dir = await getValyrianCtxDir();
  return fs.existsSync(dir);
}

export async function saveContext(entry: ContextEntry): Promise<string> {
  const dir = await getValyrianCtxDir();
  const sessionsDir = path.join(dir, "sessions");
  const branchesDir = path.join(dir, "branches");

  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(branchesDir, { recursive: true });

  // Save session
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const sessionFile = path.join(sessionsDir, `${timestamp}.json`);
  fs.writeFileSync(sessionFile, JSON.stringify(entry, null, 2));

  // Update branch context (latest for this branch)
  const branchFile = path.join(branchesDir, `${entry.branch.replace(/\//g, "__")}.json`);

  // Load existing entries or start fresh
  let branchEntries: ContextEntry[] = [];
  if (fs.existsSync(branchFile)) {
    branchEntries = JSON.parse(fs.readFileSync(branchFile, "utf-8"));
  }
  branchEntries.push(entry);
  fs.writeFileSync(branchFile, JSON.stringify(branchEntries, null, 2));

  return sessionFile;
}

export async function loadBranchContext(branch: string): Promise<ContextEntry[]> {
  const dir = await getValyrianCtxDir();
  const branchFile = path.join(dir, "branches", `${branch.replace(/\//g, "__")}.json`);

  if (!fs.existsSync(branchFile)) return [];
  return JSON.parse(fs.readFileSync(branchFile, "utf-8"));
}

export async function loadAllSessions(): Promise<ContextEntry[]> {
  const dir = await getValyrianCtxDir();
  const sessionsDir = path.join(dir, "sessions");

  if (!fs.existsSync(sessionsDir)) return [];

  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json")).sort().reverse();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(sessionsDir, f), "utf-8")));
}

/**
 * Merge context entries from multiple sources (e.g., after git pull).
 * Deduplicates by ID and sorts by timestamp.
 */
export function mergeContexts(
  local: ContextEntry[],
  remote: ContextEntry[]
): ContextEntry[] {
  const merged = new Map<string, ContextEntry>();

  for (const entry of [...local, ...remote]) {
    const existing = merged.get(entry.id);
    if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
      merged.set(entry.id, entry);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Sync branch context file after pulling shared context.
 * Merges local entries with whatever is on disk (which may have been updated by git pull).
 */
export async function syncBranchContext(branch: string): Promise<ContextEntry[]> {
  const dir = await getValyrianCtxDir();
  const branchFile = path.join(dir, "branches", `${branch.replace(/\//g, "__")}.json`);

  if (!fs.existsSync(branchFile)) return [];

  const diskEntries: ContextEntry[] = JSON.parse(fs.readFileSync(branchFile, "utf-8"));

  // Deduplicate (in case of merge conflicts resolved by git)
  const deduped = mergeContexts([], diskEntries);
  fs.writeFileSync(branchFile, JSON.stringify(deduped, null, 2));

  return deduped;
}

