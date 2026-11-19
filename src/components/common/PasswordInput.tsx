import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  inputRef?: Ref<TextInput>;
}

export function PasswordInput({ inputRef, style, ...inputProps }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const disabled = inputProps.editable === false || inputProps.readOnly === true;

  useFocusEffect(useCallback(() => () => setVisible(false), []));

  return (
    <View style={styles.container}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textSubtle}
        {...inputProps}
        ref={inputRef}
        secureTextEntry={!visible}
        style={[style, styles.input]}
      />
      <Pressable
        accessibilityLabel={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        accessibilityRole="button"
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => setVisible((current) => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Ionicons accessible={false} color={colors.textMuted} name={visible ? "eye-off-outline" : "eye-outline"} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minWidth: 0
  },
  input: {
    paddingRight: 44 + spacing.md
  },
  toggle: {
    position: "absolute",
    right: spacing.sm,
    top: "50%",
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    width: 44,
    height: 44
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.5
  }
});
