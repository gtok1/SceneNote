export interface PinContextContent { id: string; title_primary: string; content_type: string }
export interface PinContextEpisode { id: string; content_id: string; episode_number: number; duration_seconds: number | null; seasons: { season_number: number } | null }
export function resolvePinContext(content: PinContextContent, episodeId: string | null, episode: PinContextEpisode | null) {
  if (content.content_type === "movie") {
    if (episodeId) throw new Error("영화는 회차 없이 기록해 주세요.");
    return { title: content.title_primary, label: "영화", duration: null as number | null };
  }
  if (!episodeId) throw new Error("에피소드 목록에서 기록할 회차를 선택해 주세요.");
  if (!episode || episode.content_id !== content.id || episode.id !== episodeId) throw new Error("선택한 작품의 회차를 확인하지 못했습니다.");
  return {
    title: content.title_primary,
    label: `시즌 ${episode.seasons?.season_number ?? "?"} · ${episode.episode_number}화`,
    duration: episode.duration_seconds && episode.duration_seconds > 0 ? episode.duration_seconds : null
  };
}
