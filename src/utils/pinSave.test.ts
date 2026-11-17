import assert from "node:assert/strict";
import { it } from "node:test";
import type { PinInput } from "../types/pins";

const pinId = "11111111-1111-4111-8111-111111111111";
const input: PinInput = { content_id: "content", episode_id: null, timestamp_seconds: 0, memo: " memo ", emotion: "none", is_spoiler: false, tagNames: ["first"] };

it("PIN-A1: a create identity is generated once and survives repeated save attempts", async () => {
  const pinSave = await import("./pinSave");
  let calls = 0;
  const identity = pinSave.createPinSaveIdentity(() => { calls += 1; return pinId; });
  assert.equal(calls, 0);
  assert.equal(identity.getId(), pinId);
  assert.equal(identity.getId(), pinId);
  assert.equal(calls, 1);
});

it("PIN-A2: different forms keep independent creation identities", async () => {
  const pinSave = await import("./pinSave");
  const otherId = "22222222-2222-4222-8222-222222222222";
  assert.equal(pinSave.createPinSaveIdentity(() => pinId).getId(), pinId);
  assert.equal(pinSave.createPinSaveIdentity(() => otherId).getId(), otherId);
});

it("PIN-A3: a malformed generated request id is rejected before a save", async () => {
  const pinSave = await import("./pinSave");
  assert.throws(() => pinSave.createPinSaveIdentity(() => "invalid").getId(), /저장/);
});

it("PIN-A4: atomic arguments retain movie null episode, zero seconds, and normalized memo", async () => {
  const pinSave = await import("./pinSave");
  assert.deepEqual(pinSave.atomicPinSaveArgs(pinId, input, true), {
    p_pin_id: pinId, p_is_create: true, p_content_id: "content", p_episode_id: null,
    p_timestamp_seconds: 0, p_memo: "memo", p_emotion: "none", p_is_spoiler: false, p_tag_names: ["first"]
  });
});

it("PIN-A5: atomic arguments normalize duplicate tag names without dropping valid tags", async () => {
  const pinSave = await import("./pinSave");
  assert.deepEqual(pinSave.atomicPinSaveArgs(pinId, { ...input, tagNames: [" first ", "second", "first"] }, false).p_tag_names, ["first", "second"]);
});

it("PIN-A6: more than ten distinct tags fails instead of silently truncating the save", async () => {
  const pinSave = await import("./pinSave");
  assert.throws(() => pinSave.atomicPinSaveArgs(pinId, { ...input, tagNames: Array.from({ length: 11 }, (_, i) => String(i)) }, true), /10개/);
});

it("PIN-A7: empty and oversized tags fail before a save", async () => {
  const pinSave = await import("./pinSave");
  for (const name of [" ", "x".repeat(21)]) assert.throws(() => pinSave.atomicPinSaveArgs(pinId, { ...input, tagNames: [name] }, true), /태그/);
});

it("PIN-A8: a missing atomic RPC has an explicit Korean unavailable message", async () => {
  const pinSave = await import("./pinSave");
  for (const code of ["PGRST202", "42883"]) assert.equal(pinSave.atomicPinSaveError({ code, message: "Function not found" }), "핀 저장 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.");
});

it("PIN-A9: a replay with a changed payload points to the already saved pin", async () => {
  const pinSave = await import("./pinSave");
  assert.equal(pinSave.atomicPinSaveError({ message: "PIN_REQUEST_CONFLICT" }), "이미 저장된 핀이 있어요. 핀 목록에서 저장 결과를 확인해 주세요.");
});

it("PIN-A10: unknown database errors never expose their raw English message", async () => {
  const pinSave = await import("./pinSave");
  assert.equal(pinSave.atomicPinSaveError({ message: "permission denied for table timeline_pins" }), "핀을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
});
