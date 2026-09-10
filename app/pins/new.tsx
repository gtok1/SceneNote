import { StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { PinComposer } from "@/components/pins/PinComposer";
import { colors } from "@/constants/theme";

export default function NewPinScreen() {
  const params = useLocalSearchParams<{
    contentId?: string;
    episodeId?: string;
  }>();
  const router = useRouter();

  if (!params.contentId) return <EmptyState title="콘텐츠 정보가 필요합니다" />;

  return (
    <View style={styles.container}>
      <PinComposer
        contentId={params.contentId}
        episodeId={params.episodeId || null}
        mode="create"
        onCancel={() => router.canGoBack() ? router.back() : router.replace("/pins")}
        onSuccess={(created) =>
          router.dismissTo({ pathname: "/content/[id]/pins", params: { id: created.content_id, ...(created.episode_id ? { episodeId: created.episode_id } : {}) } })
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
