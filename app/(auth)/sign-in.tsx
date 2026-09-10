import { KeyboardScreen } from "@/components/common/KeyboardScreen";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter, type Href } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { authSchema } from "@/utils/validation";

type AuthFormValues = z.infer<typeof authSchema>;
const forgotPasswordHref = "/forgot-password" as Href;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { control, handleSubmit, formState, setFocus } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" }
  });

  const submit = handleSubmit((values) => {
    signIn.mutate(values, {
      onSuccess: () => router.replace("/")
    });
  });

  return (
    <KeyboardScreen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>SceneNote</Text>
        <Text style={styles.subtitle}>내 장면 기록으로 바로 돌아가기</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <View style={styles.field}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>이메일</Text>
              <TextInput
                ref={field.ref}
                accessibilityLabel="이메일"
                aria-invalid={Boolean(fieldState.error)}
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => setFocus("password")}
                                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="이메일"
                style={styles.input}
                value={field.value}
              />
              {fieldState.error ? <Text accessibilityRole="alert" style={styles.error}>{fieldState.error.message}</Text> : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <View style={styles.field}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>비밀번호</Text>
              <TextInput
                ref={field.ref}
                accessibilityLabel="비밀번호"
                aria-invalid={Boolean(fieldState.error)}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={submit}
                                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="비밀번호"
                secureTextEntry
                style={styles.input}
                value={field.value}
              />
              {fieldState.error ? <Text accessibilityRole="alert" style={styles.error}>{fieldState.error.message}</Text> : null}
            </View>
          )}
        />
        {signIn.error ? <Text accessibilityRole="alert" style={styles.error}>{signIn.error.message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={formState.isSubmitting || signIn.isPending}
          onPress={submit}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>{signIn.isPending ? "로그인 중" : "로그인"}</Text>
        </Pressable>
        <Link href="/sign-up" asChild><Pressable accessibilityRole="link" style={styles.link}><Text style={{ color: colors.primary, textAlign: "center" }}>계정 만들기</Text></Pressable></Link>
        <Link href={forgotPasswordHref} asChild><Pressable accessibilityRole="link" style={styles.passwordSetupLink}><Text style={{ color: colors.primary, textAlign: "center" }}>비밀번호 설정/재설정</Text></Pressable></Link>
        <Link href="/onboarding" asChild><Pressable accessibilityRole="link" style={styles.secondaryLink}><Text style={{ color: colors.primary, textAlign: "center" }}>처음 사용하는 분들을 위한 안내</Text></Pressable></Link>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xxl
  },
  logo: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15
  },
  form: {
    gap: spacing.md
  },
  field: {
    gap: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 16,
    padding: spacing.lg
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  primaryText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "800"
  },
  link: {
    minHeight: 48,
    minWidth: 44,
    paddingVertical: 14,
    color: colors.primary,
    fontWeight: "700",
    padding: spacing.md,
    textAlign: "center"
  },
  secondaryLink: {
    minHeight: 48,
    minWidth: 44,
    paddingVertical: 14,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  passwordSetupLink: {
    minHeight: 48,
    minWidth: 44,
    paddingVertical: 14,
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    padding: spacing.sm,
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 12
  }
});
