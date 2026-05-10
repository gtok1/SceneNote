import { create } from "zustand";

interface EpisodeSelectionState {
  selectedSeasonId: string | null;
  selectedEpisodeId: string | null;
  setSeason: (seasonId: string | null) => void;
  setEpisode: (episodeId: string | null) => void;
  reset: () => void;
}

export const useEpisodeSelectionStore = create<EpisodeSelectionState>((set) => ({
  selectedSeasonId: null,
  selectedEpisodeId: null,
  setSeason: (selectedSeasonId) => set({ selectedSeasonId, selectedEpisodeId: null }),
  setEpisode: (selectedEpisodeId) => set({ selectedEpisodeId }),
  reset: () => set({ selectedSeasonId: null, selectedEpisodeId: null })
}));
