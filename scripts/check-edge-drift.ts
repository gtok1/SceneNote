/// <reference types="node" />

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { collectLocalImports, compareEdgeDeployments, hasDrift, type DeployedFunction, type LocalFunction } from "./edgeDrift";

loadEnvFile(".env");
loadEnvFile(".env.local");

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim()
  || projectRefFromUrl(process.env.SUPABASE_URL)
  || projectRefFromUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !token) {
  console.error("SUPABASE_ACCESS_TOKEN과 프로젝트 ref가 필요합니다.");
  process.exit(2);
}

void main(projectRef, token);

async function main(ref: string, accessToken: string): Promise<void> {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/functions`, {
      method: "GET", headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Management API HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.some(item => !item || typeof item !== "object" ||
      typeof item.slug !== "string" || typeof item.version !== "number" || typeof item.updated_at !== "number")) {
      throw new Error("Management API 응답 형식 오류");
    }
    const deployed: DeployedFunction[] = payload.map(item => ({
      slug: item.slug, version: item.version, status: typeof item.status === "string" ? item.status : "unknown",
      updatedAt: item.updated_at
    }));
    const local = collectLocalFunctions();
    const rows = compareEdgeDeployments(local, deployed);
    console.log("slug\t상태\t운영 버전\t배포 시각 (KST)\t코드 변경 시각 (KST)");
    for (const row of rows) console.log([
      row.slug, row.status, row.deployedVersion === null ? "-" : `v${row.deployedVersion}`,
      formatKst(row.deployedAt), formatKst(row.lastChangedAt)
    ].join("\t"));
    if (hasDrift(rows)) {
      console.log(`재배포가 필요한 함수: ${rows.filter(row => ["stale", "not_deployed", "uncommitted"].includes(row.status)).map(row => row.slug).join(", ")}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "배포 상태 조회 실패");
    process.exitCode = 2;
  }
}

function collectLocalFunctions(): LocalFunction[] {
  return readdirSync("supabase/functions", { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith("_") && existsSync(join("supabase/functions", entry.name, "index.ts")))
    .map(entry => {
      const slug = entry.name;
      const files = collectLocalImports(join("supabase/functions", slug, "index.ts"), path => {
        try { return readFileSync(path, "utf8"); } catch { return null; }
      });
      const changed = execFileSync("git", ["log", "-1", "--format=%ct", "--", ...files], { encoding: "utf8" }).trim();
      const lastChangedAt = /^\d+$/.test(changed) ? Number(changed) * 1000 : null;
      const uncommitted = execFileSync("git", ["status", "--porcelain", "--", ...files], { encoding: "utf8" }).trim().length > 0;
      return { slug, lastChangedAt, uncommitted };
    });
}

function projectRefFromUrl(value: string | undefined): string | undefined {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co\/?(?:$|[?#])/i.exec(value?.trim() ?? "")?.[1];
}

function formatKst(value: number | null): string {
  if (value === null) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}

function loadEnvFile(filename: string): void {
  const filePath = resolve(process.cwd(), filename);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key]) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const first = rawValue[0], last = rawValue[rawValue.length - 1];
    process.env[key] = (first === '"' && last === '"') || (first === "'" && last === "'")
      ? rawValue.slice(1, -1) : rawValue;
  }
}
