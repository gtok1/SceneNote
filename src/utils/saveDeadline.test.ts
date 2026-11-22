import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

it("93 T-1: fast saves resolve and are never aborted", async () => {
  const { runWithSaveDeadline } = await import("./saveDeadline");
  let received!: AbortSignal;
  const result = await runWithSaveDeadline(async (signal) => {
    received = signal;
    await wait(5);
    return "ok";
  }, 50);
  assert.equal(result, "ok");
  await wait(100);
  assert.equal(received.aborted, false);
});

it("93 T-2: a hanging save settles with the timeout message", async () => {
  const { runWithSaveDeadline, SAVE_TIMEOUT_MESSAGE } = await import("./saveDeadline");
  let received!: AbortSignal;
  const save = runWithSaveDeadline((signal) => {
    received = signal;
    return new Promise<never>(() => {});
  }, 30);
  let watchdog!: ReturnType<typeof setTimeout>;
  const stillPending = new Promise<never>((_, reject) => {
    watchdog = setTimeout(() => reject(new Error("still pending after 300ms")), 300);
  });
  try {
    await assert.rejects(Promise.race([save, stillPending]), { message: SAVE_TIMEOUT_MESSAGE });
    assert.equal(received.aborted, true);
  } finally {
    clearTimeout(watchdog);
  }
});

it("93 T-3: abort errors become the Korean timeout message", async () => {
  const { runWithSaveDeadline, SAVE_TIMEOUT_MESSAGE } = await import("./saveDeadline");
  const save = runWithSaveDeadline((signal) => new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("AbortError: The user aborted a request.")));
  }), 30);
  await assert.rejects(save, { message: SAVE_TIMEOUT_MESSAGE });
});

it("93 T-4: own errors pass through before the deadline", async () => {
  const { runWithSaveDeadline } = await import("./saveDeadline");
  const ownError = new Error("핀을 찾을 수 없어요.");
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  let received!: AbortSignal;
  process.on("unhandledRejection", onUnhandled);
  try {
    await assert.rejects(runWithSaveDeadline(async (signal) => {
      received = signal;
      throw ownError;
    }, 100), (error) => error === ownError);
    await wait(200);
    assert.equal(received.aborted, false);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

function serviceFunction(file: string, name: string) {
  const source = readFileSync(`src/services/${file}.ts`, "utf8");
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  return source.slice(start, source.indexOf("\n}", start));
}

it("93 T-5: save services and pin pre-check use the deadline", () => {
  for (const [file, name, request] of [
    ["reviews", "saveContentReview", ".upsert("],
    ["library", "updateLibraryWatchDates", ".update("],
    ["pins", "deletePin", ".delete("]
  ] as const) {
    const body = serviceFunction(file, name);
    assert.ok(body.includes("runWithSaveDeadline("), `${name} missing deadline`);
    assert.ok(body.includes(request) && body.indexOf(request) < body.indexOf(".abortSignal(signal)"), name);
  }
  for (const name of ["createPin", "updatePin"]) {
    const body = serviceFunction("pins", name);
    assert.ok(body.includes("runWithSaveDeadline("), name);
    assert.match(body, /savePinAtomically\([^;]+\bsignal\b[^;]*\)/);
  }
  assert.match(serviceFunction("pins", "savePinAtomically"), /\.rpc\("save_timeline_pin"[^;]+\.abortSignal\(signal\)/);
  const context = serviceFunction("pinContext", "getPinContext");
  assert.match(context, /signal\?: AbortSignal\)/);
  assert.equal(context.match(/\.abortSignal\(signal\)/g)?.length, 2);
  assert.ok(!context.includes("runWithSaveDeadline"));
  const composer = readFileSync("src/components/pins/PinComposer.tsx", "utf8");
  assert.ok(composer.includes("runWithSaveDeadline((signal) => getPinContext(contentId, episodeId, signal))"));
  assert.doesNotMatch(readFileSync("src/hooks/usePinContext.ts", "utf8"), /runWithSaveDeadline/);
});

it("93 T-6: deadline constants are fixed", async () => {
  const { SAVE_TIMEOUT_MS, SAVE_TIMEOUT_MESSAGE } = await import("./saveDeadline");
  assert.equal(SAVE_TIMEOUT_MS, 15_000);
  assert.equal(SAVE_TIMEOUT_MESSAGE, "응답이 늦어 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요.");
});
