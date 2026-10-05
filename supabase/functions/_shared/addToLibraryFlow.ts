export type AddToLibraryPath = "already_exists" | "fast_insert" | "fetch_and_insert";

export function planAddToLibraryPath(input: {
  existingContentId: string | null;
  existingLibraryItemId: string | null;
}): AddToLibraryPath {
  if (!input.existingContentId) return "fetch_and_insert";
  return input.existingLibraryItemId ? "already_exists" : "fast_insert";
}

export interface EdgeRuntimeLike {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export async function runAfterResponse(
  task: () => Promise<void>,
  runtime: EdgeRuntimeLike | undefined
): Promise<void> {
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(task().catch(() => undefined));
    return;
  }
  await task();
}
