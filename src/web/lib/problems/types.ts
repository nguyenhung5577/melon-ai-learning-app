export type ProblemLanguage = "vi" | "en";
export type ProblemSubject = "math";
export type ProblemType = "multiple_choice" | "short_answer" | "essay";
export type AnswerSource = "provided" | "generated" | "unknown";
export type RubricLevel =
  | "unclassified"
  | "nhan_biet"
  | "thong_hieu"
  | "van_dung"
  | "van_dung_cao";

export interface ParsedChoice {
  key: string;
  text: string;
  textMarkdown?: string;
}

export interface ParsedSubQuestion {
  label: string;
  stem: string;
  stemMarkdown?: string;
  answerText?: string;
  answerTextMarkdown?: string;
  explanation?: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  grade: number;
  subject: ProblemSubject;
  language: ProblemLanguage;
  sourceFiles: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ParsedQuestion {
  id: string;
  questionSetId: string;
  grade: number;
  subject: ProblemSubject;
  section: string;
  questionNumber: number;
  type: ProblemType;
  stem: string;
  stemMarkdown?: string;
  choices: ParsedChoice[];
  subQuestions: ParsedSubQuestion[];
  answer: string;
  answerText: string;
  answerTextMarkdown?: string;
  answerSource: AnswerSource;
  explanation: string;
  imageUrls: string[];
  visualDescription: string;
  visualDescriptionMarkdown?: string;
  rawText: string;
  rawTextMarkdown?: string;
  confidence: number;
  concepts?: string[];
  skills?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionBankQuestion extends ParsedQuestion {
  sourceSetId: string;
  sourceTitle: string;
  sourceFiles: string[];
  sourcePageRange?: string;
  rubricLevel: RubricLevel;
  createdBy?: string;
  updatedBy?: string;
  classifiedAt?: string | null;
}

export interface QuestionBankMeta {
  id: string;
  grade: 4 | 5;
  rubricLevel: RubricLevel;
  label: string;
  questionCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionAttempt {
  id: string;
  kidUid: string;
  questionId: string;
  kidQuestionKey: string;
  submittedAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  startedAt: string;
  submittedAt: string;
  source: "practice" | "student_submission" | "question_bank";
}

export interface KidQuestionStats {
  id: string;
  kidUid: string;
  questionId: string;
  kidQuestionKey: string;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  lastIsCorrect: boolean;
  lastSubmittedAt: string;
  lastTimeSpentMs: number;
}

export interface ProblemParseResult {
  questionSet: QuestionSet;
  questions: ParsedQuestion[];
}

export interface ProblemParseSet extends ProblemParseResult {
  label?: string;
  pageRange?: string;
}

export interface ProblemParseBatchResult {
  mode: "batch";
  sets: ProblemParseSet[];
}

export type ProblemParseResponse = ProblemParseResult | ProblemParseBatchResult;

export interface StudentSubmission {
  id: string;
  uid: string;
  questionSetId: string;
  title?: string;
  grade?: number;
  subject?: ProblemSubject;
  questionCount?: number;
  sourceFiles: string[];
  questionSet?: QuestionSet;
  questions?: ParsedQuestion[];
  createdAt: string;
  updatedAt?: string;
}

export interface ParseJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  uid?: string;
  questionSetId?: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
}
