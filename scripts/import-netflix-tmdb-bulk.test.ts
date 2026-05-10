import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  completedStatusFlags,
  createStoredZipForTest,
  findExistingContentForRow,
  ImportCache,
  normalizeWorkRows,
  parseWorksWorkbook,
  scoreTmdbCandidate,
  selectBestTmdbCandidate,
  TmdbClient
} from "./import-netflix-tmdb-bulk";

function createWorkbookXml(): Buffer {
  return createStoredZipForTest({
    "xl/workbook.xml": `
      <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Works_To_Register" sheetId="1" r:id="rId1"/></sheets>
      </workbook>
    `,
    "xl/_rels/workbook.xml.rels": `
      <Relationships>
        <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
      </Relationships>
    `,
    "xl/worksheets/sheet1.xml": `
      <worksheet><sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>import_selected</t></is></c>
          <c r="B1" t="inlineStr"><is><t>normalized_title</t></is></c>
          <c r="C1" t="inlineStr"><is><t>title_override</t></is></c>
          <c r="D1" t="inlineStr"><is><t>tmdb_search_query</t></is></c>
          <c r="E1" t="inlineStr"><is><t>media_hint</t></is></c>
          <c r="F1" t="inlineStr"><is><t>view_count</t></is></c>
          <c r="G1" t="inlineStr"><is><t>desired_watch_status</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>TRUE</t></is></c>
          <c r="B2" t="inlineStr"><is><t>원본 제목</t></is></c>
          <c r="C2" t="inlineStr"><is><t>보정 제목</t></is></c>
          <c r="D2" t="inlineStr"><is><t>보정 제목</t></is></c>
          <c r="E2" t="inlineStr"><is><t>tv</t></is></c>
          <c r="F2"><v>3</v></c>
          <c r="G2" t="inlineStr"><is><t>completed</t></is></c>
        </row>
        <row r="3">
          <c r="A3" t="inlineStr"><is><t>FALSE</t></is></c>
          <c r="B3" t="inlineStr"><is><t>제외 제목</t></is></c>
        </row>
      </sheetData></worksheet>
    `
  });
}

test("parses Works_To_Register XLSX rows", () => {
  const workbook = parseWorksWorkbook(createWorkbookXml());
  assert.equal(workbook.sheets.Works_To_Register?.length, 2);
  assert.equal(workbook.sheets.Works_To_Register?.[0]?.normalized_title, "원본 제목");
});

test("normalizes selected rows and prefers title_override", () => {
  const rows = normalizeWorkRows(parseWorksWorkbook(createWorkbookXml()).sheets.Works_To_Register ?? []);
  const selected = rows.filter((row) => row.importSelected);
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.resolvedTitle, "보정 제목");
  assert.equal(selected[0]?.viewCount, 3);
});

test("finds existing app content by exact title without creating duplicates", () => {
  const [row] = normalizeWorkRows([
    {
      import_selected: "TRUE",
      normalized_title: "  나의 해방일지 ",
      title_override: "",
      media_hint: "tv"
    }
  ]);
  assert.ok(row);

  const match = findExistingContentForRow(row, [
    {
      id: "content-1",
      content_type: "kdrama",
      source_api: "tmdb",
      source_id: "1",
      title_primary: "나의 해방일지",
      title_original: null,
      air_year: 2022
    }
  ]);

  assert.equal(match.status, "matched");
  assert.equal(match.content?.id, "content-1");
});

test("finds existing content by tmdb external id", () => {
  const [row] = normalizeWorkRows([
    {
      import_selected: "TRUE",
      normalized_title: "아무 제목",
      media_hint: "movie",
      tmdb_id: "99"
    }
  ]);
  assert.ok(row);

  const match = findExistingContentForRow(row, [
    {
      id: "content-99",
      content_type: "movie",
      source_api: "tmdb",
      source_id: "99",
      title_primary: "기존 영화",
      title_original: null,
      air_year: 2020
    }
  ]);

  assert.equal(match.status, "matched");
  assert.equal(match.content?.id, "content-99");
});

test("marks ambiguous existing candidates for manual review", () => {
  const [row] = normalizeWorkRows([
    {
      import_selected: "TRUE",
      normalized_title: "동명 작품",
      media_hint: "unknown"
    }
  ]);
  assert.ok(row);

  const match = findExistingContentForRow(row, [
    {
      id: "a",
      content_type: "movie",
      source_api: "tmdb",
      source_id: "1",
      title_primary: "동명 작품",
      title_original: null,
      air_year: 2019
    },
    {
      id: "b",
      content_type: "kdrama",
      source_api: "tmdb",
      source_id: "2",
      title_primary: "동명 작품",
      title_original: null,
      air_year: 2020
    }
  ]);

  assert.equal(match.status, "ambiguous");
});

test("scores and selects confident TMDB candidate", () => {
  const [row] = normalizeWorkRows([
    {
      import_selected: "TRUE",
      normalized_title: "킹덤",
      media_hint: "tv"
    }
  ]);
  assert.ok(row);

  const tvScore = scoreTmdbCandidate(row, { id: 1, media_type: "tv", name: "킹덤" });
  const movieScore = scoreTmdbCandidate(row, { id: 2, media_type: "movie", title: "킹덤" });
  assert.ok(tvScore > movieScore);

  const match = selectBestTmdbCandidate(
    row,
    [
      { id: 1, media_type: "tv", name: "킹덤" },
      { id: 2, media_type: "movie", title: "킹덤" }
    ],
    65
  );
  assert.equal(match.status, "matched");
  assert.equal(match.candidate?.id, 1);
});

test("preserves recommendation flags when setting completed", () => {
  assert.deepEqual(completedStatusFlags(["watching", "recommended"]), ["completed", "recommended"]);
  assert.deepEqual(completedStatusFlags(["not_recommended"]), ["completed", "not_recommended"]);
});

test("TMDB cache prevents duplicate search calls", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scenenote-import-cache-"));
  const originalFetch = globalThis.fetch;
  process.env.TMDB_API_KEY = "test-key";
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ results: [{ id: 1, media_type: "tv", name: "캐시 작품" }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const cache = new ImportCache(tempDir);
    const client = new TmdbClient(cache);
    await client.search("캐시 작품", "tv");
    await client.search("캐시 작품", "tv");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("TMDB client retries 429 responses", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scenenote-import-retry-"));
  const originalFetch = globalThis.fetch;
  process.env.TMDB_API_KEY = "test-key";
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
    }
    return new Response(JSON.stringify({ results: [{ id: 2, media_type: "movie", title: "재시도 작품" }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const client = new TmdbClient(new ImportCache(tempDir));
    const result = await client.search("재시도 작품", "movie");
    assert.equal(calls, 2);
    assert.equal(result.results[0]?.id, 2);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
