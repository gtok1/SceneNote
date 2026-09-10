import { Pressable, Text } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { colors } from "@/constants/theme";

export function StackBackButton() {
  const router = useRouter();
  const path = usePathname();
  return <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => {
    if (router.canGoBack()) router.back();
    else router.replace(path.startsWith("/pins") ? "/pins" : "/library");
  }} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}>
    <Text style={{ color: colors.primary, fontSize: 16 }}>‹ 뒤로</Text>
  </Pressable>;
}
