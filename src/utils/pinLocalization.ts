import type { ExternalSource } from "../types/content";
import type { TimelinePin } from "../types/pins";

type GetContentDetail = (request: {
  source: Exclude<ExternalSource, "manual">;
  externalId: string;
  mediaType: "movie" | "tv";
}) => Promise<{ content: { title_primary?: string | null } }>;

export async function enrichLocalizedPinTitles(
  pins: TimelinePin[],
  getDetail: GetContentDetail
): Promise<TimelinePin[]> {
  const candidates = pins.filter(
    (pin) =>
      pin.content_source_api &&
      pin.content_source_api !== "manual" &&
      pin.content_source_id &&
      isLikelyEnglishTitle(pin.content_title)
  );

  if (!candidates.length) return pins;

  const titleByContentId = new Map<string, string>();
  await Promise.all(
    Array.from(new Map(candidates.map((pin) => [pin.content_id, pin])).values())
      .slice(0, 8)
      .map(async (pin) => {
        try {
          const detail = await getDetail({
            source: pin.content_source_api as Exclude<ExternalSource, "manual">,
            externalId: pin.content_source_id ?? "",
            mediaType: pin.content_type === "movie" ? "movie" : "tv"
          });
          const localizedTitle = detail.content.title_primary?.trim();
          if (localizedTitle && !isLikelyEnglishTitle(localizedTitle)) {
            titleByContentId.set(pin.content_id, localizedTitle);
          }
        } catch {
          // Keep the stored title if localization refresh fails.
        }
      })
  );

  if (!titleByContentId.size) return pins;

  return pins.map((pin) => ({
    ...pin,
    content_title: titleByContentId.get(pin.content_id) ?? pin.content_title
  }));
}

function isLikelyEnglishTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return /[A-Za-z]/.test(title) && !/[가-힣]/.test(title);
}
