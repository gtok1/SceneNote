import assert from "node:assert/strict";
import { it } from "node:test";
import { backfillTarget, parseBackfillArgs, retryDelayMs } from "./backfillContentCrew";

it("B-1 defaults to dry-run and bounds argument limits", () => {
  assert.deepEqual(parseBackfillArgs([]), {apply:false,limit:200});
  assert.deepEqual(parseBackfillArgs(["--apply"]), {apply:true,limit:200});
  assert.deepEqual(parseBackfillArgs(["--limit","50"]), {apply:false,limit:50});
  assert.deepEqual(parseBackfillArgs(["--limit=5000"]), {apply:false,limit:2000});
  assert.deepEqual(parseBackfillArgs(["--limit","x"]), {apply:false,limit:200});
});
it("B-2 targets only supported providers with numeric ids", () => {
  assert.deepEqual(backfillTarget({source_api:"tmdb",source_id:"496243",content_type:"movie"}), {kind:"tmdb",mediaType:"movie",id:"496243"});
  assert.deepEqual(backfillTarget({source_api:"tmdb",source_id:"136283",content_type:"drama"}), {kind:"tmdb",mediaType:"tv",id:"136283"});
  assert.deepEqual(backfillTarget({source_api:"anilist",source_id:"154587",content_type:"anime"}), {kind:"anilist",id:"154587"});
  assert.deepEqual(backfillTarget({source_api:"kitsu",source_id:"1",content_type:"anime"}), {kind:"skip"});
  assert.deepEqual(backfillTarget({source_api:"tmdb",source_id:"abc",content_type:"movie"}), {kind:"skip"});
  assert.deepEqual(backfillTarget({source_api:"manual",source_id:null,content_type:"movie"}), {kind:"skip"});
});
it("B-3 bounds Retry-After seconds and defaults malformed values", () => {
  assert.equal(retryDelayMs("30"),30000);
  assert.equal(retryDelayMs("0"),1000);
  assert.equal(retryDelayMs("999"),300000);
  assert.equal(retryDelayMs(null),60000);
  assert.equal(retryDelayMs("soon"),60000);
});
