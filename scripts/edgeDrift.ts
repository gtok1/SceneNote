import { dirname, join, normalize } from "node:path";

export interface DeployedFunction { slug: string; version: number; status: string; updatedAt: number }
export interface LocalFunction { slug: string; lastChangedAt: number | null; uncommitted: boolean }
export type DriftStatus = "ok" | "stale" | "not_deployed" | "uncommitted" | "remote_only";
export interface DriftRow {
  slug: string;
  status: DriftStatus;
  deployedVersion: number | null;
  deployedAt: number | null;
  lastChangedAt: number | null;
}

export function compareEdgeDeployments(local: readonly LocalFunction[], deployed: readonly DeployedFunction[]): DriftRow[] {
  const remote = new Map(deployed.map(item => [item.slug, item]));
  const localNames = new Set(local.map(item => item.slug));
  const rows: DriftRow[] = local.map(item => {
    const deployment = remote.get(item.slug);
    const status: DriftStatus = !deployment ? "not_deployed"
      : item.uncommitted ? "uncommitted"
        : item.lastChangedAt !== null && item.lastChangedAt > deployment.updatedAt ? "stale" : "ok";
    return {
      slug: item.slug, status,
      deployedVersion: deployment?.version ?? null,
      deployedAt: deployment?.updatedAt ?? null,
      lastChangedAt: item.lastChangedAt
    };
  });
  for (const item of deployed) {
    if (!localNames.has(item.slug)) rows.push({
      slug: item.slug, status: "remote_only", deployedVersion: item.version,
      deployedAt: item.updatedAt, lastChangedAt: null
    });
  }
  return rows.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function collectLocalImports(entryPath: string, readFile: (path: string) => string | null): string[] {
  const seen = new Set<string>();
  const visit = (filePath: string) => {
    const normalized = normalize(filePath);
    if (seen.has(normalized) || normalized.endsWith(".test.ts")) return;
    seen.add(normalized);
    const source = readFile(normalized);
    if (source === null) { seen.delete(normalized); return; }
    for (const match of source.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+\.ts)["']/g)) {
      if (match[1]) visit(join(dirname(normalized), match[1]));
    }
  };
  visit(entryPath);
  return [...seen].sort();
}

export function hasDrift(rows: readonly DriftRow[]): boolean {
  return rows.some(row => row.status === "stale" || row.status === "not_deployed" || row.status === "uncommitted");
}
