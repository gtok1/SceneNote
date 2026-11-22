import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

import { scanLatestRecommendationCatalog } from "../_shared/recommendationLatestCatalog.ts";
import { recommendationScanBudget } from "../_shared/recommendationTasteFill.ts";
import type { RecommendationCandidate } from "../_shared/recommendationEngine.ts";

const candidate = (id: string, date: string): RecommendationCandidate => ({
  external_source: "anilist",
  external_id: id,
  content_type: "anime",
  title_primary: `작품 ${id}`,
  air_year: Number(date.slice(0, 4)),
  air_date: date,
  genres: ["Action"],
  popularity: 20,
  countries: ["JP"]
});

it("85 T-4: the handler passes the discovery mode to the scan budget", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.equal(source.match(/\brecommendationScanBudget\s*\(/g)?.length, 1);
  const actual = source.split("\n").find((line) => /\brecommendationScanBudget\s*\(/.test(line));
  const expected = "const budget = recommendationScanBudget({ hasCursor: Boolean(validated.value.cursor), discoveryMode: validated.value.discoveryMode });";
  assert.equal(actual?.replace(/\s+/g, ""), expected.replace(/\s+/g, ""));
});

it("85 T-5: a latest first request crosses into the previous month within one request", async () => {
  const scan = async (discoveryMode: "latest" | "mixed") => {
    const budget = recommendationScanBudget({ hasCursor: false, discoveryMode });
    let clock = 0;
    return scanLatestRecommendationCatalog(async (request) => {
      clock += 1100;
      assert.equal(request.provider, "anilist");
      assert.equal(request.page, 1);
      if (request.month === "2026-11") {
        return { items: [candidate("n1", "2026-11-15"), candidate("n2", "2026-11-14")], hasMore: false };
      }
      if (request.month === "2026-10") {
        return {
          items: Array.from({ length: 10 }, (_, index) => candidate(`o${index + 1}`, `2026-10-${31 - index}`)),
          hasMore: false
        };
      }
      return { items: [], hasMore: false };
    }, {
      mediaType: "anime",
      now: "2026-11-15T03:00:00.000Z",
      minimumMonth: "2026-01",
      canContinue: () => clock < budget.scanMs,
      maxMonthsPerRequest: budget.maxMonths,
      maxProviderRoundsPerRequest: budget.maxRounds,
      limit: 12
    });
  };

  const latest = await scan("latest");
  const mixed = await scan("mixed");
  assert.equal(mixed.items.length, 2);
  assert.equal(mixed.scanBudgetReached, true);
  assert.equal(mixed.hasMore, true);
  assert.equal(latest.items.length, 12);
});
