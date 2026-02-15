export interface ContextEntry {
  id: string;
  timestamp: string;
  branch: string;
  repo: string;
  author: string;

  // Core context
  task: string;
  goal?: string;
  approaches: string[];
  decisions: string[];
  currentState: string;
  nextSteps: string[];
  blockers?: string[];

  // Auto-captured
  filesChanged: string[];
  filesStaged: string[];
  recentCommits: string[];

  // Team
  assignee?: string;
  handoffNote?: string;
}

export interface ValyrianCtxConfig {
  version: string;
  createdAt: string;
  repo: string;
}
