import { useLocalSearchParams } from "expo-router";

import { LibraryShareScreenContent } from "@/components/library/LibraryShareScreenContent";

export default function LibraryShareScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const shareId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <LibraryShareScreenContent shareId={shareId} />;
}
