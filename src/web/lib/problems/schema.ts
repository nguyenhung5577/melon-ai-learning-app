import { z } from "zod";

export const ParsedChoiceSchema = z.object({
  key: z.string(),
  text: z.string(),
});

export const ParsedSubQuestionSchema = z.object({
  label: z.string(),
  stem: z.string(),
  answerText: z.string().optional(),
  explanation: z.string().optional(),
});

export const QuestionSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  grade: z.number().int().min(1).max(12),
  subject: z.literal("math"),
  language: z.enum(["vi", "en"]),
  sourceFiles: z.array(z.string()),
});

export const ParsedQuestionSchema = z.object({
  id: z.string(),
  questionSetId: z.string(),
  grade: z.number().int().min(1).max(12),
  subject: z.literal("math"),
  section: z.string(),
  questionNumber: z.number().int().min(1),
  type: z.enum(["multiple_choice", "short_answer", "essay"]),
  stem: z.string(),
  choices: z.array(ParsedChoiceSchema),
  subQuestions: z.array(ParsedSubQuestionSchema),
  answer: z.string(),
  answerText: z.string(),
  answerSource: z.enum(["provided", "generated", "unknown"]),
  explanation: z.string(),
  imageUrls: z.array(z.string()),
  visualDescription: z.string(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  concepts: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
});

export const RubricLevelSchema = z.enum([
  "unclassified",
  "nhan_biet",
  "thong_hieu",
  "van_dung",
  "van_dung_cao",
]);

export const QuestionBankQuestionSchema = ParsedQuestionSchema.extend({
  sourceSetId: z.string(),
  sourceTitle: z.string(),
  sourceFiles: z.array(z.string()),
  sourcePageRange: z.string().optional(),
  rubricLevel: RubricLevelSchema,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  classifiedAt: z.string().nullable().optional(),
});

export const ProblemParseResultSchema = z.object({
  questionSet: QuestionSetSchema,
  questions: z.array(ParsedQuestionSchema),
});

export const ProblemParseSetSchema = ProblemParseResultSchema.extend({
  label: z.string().optional(),
  pageRange: z.string().optional(),
});

export const ProblemParseBatchResultSchema = z.object({
  mode: z.literal("batch"),
  sets: z.array(ProblemParseSetSchema),
});

export const ProblemParseResponseSchema = z.union([
  ProblemParseResultSchema,
  ProblemParseBatchResultSchema,
]);

export type ProblemParseResultInput = z.infer<typeof ProblemParseResultSchema>;
