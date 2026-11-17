import type { PinInput } from "../types/pins";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The id belongs to one form, including retries whose server result is unknown. */
export function createPinSaveIdentity(generate = platformUuid): { getId: () => string } {
  let id: string | undefined;
  return {
    getId() {
      if (id) return id;
      const candidate = generate();
      if (!UUID_PATTERN.test(candidate)) throw new Error("핀 저장을 준비하지 못했어요. 다시 시도해 주세요.");
      id = candidate;
      return id;
    }
  };
}

function platformUuid(): string {
  // Expo's installed native UUID implementation does not depend on a web crypto polyfill.
  const native = (globalThis as typeof globalThis & { expo?: { uuidv4?: () => string } }).expo?.uuidv4;
  if (native) return native();
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  throw new Error("핀 저장을 준비하지 못했어요. 앱을 다시 연 뒤 시도해 주세요.");
}

export function atomicPinSaveArgs(pinId: string, input: PinInput | Omit<PinInput, "content_id" | "episode_id">, isCreate: boolean) {
  if (!UUID_PATTERN.test(pinId)) throw new Error("핀 저장 정보를 확인해 주세요.");
  const tagNames = [...new Set(input.tagNames.map((name) => name.trim()))];
  if (tagNames.length > 10) throw new Error("태그는 10개까지 추가할 수 있어요.");
  if (tagNames.some((name) => !name || name.length > 20)) throw new Error("태그는 1자 이상 20자 이하로 입력해 주세요.");
  return {
    p_pin_id: pinId,
    p_is_create: isCreate,
    p_content_id: "content_id" in input ? input.content_id : null,
    p_episode_id: "episode_id" in input ? input.episode_id ?? null : null,
    p_timestamp_seconds: input.timestamp_seconds,
    p_memo: input.memo?.trim() || null,
    p_emotion: input.emotion,
    p_is_spoiler: input.is_spoiler,
    p_tag_names: tagNames
  };
}

export function atomicPinSaveError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return "핀 저장 기능을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.";
  }
  if (error?.message === "PIN_REQUEST_CONFLICT") return "이미 저장된 핀이 있어요. 핀 목록에서 저장 결과를 확인해 주세요.";
  if (error?.message === "PIN_NOT_FOUND") return "핀을 찾을 수 없어요. 핀 목록을 새로고침한 뒤 다시 시도해 주세요.";
  if (error?.message === "PIN_CONTENT_MISMATCH") return "작품과 회차 정보가 일치하지 않아요. 회차를 다시 선택해 주세요.";
  if (error?.message === "PIN_INVALID_INPUT") return "핀 입력값을 확인해 주세요.";
  return "핀을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
