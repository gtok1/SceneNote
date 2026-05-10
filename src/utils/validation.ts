import { z } from "zod";

import type { EmotionType } from "@/types/pins";
import { isTimeWithinEpisode } from "./timecode";

export const emotionSchema = z.enum([
  "excited",
  "moved",
  "funny",
  "sad",
  "surprised",
  "angry",
  "scared",
  "love",
  "boring",
  "none"
] satisfies [EmotionType, ...EmotionType[]]);

export const authSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해 주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다")
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해 주세요")
});

export const passwordUpdateSchema = z
  .object({
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"]
  });

export const createPinSchema = z
  .object({
    timestamp_seconds: z.number().int().min(0).nullable(),
    memo: z.string().max(500, "메모는 500자 이하로 입력해 주세요").nullable(),
    tagNames: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
    emotion: emotionSchema.nullable().default(null),
    is_spoiler: z.boolean().default(false),
    episodeDurationSeconds: z.number().int().positive().nullable().optional()
  })
  .refine(
    (data) =>
      data.timestamp_seconds !== null || (data.memo !== null && data.memo.trim().length > 0),
    {
      message: "타임스탬프 또는 메모 중 하나는 필수입니다",
      path: ["memo"]
    }
  )
  .refine(
    (data) =>
      data.timestamp_seconds === null ||
      isTimeWithinEpisode(data.timestamp_seconds, data.episodeDurationSeconds),
    {
      message: "입력한 시간이 에피소드 길이를 초과했습니다",
      path: ["timestamp_seconds"]
    }
  );

export type CreatePinFormValues = z.infer<typeof createPinSchema>;

export const contentReviewSchema = z
  .object({
    content_id: z.string().uuid("작품 정보가 올바르지 않습니다"),
    rating: z.number().min(0.5).max(10).nullable(),
    one_line_review: z.string().max(120, "한줄 후기는 120자 이하로 입력해 주세요").nullable(),
    body: z.string().max(2000, "소감은 2000자 이하로 입력해 주세요").nullable(),
    is_spoiler: z.boolean().default(false)
  })
  .refine(
    (data) =>
      data.rating !== null ||
      (data.one_line_review !== null && data.one_line_review.trim().length > 0) ||
      (data.body !== null && data.body.trim().length > 0),
    {
      message: "별점, 한줄 후기, 소감 중 하나는 입력해 주세요",
      path: ["body"]
    }
  );

export type ContentReviewFormValues = z.infer<typeof contentReviewSchema>;
