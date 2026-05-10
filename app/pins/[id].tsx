import { StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PinComposer } from "@/components/pins/PinComposer";
import { colors } from "@/constants/theme";
import { usePin } from "@/hooks/useTimelinePins";

export default function PinDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const router = useRouter();
  const pin = usePin(id);

  if (pin.isLoading) return <LoadingSkeleton variant="pin-item" />;
  if (pin.isError) return <ErrorState message={pin.error.message} onRetry={() => pin.refetch()} />;
  if (!pin.data) return <EmptyState title="핀을 찾을 수 없습니다" />;

  return (
    <View style={styles.container}>
      <PinComposer
        contentId={pin.data.content_id}
        defaultValues={pin.data}
        episodeId={pin.data.episode_id}
        mode="edit"
        onCancel={() => router.back()}
        onSuccess={(updated) => router.replace({ pathname: "/pins/[id]", params: { id: updated.id } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  }
});
