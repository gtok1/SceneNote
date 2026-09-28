import type { SearchResult } from "../src/types/content";
import { formatSearchResultTitle } from "../src/utils/searchResultTitle";

export interface GoldenExpectation {
  query: string;
  mustInclude: { externalId: string; seasonNumber?: number | null; contentType?: string; displayTitleIncludes?: string }[];
}

export const SEARCH_GOLDEN_CASES: readonly GoldenExpectation[] = [
  { query: "재벌X형사", mustInclude: [{ externalId: "220074", seasonNumber: 1 }, { externalId: "220074", seasonNumber: 2 }] },
  { query: "결혼 못하는", mustInclude: [{ externalId: "13372", seasonNumber: 1 }, { externalId: "13372", seasonNumber: 2 }, { externalId: "31618" }] },
  { query: "고독한 미식가", mustInclude: [{ externalId: "55582", contentType: "jdrama" }] },
  { query: "중쇄를 찍자", mustInclude: [{ externalId: "67504", contentType: "jdrama" }] },
  { query: "진격의 거인", mustInclude: [{ externalId: "1429", seasonNumber: 4, displayTitleIncludes: "진격의 거인" }] },
  { query: "귀멸의 칼날", mustInclude: [{ externalId: "85937", seasonNumber: 5, displayTitleIncludes: "귀멸의 칼날" }] },
  { query: "브레이킹 배드", mustInclude: [{ externalId: "1396" }] },
  { query: "기생충", mustInclude: [{ externalId: "496243", contentType: "movie" }] },
  { query: "파묘", mustInclude: [{ externalId: "838209", contentType: "movie" }] },
  { query: "랑야방", mustInclude: [{ externalId: "64197" }] },
  { query: "눈물의 여왕", mustInclude: [{ externalId: "215720", contentType: "kdrama" }] },
  { query: "셜록", mustInclude: [{ externalId: "19885" }] }
];

export function evaluateGoldenCase(
  results: readonly Pick<SearchResult, "external_id" | "season_number" | "content_type" | "title_primary" | "series_title">[],
  expectation: GoldenExpectation
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const expected of expectation.mustInclude) {
    const found = results.find(result => result.external_id === expected.externalId && (
      expected.seasonNumber === undefined ||
      (expected.seasonNumber === null ? result.season_number == null : result.season_number === expected.seasonNumber)
    ));
    const label = `${expectation.query}: ${expected.externalId}${expected.seasonNumber != null ? ` S${expected.seasonNumber}` : ""}`;
    if (!found) { failures.push(`${label} 없음`); continue; }
    if (expected.contentType && found.content_type !== expected.contentType) {
      failures.push(`${label} content_type ${found.content_type} ≠ ${expected.contentType}`);
    }
    if (expected.displayTitleIncludes) {
      const displayTitle = formatSearchResultTitle(found);
      if (!displayTitle.includes(expected.displayTitleIncludes)) {
        failures.push(`${label} 제목 "${displayTitle}"에 "${expected.displayTitleIncludes}" 없음`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}
