import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ title: "시작하기" }} />
      <Stack.Screen name="sign-in" options={{ title: "로그인" }} />
      <Stack.Screen name="sign-up" options={{ title: "회원가입" }} />
      <Stack.Screen name="forgot-password" options={{ title: "비밀번호 찾기" }} />
      <Stack.Screen name="reset-password" options={{ title: "비밀번호 재설정" }} />
    </Stack>
  );
}
