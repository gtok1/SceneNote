import { Alert, Platform } from "react-native";
export function confirmDiscard(discard: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm("작성한 내용을 버릴까요? 취소하면 계속 작성합니다.")) discard();
    return;
  }
  Alert.alert("작성한 내용을 버릴까요?", "저장하지 않은 내용이 사라집니다.", [
    { text: "계속 작성", style: "cancel" },
    { text: "버리기", style: "destructive", onPress: discard }
  ]);
}
