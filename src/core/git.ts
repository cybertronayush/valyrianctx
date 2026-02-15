import simpleGit from "simple-git";

const git = simpleGit();

export async function getCurrentBranch(): Promise<string> {
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
}

export async function getRepoName(): Promise<string> {
  const remote = await git.remote(["get-url", "origin"]).catch(() => null);
  if (remote) {
    const name = remote.trim().split("/").pop()?.replace(".git", "") || "unknown";
    return name;
  }
  const root = await git.revparse(["--show-toplevel"]);
  return root.trim().split("/").pop() || "unknown";
}

export async function getChangedFiles(): Promise<string[]> {
  const status = await git.status();
  return [...status.modified, ...status.created, ...status.not_added];
}

export async function getStagedFiles(): Promise<string[]> {
  const status = await git.status();
  return status.staged;
}

export async function getRecentCommits(count: number = 5): Promise<string[]> {
  const log = await git.log({ maxCount: count });
  return log.all.map((c) => `${c.hash.slice(0, 7)} ${c.message}`);
}

export async function getAuthor(): Promise<string> {
  const name = await git.raw(["config", "user.name"]).catch(() => "unknown");
  return name.trim();
}

export async function getRepoRoot(): Promise<string> {
  const root = await git.revparse(["--show-toplevel"]);
  return root.trim();
}
