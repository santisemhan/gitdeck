import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { Repository } from "../../shared/types";

interface StoreData {
  repositories: Repository[];
}

const defaultData: StoreData = { repositories: [] };

export class RecentRepoStore {
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "recent-repositories.json");
  }

  getAll(): Repository[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      return parsed.repositories || [];
    } catch {
      return [];
    }
  }

  add(repoPath: string): Repository[] {
    const current = this.getAll().filter((r) => r.path !== repoPath);
    const item: Repository = {
      path: repoPath,
      name: path.basename(repoPath),
      lastOpenedAt: new Date().toISOString()
    };
    const repositories = [item, ...current].slice(0, 20);
    fs.writeFileSync(this.filePath, JSON.stringify({ repositories }, null, 2), "utf8");
    return repositories;
  }
}
