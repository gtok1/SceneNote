import type { EmotionType } from "@/types/pins";

export const EMOTION_LABELS: Record<EmotionType, string> = {
  excited: "설렘",
  moved: "감동",
  funny: "즐거움",
  sad: "슬픔",
  surprised: "놀람",
  angry: "분노",
  scared: "공포",
  love: "사랑",
  boring: "지루함",
  none: "없음"
};

export const EMOTION_OPTIONS: EmotionType[] = [
  "moved",
  "excited",
  "funny",
  "sad",
  "surprised",
  "angry",
  "scared",
  "love",
  "boring",
  "none"
];
