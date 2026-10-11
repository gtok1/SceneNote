import assert from "node:assert/strict";
import { it } from "node:test";
import { saveContentCrew, type CrewStoreClient } from "./contentCrewStore.ts";
import type { CrewMemberMeta } from "./contentCrew.ts";

function client(error: { code?: string; message?: string } | null, patches: unknown[] = [], matches: unknown[] = []): CrewStoreClient {
  return { from(table) {
    assert.equal(table, "contents");
    return { update(patch) {
      patches.push(patch);
      return { eq(column, value) { matches.push([column,value]); return Promise.resolve({error}); } };
    } };
  } };
}
it("W-1 saves bounded crew and the supplied timestamp", async () => {
  const patches: { crew: CrewMemberMeta[]; crew_updated_at: string }[] = [];
  const matches: unknown[] = [];
  const crew: CrewMemberMeta[] = [1,2,3,4,5].map(id => ({id,name:String(id),role:"director",job:"director",original_name:null,profile_url:null}));
  assert.equal(await saveContentCrew(client(null,patches,matches), "content-id", crew, new Date("2026-10-09T00:00:00.000Z")), "saved");
  assert.deepEqual(patches, [{crew:crew.slice(0,3),crew_updated_at:"2026-10-09T00:00:00.000Z"}]);
  assert.deepEqual(matches, [["id","content-id"]]);
});
it("W-2 tolerates missing crew columns", async () => {
  for (const error of [{code:"42703",message:"column contents.crew does not exist"},{message:"Could not find the 'crew_updated_at' column"}]) {
    assert.equal(await saveContentCrew(client(error), "content-id", []), "missing_column");
  }
});
it("W-3 returns failure without rejecting on errors or exceptions", async () => {
  assert.equal(await saveContentCrew(client({code:"500",message:"boom"}), "content-id", []), "failed");
  const throwing: CrewStoreClient = { from() { return { update() { throw new Error("boom"); } }; } };
  assert.equal(await saveContentCrew(throwing, "content-id", []), "failed");
});
