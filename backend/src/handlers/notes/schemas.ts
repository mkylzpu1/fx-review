import { z } from "zod";

const Title = z
  .string()
  .trim()
  .min(1, "タイトルを入力してください")
  .max(120, "タイトルは120文字までです");
const Body = z.string().trim().max(5000, "本文は5000文字までです");
const Tags = z
  .array(z.string().trim().min(1).max(30))
  .max(10, "感情タグは10個までです");
const NextRule = z.string().trim().max(300, "次回のルールは300文字までです");

/** POST /notes（自分の気づき） */
export const SelfNoteSchema = z.object({
  title: Title,
  body: Body.optional(),
  emotionTags: Tags.optional(),
  nextRule: NextRule.nullable().optional(),
  sourceTradeId: z
    .string()
    .uuid("トレードの指定が正しくありません")
    .nullable()
    .optional(),
});

/** PUT /notes/{id} */
export const NotePatchSchema = z.object({
  title: Title.optional(),
  body: Body.optional(),
  emotionTags: Tags.optional(),
  nextRule: NextRule.nullable().optional(),
});

export const AI_NAMES = ["Claude", "ChatGPT", "Gemini", "その他"] as const;
/** 貼り付けられる回答の上限（API Gatewayの上限に余裕を持たせる） */
export const MAX_RAW_CHARS = 100_000;

/** POST /notes/ai */
export const AiNoteSchema = z.object({
  aiName: z.enum(AI_NAMES, {
    errorMap: () => ({
      message: `使ったAIは ${AI_NAMES.join(" / ")} から選んでください`,
    }),
  }),
  dataRangeLabel: z.string().trim().max(60).nullable().optional(),
  rawResponse: z
    .string()
    .trim()
    .min(1, "AIの回答を貼り付けてください")
    .max(
      MAX_RAW_CHARS,
      `回答が長すぎます（${MAX_RAW_CHARS.toLocaleString("ja-JP")}文字まで）。要点だけを貼り付けてください`,
    ),
  title: Title.nullable().optional(),
});

export const ListQuerySchema = z.object({
  kind: z.enum(["ai", "self"]).optional(),
  validating: z.enum(["true", "false"]).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/, "pageは1以上の整数で指定してください")
    .optional(),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "limitは1以上の整数で指定してください")
    .optional(),
});
