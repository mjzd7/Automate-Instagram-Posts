import { readFile } from "node:fs/promises";
import type { PipelineFile } from "core/src/schedule/generator";

function baseDir(): string {
  return process.env.DATA_DIR ?? ".";
}

export function pipelineFilePath(month: string): string {
  return `${baseDir()}/data/pipeline/${month}.json`;
}

export async function loadPipelineFile(month: string): Promise<PipelineFile | null> {
  try {
    const raw = await readFile(pipelineFilePath(month), "utf-8");
    return JSON.parse(raw) as PipelineFile;
  } catch {
    return null;
  }
}
