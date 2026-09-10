import { Redirect , useLocalSearchParams } from "expo-router";
import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";

import { LibraryShareScreenContent } from "@/components/library/LibraryShareScreenContent";

function LibraryShareQueryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const shareId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <LibraryShareScreenContent shareId={shareId} />;
}

export default function MvpRoute() { return EXTENDED_FEATURES_ENABLED ? <LibraryShareQueryScreen /> : <Redirect href="/library" />; }
