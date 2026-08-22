import { mkdir, writeFile } from "node:fs/promises";
import { writeJsonFile as writeJsonToGithub } from "./github-content";

export interface ConfigWriter {
  writeJsonFile(path: string, data: unknown, message: string): Promise<void>;
}

function localFsWriter(): ConfigWriter {
  return {
    async writeJsonFile(path, data) {
      // Same layout contract as lib/db.ts dataPath(): <base>/data/<file>.
      const base = process.env.DATA_DIR ?? ".";
      const target = `${base}/${path}`;
      await mkdir(target.substring(0, target.lastIndexOf("/")), { recursive: true });
      await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
    },
  };
}

export function getConfigWriter(): ConfigWriter {
  if (process.env.DASHBOARD_LOCAL_FS === "1") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DASHBOARD_LOCAL_FS=1 is an e2e-only seam and must never run against production");
    }
    return localFsWriter();
  }
  return { writeJsonFile: (path, data, message) => writeJsonToGithub(path, data, message) };
}
