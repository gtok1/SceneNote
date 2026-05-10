import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { authSchema } from "@/utils/validation";

type AuthFormValues = z.infer<typeof authSchema>;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { control, handleSubmit } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" }
  });

  const submit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: () => router.replace("/")
    });
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>SceneNote</Text>
        <Text style={styles.subtitle}>기억하고 싶은 장면을 쌓아보세요</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <View style={styles.field}>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="이메일"
                style={styles.input}
                value={field.value}
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <View style={styles.field}>
              <TextInput
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="비밀번호"
                secureTextEntry
                style={styles.input}
                value={field.value}
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </View>
          )}
        />
        {signUp.error ? <Text style={styles.error}>{signUp.error.message}</Text> : null}
        <Pressable accessibilityRole="button" onPress={submit} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{signUp.isPending ? "가입 중" : "회원가입"}</Text>
        </Pressable>
        <Link href="/sign-in" style={styles.link}>
          이미 계정이 있어요
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
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
    color: colors.primary,
    fontWeight: "700",
    padding: spacing.md,
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 12
  }
});
