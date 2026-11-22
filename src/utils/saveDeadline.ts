export const SAVE_TIMEOUT_MS = 15_000;
export const SAVE_TIMEOUT_MESSAGE = "응답이 늦어 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요.";

export async function runWithSaveDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms = SAVE_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const { signal } = controller;
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error(SAVE_TIMEOUT_MESSAGE));
    signal.addEventListener("abort", onAbort);
  });
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([run(signal), aborted]);
  } catch (error) {
    if (signal.aborted) throw new Error(SAVE_TIMEOUT_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
