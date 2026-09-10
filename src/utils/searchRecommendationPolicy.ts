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
