import { serializeCrewForStorage, type CrewMemberMeta } from "./contentCrew.ts";

export interface CrewStoreClient {
  from(table: "contents"): {
    update(patch: { crew: unknown; crew_updated_at: string }): {
      eq(column: "id", value: string): PromiseLike<{ error: { code?: string; message?: string } | null }>;
    };
  };
}
export type CrewSaveResult = "saved" | "missing_column" | "failed";

export async function saveContentCrew(
  client: CrewStoreClient,
  contentId: string,
  crew: readonly CrewMemberMeta[] | null | undefined,
  now?: Date
): Promise<CrewSaveResult> {
  try {
    const { error } = await client.from("contents").update({
      crew: serializeCrewForStorage(crew),
      crew_updated_at: (now ?? new Date()).toISOString()
    }).eq("id", contentId);
    if (!error) return "saved";
    return error.code === "42703" || error.message?.includes("crew") ? "missing_column" : "failed";
  } catch {
    return "failed";
  }
}
