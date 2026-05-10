import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import {
  createPin,
  deletePin,
  getAllPins,
  getPin,
  getPinsByContent,
  getPinsByEpisode,
  getPinsByTag,
  updatePin
} from "@/services/pins";
import { useAuthStore } from "@/stores/authStore";
import type { PinInput } from "@/types/pins";

export function useAllPins() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.pins.all(user?.id ?? "anonymous"),
    queryFn: getAllPins,
    enabled: Boolean(user),
    staleTime: 30_000
  });
}

export function usePinsByContent(contentId: string | undefined) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.pins.byContent(user?.id ?? "anonymous", contentId ?? ""),
    queryFn: () => getPinsByContent(contentId ?? ""),
    enabled: Boolean(user && contentId),
    staleTime: 30_000
  });
}

export function usePinsByEpisode(episodeId: string | undefined) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.pins.byEpisode(user?.id ?? "anonymous", episodeId ?? ""),
    queryFn: () => getPinsByEpisode(episodeId ?? ""),
    enabled: Boolean(user && episodeId),
    staleTime: 30_000
  });
}

export function usePinsByTag(tagId: string | undefined) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.pins.byTag(user?.id ?? "anonymous", tagId ?? ""),
    queryFn: () => getPinsByTag(tagId ?? ""),
    enabled: Boolean(user && tagId),
    staleTime: 30_000
  });
}

export function usePin(pinId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pins.single(pinId ?? ""),
    queryFn: () => getPin(pinId ?? ""),
    enabled: Boolean(pinId),
    staleTime: 30_000
  });
}

export function useCreatePin() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: createPin,
    onSuccess: (pin) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.pins.all(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pins.byContent(user.id, pin.content_id) });
      if (pin.episode_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pins.byEpisode(user.id, pin.episode_id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all(user.id) });
    }
  });
}

export function useUpdatePin(pinId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (input: Omit<PinInput, "content_id" | "episode_id">) =>
      updatePin(pinId ?? "", input),
    onSuccess: (pin) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.pins.single(pin.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pins.all(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pins.byContent(user.id, pin.content_id) });
      if (pin.episode_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pins.byEpisode(user.id, pin.episode_id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all(user.id) });
    }
  });
}

export function useDeletePin() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: deletePin,
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pins.all(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tags.all(user.id) });
      }
    }
  });
}
