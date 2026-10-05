import type { UnsupportedDiscoveryFilter } from "../../supabase/functions/_shared/discoveryFilters";

export function canRunSearchRecommendations(input: {
  enabled: boolean; signedIn: boolean; focused: boolean; online: boolean;
  libraryReady: boolean; query: string; similarityMode: boolean;
}): boolean {
  return input.enabled && input.signedIn && input.focused && input.online &&
    input.libraryReady && !input.similarityMode && input.query.trim().length === 0;
}

/** One activation owns its requests. Closing it prevents further work and aborts pending IO. */
export function createRecommendationRequestScope() {
  let active = true;
  const controllers = new Set<AbortController>();
  return {
    isActive: () => active,
    controller: () => {
      const controller = new AbortController();
      controllers.add(controller);
      if (!active) controller.abort();
      return controller;
    },
    release: (controller: AbortController) => controllers.delete(controller),
    close: () => {
      active = false;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    }
  };
}

export function recommendationProviderError(blocked: boolean, count: number): string | null {
  return blocked && count === 0
    ? "추천 제공처에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
    : null;
}

export function searchSeasonIdentity(result: {external_source: string; external_id: string; season_number?: number | null}): string {
  return `${result.external_source}:${result.external_id}:${result.season_number ?? "whole"}`;
}


export function unsupportedRecommendationFilterCopy(kind: UnsupportedDiscoveryFilter): {
  title: string; description: string; actionLabel: string;
} {
  return kind === "year" ? {
    title: "지금은 연도별 추천을 불러올 수 없어요",
    description: "연도를 해제하면 최신 추천을 볼 수 있어요.",
    actionLabel: "연도 해제"
  } : {
    title: "선택한 조건으로 추천을 불러올 수 없어요",
    description: "조건을 바꾸거나 잠시 후 다시 시도해 주세요.",
    actionLabel: "필터 변경"
  };
}
