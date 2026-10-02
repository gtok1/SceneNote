import assert from "node:assert/strict";
import { it } from "node:test";

import { extractShareId, libraryShareErrorMessage, tooManyShareItemsMessage } from "./libraryShareErrors";

const info = (overrides: Partial<Parameters<typeof libraryShareErrorMessage>[0]>) => ({
  status: null,
  code: null,
  message: null,
  maxItems: null,
  ...overrides
});

it("LSE-1 too many items uses the server limit, then the message number, then the default", () => {
  assert.equal(
    libraryShareErrorMessage(info({ status: 400, code: "TOO_MANY_ITEMS", maxItems: 1000 }), "create"),
    "한 번에 최대 1,000개까지 공유할 수 있어요. 상태나 작품 유형 필터로 범위를 줄여 주세요."
  );
  assert.equal(
    libraryShareErrorMessage(info({ status: 400, code: "TOO_MANY_ITEMS", message: "Share up to 300 items at once" }), "create"),
    tooManyShareItemsMessage(300)
  );
  assert.equal(libraryShareErrorMessage(info({ code: "TOO_MANY_ITEMS" }), "create"), tooManyShareItemsMessage(1000));
});

it("LSE-2 auth, expiry, missing and invalid links", () => {
  assert.equal(libraryShareErrorMessage(info({ status: 401 }), "create"), "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.");
  assert.equal(libraryShareErrorMessage(info({ status: 410, code: "EXPIRED" }), "open"), "공유 기간이 끝난 링크예요.");
  assert.equal(libraryShareErrorMessage(info({ status: 404, code: "NOT_FOUND" }), "open"), "공유 링크가 만료되었거나 존재하지 않습니다.");
  assert.equal(libraryShareErrorMessage(info({ status: 400, code: "INVALID_REQUEST" }), "open"), "공유 링크 주소가 올바르지 않아요. 링크가 잘리지 않았는지 확인해 주세요.");
  assert.equal(
    libraryShareErrorMessage(info({ status: 400, code: "INVALID_REQUEST" }), "create"),
    "공유할 작품을 확인하지 못했어요. 라이브러리를 새로고침한 뒤 다시 시도해 주세요."
  );
});

it("LSE-3 never surfaces raw English errors", () => {
  const raw = info({ status: 500, code: "DB_ERROR", message: "Edge Function returned a non-2xx status code" });
  assert.equal(libraryShareErrorMessage(raw, "create"), "공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(libraryShareErrorMessage(raw, "open"), "공유 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
});

it("LSE-4 extractShareId keeps only the UUID from pasted links", () => {
  const id = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";
  assert.equal(extractShareId(id), id);
  assert.equal(extractShareId(id.toUpperCase()), id);
  assert.equal(extractShareId(`${id})`), id);
  assert.equal(extractShareId(`${id}.`), id);
  assert.equal(extractShareId(`%20${id}%20`), id);
  assert.equal(extractShareId([id, "other"]), id);
  assert.equal(extractShareId("%E0%A4%A"), null);
  assert.equal(extractShareId("undefined"), null);
  assert.equal(extractShareId("3f2b8c1e-4a5d"), null);
  assert.equal(extractShareId(""), null);
  assert.equal(extractShareId(undefined), null);
});
