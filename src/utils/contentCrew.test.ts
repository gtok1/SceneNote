import assert from "node:assert/strict";
import { it } from "node:test";
import { createCrewSummary, createCrewShortLine, CREW_ROLE_LABELS, CREW_SECTION_TITLE } from "./contentCrew";
import type { CrewMember, CrewRole } from "@/types/content";

function m(id: number, name: string, role: CrewRole): CrewMember {
  return {id,name,original_name:null,role,job:role,profile_url:null};
}
it("S-1 orders roles and uses commas for accessibility", () => {
  const summary = createCrewSummary([m(1,"봉준호","writer"),m(1,"봉준호","director"),m(3,"한진원","writer")]);
  assert.equal(summary.text, "감독 봉준호 · 작가 봉준호, 한진원");
  assert.equal(summary.accessibilityLabel, "감독 봉준호, 작가 봉준호, 한진원");
  assert.equal(summary.parts.length, 2);
});
it("S-2 summarizes names beyond two", () => {
  const summary = createCrewSummary([m(1,"A","director"),m(2,"B","director"),m(3,"C","director")]);
  assert.equal(summary.text, "감독 A, B 외 1명");
  assert.equal(summary.parts[0]?.extra, 1);
});
it("S-3 handles missing crew and blank names", () => {
  for (const crew of [[],undefined,null,[m(1,"  ","director")]]) {
    assert.deepEqual(createCrewSummary(crew), {parts:[],text:"",accessibilityLabel:""});
  }
});
it("S-4 labels originals and creators", () => {
  assert.equal(createCrewSummary([m(1,"X","original"),m(2,"Y","creator")]).text, "원작 X · 크리에이터 Y");
});
it("S-5 preserves exact role and section labels", () => {
  assert.deepEqual(CREW_ROLE_LABELS, {director:"감독",writer:"작가",original:"원작",creator:"크리에이터"});
  assert.equal(CREW_SECTION_TITLE, "제작진");
});
it("S-6 deduplicates identical names with different ids", () => {
  assert.equal(createCrewSummary([m(1,"A","director"),m(2,"A","director")]).text, "감독 A");
});

it("L-1 chooses the first role for short lines", () => {
  assert.deepEqual(createCrewShortLine([m(2,"한진원","writer"),m(1,"봉준호","director")]), {text:"감독 봉준호",accessibilityLabel:"감독 봉준호"});
});
it("L-2 summarizes remaining writers without a director", () => {
  assert.equal(createCrewShortLine([m(1,"A","writer"),m(2,"B","writer"),m(3,"C","writer")]).text,"작가 A 외 2명");
});
it("L-3 hides empty short lines", () => {
  for (const crew of [[],undefined,[m(1,"  ","director")]]) assert.deepEqual(createCrewShortLine(crew), {text:"",accessibilityLabel:""});
});
it("L-4 summarizes one name per role", () => {
  assert.equal(createCrewSummary([m(1,"A","director"),m(2,"B","director"),m(3,"C","writer")],1).text,"감독 A 외 1명 · 작가 C");
});
