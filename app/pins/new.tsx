import { StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { PinComposer } from "@/components/pins/PinComposer";
import { colors } from "@/constants/theme";

export default function NewPinScreen() {
  const params = useLocalSearchParams<{
    contentId?: string;
    episodeId?: string;
    duration?: string;
  }>();
  const router = useRouter();

  if (!params.contentId) return <EmptyState title="콘텐츠 정보가 필요합니다" />;

  return (
    <View style={styles.container}>
      <PinComposer
        contentId={params.contentId}
        episodeDurationSeconds={params.duration ? Number(params.duration) : null}
        episodeId={params.episodeId || null}
        mode="create"
        onCancel={() => router.back()}
        onSuccess={(created) =>
          router.replace({ pathname: "/pins/[id]", params: { id: created.id } })
        }
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
