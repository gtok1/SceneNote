import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Link } from "expo-router";

import { colors, radius, spacing } from "@/constants/theme";

const slides: readonly [
  { title: string; body: string },
  { title: string; body: string },
  { title: string; body: string }
] = [
  {
    title: "장면을 기억하세요",
    body: "애니, 드라마, 영화를 보다가 다시 보고 싶은 순간을 시간과 함께 남깁니다."
  },
  {
    title: "에피소드별로 정리",
    body: "시즌과 에피소드 흐름 안에서 감상 상태, 진행률, 장면 메모를 이어갑니다."
  },
  {
    title: "스포일러는 가볍게 가림",
    body: "중요한 장면은 스포일러로 표시하고, 필요할 때만 열어볼 수 있습니다."
  }
] as const;

const firstSlide = slides[0];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? firstSlide;
  const isLast = index === slides.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {slides.map((item, itemIndex) => (
          <View
            key={item.title}
            style={[styles.dot, itemIndex === index ? styles.dotActive : null]}
          />
        ))}
      </View>

      <View style={styles.copy}>
        <Text style={styles.logo}>SceneNote</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      {isLast ? (
        <View style={styles.actions}>
          <Link asChild href="/sign-up">
            <Pressable accessibilityRole="button" style={styles.primaryButton}>
              <Text style={styles.primaryText}>계정 만들기</Text>
            </Pressable>
          </Link>
          <Link href="/sign-in" style={styles.link}>
            이미 계정이 있어요
          </Link>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIndex((current) => Math.min(current + 1, slides.length - 1))}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>다음</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.xl
  },
  dots: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingTop: spacing.xxl
  },
  dot: {
    backgroundColor: colors.border,
    borderRadius: 4,
    height: 8,
    width: 8
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24
  },
  copy: {
    gap: spacing.lg
  },
  logo: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  body: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 25
  },
  actions: {
    gap: spacing.md
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
  }
});
