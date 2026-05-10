import { View } from "react-native";

import { FlashList } from "@shopify/flash-list";
import { useAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import type { TimelinePin } from "@/types/pins";
import { PinTimelineItem } from "./PinTimelineItem";

interface PinTimelineListProps {
  pins: TimelinePin[];
  isLoading?: boolean;
  hasError?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  onPinPress: (pin: TimelinePin) => void;
}

export function PinTimelineList({
  pins,
  isLoading = false,
  hasError = false,
  emptyTitle = "아직 핀이 없어요",
  emptyDescription = "첫 장면 기록을 남겨보세요.",
  onRetry,
  onPinPress
}: PinTimelineListProps) {
  const [revealedSpoilers, setRevealedSpoilers] = useAtom(revealedSpoilerPinIdsAtom);

  if (isLoading) return <LoadingSkeleton variant="pin-item" count={4} />;
  if (hasError) return onRetry ? <ErrorState onRetry={onRetry} /> : <ErrorState />;

  return (
    <FlashList
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={<EmptyState title={emptyTitle} description={emptyDescription} />}
      data={pins}
      drawDistance={384}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PinTimelineItem
          isSpoilerRevealed={revealedSpoilers.has(item.id)}
          onPress={() => onPinPress(item)}
          onRevealSpoiler={() =>
            setRevealedSpoilers((previous) => new Set([...previous, item.id]))
          }
          pin={item}
        />
      )}
    />
  );
}
