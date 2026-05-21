import { promises as fs } from "fs";
import path from "path";
import type {
  DailyProgressPoint,
  LessonCompletionInput,
  LessonCompletionRecord,
  ProgressSummary,
  SubjectProgressPoint,
} from "./types";

const DATA_DIR = path.join(process.cwd(), ".melon-progress");
const DATA_FILE = path.join(DATA_DIR, "lesson-completions.json");

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeLevel(xp: number): number {
  return Math.floor(Math.max(0, xp) / 200) + 1;
}

function toDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function toUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyDailyWindow(days = 7): DailyProgressPoint[] {
  const points: DailyProgressPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = toUtcDateKey(d);
    points.push({
      date,
      day: toDayLabel(date),
      lessonsCompleted: 0,
      timeOnTaskMinutes: 0,
      xpEarned: 0,
      averageQuizScore: 0,
    });
  }
  return points;
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readRecords(): Promise<LessonCompletionRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records: LessonCompletionRecord[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

function normalizeCompletion(input: LessonCompletionInput): LessonCompletionRecord {
  const quizTotal = Math.max(0, Math.floor(input.quizTotal));
  const quizCorrect = Math.max(0, Math.min(quizTotal, Math.floor(input.quizCorrect)));
  const quizScorePercent = quizTotal > 0 ? clampPercent((quizCorrect / quizTotal) * 100) : 0;

  return {
    ...input,
    id: `${input.childUid}-${input.lessonId}-${Date.now()}`,
    subject: input.subject || "unknown",
    scorePercent: clampPercent(input.scorePercent),
    quizCorrect,
    quizTotal,
    quizScorePercent,
    xpEarned: Math.max(0, Math.round(input.xpEarned)),
    timeOnTaskSeconds: Math.max(0, Math.round(input.timeOnTaskSeconds)),
    completedAt: input.completedAt ?? new Date().toISOString(),
  };
}

export async function recordLessonCompletion(
  input: LessonCompletionInput
): Promise<LessonCompletionRecord> {
  const records = await readRecords();
  const record = normalizeCompletion(input);
  records.push(record);
  await writeRecords(records);
  return record;
}

function demoRecords(childUid: string): LessonCompletionRecord[] {
  const now = new Date();
  const seed: Array<Omit<LessonCompletionInput, "childUid" | "completedAt"> & { daysAgo: number }> = [
    {
      daysAgo: 6,
      lessonId: "lesson-001",
      lessonTitle: "What is Photosynthesis?",
      subject: "science",
      scorePercent: 92,
      quizCorrect: 2,
      quizTotal: 2,
      xpEarned: 150,
      timeOnTaskSeconds: 1080,
    },
    {
      daysAgo: 5,
      lessonId: "lesson-002",
      lessonTitle: "Fractions Made Easy",
      subject: "math",
      scorePercent: 85,
      quizCorrect: 2,
      quizTotal: 3,
      xpEarned: 180,
      timeOnTaskSeconds: 1500,
    },
    {
      daysAgo: 3,
      lessonId: "lesson-003",
      lessonTitle: "The Water Cycle",
      subject: "science",
      scorePercent: 100,
      quizCorrect: 1,
      quizTotal: 1,
      xpEarned: 120,
      timeOnTaskSeconds: 900,
    },
    {
      daysAgo: 1,
      lessonId: "lesson-005",
      lessonTitle: "Intro to Python: Variables",
      subject: "coding",
      scorePercent: 75,
      quizCorrect: 1,
      quizTotal: 2,
      xpEarned: 220,
      timeOnTaskSeconds: 1260,
    },
  ];

  return seed.map((item) => {
    const completedAt = new Date(now);
    completedAt.setUTCDate(now.getUTCDate() - item.daysAgo);
    return normalizeCompletion({
      ...item,
      childUid,
      completedAt: completedAt.toISOString(),
    });
  }).map((record, index) => ({
    ...record,
    id: `${childUid}-demo-${index + 1}`,
  }));
}

export async function getLessonCompletions(childUid: string): Promise<LessonCompletionRecord[]> {
  const records = await readRecords();
  const childRecords = records.filter((record) => record.childUid === childUid);
  if (childRecords.length === 0 && childUid === "demo-child") {
    return demoRecords(childUid);
  }
  return childRecords;
}

export async function getProgressSummary(childUid: string): Promise<ProgressSummary> {
  const records = (await getLessonCompletions(childUid)).sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  );

  const totalLessonsCompleted = records.length;
  const totalTimeOnTaskSeconds = records.reduce(
    (sum, record) => sum + record.timeOnTaskSeconds,
    0
  );
  const totalXpEarned = records.reduce((sum, record) => sum + record.xpEarned, 0);
  const averageQuizScore = average(
    records.filter((record) => record.quizTotal > 0).map((record) => record.quizScorePercent)
  );

  const daily = emptyDailyWindow();
  const dailyScores = new Map<string, number[]>();
  const dailyByDate = new Map(daily.map((point) => [point.date, point]));

  for (const record of records) {
    const date = record.completedAt.slice(0, 10);
    const point = dailyByDate.get(date);
    if (!point) continue;
    point.lessonsCompleted += 1;
    point.timeOnTaskMinutes += Math.round(record.timeOnTaskSeconds / 60);
    point.xpEarned += record.xpEarned;
    if (record.quizTotal > 0) {
      dailyScores.set(date, [...(dailyScores.get(date) ?? []), record.quizScorePercent]);
    }
  }

  for (const point of daily) {
    point.averageQuizScore = average(dailyScores.get(point.date) ?? []);
  }

  const subjectGroups = new Map<string, LessonCompletionRecord[]>();
  for (const record of records) {
    subjectGroups.set(record.subject, [...(subjectGroups.get(record.subject) ?? []), record]);
  }

  const subjectBreakdown: SubjectProgressPoint[] = Array.from(subjectGroups.entries())
    .map(([name, subjectRecords]) => ({
      name,
      lessonsCompleted: subjectRecords.length,
      timeOnTaskMinutes: Math.round(
        subjectRecords.reduce((sum, record) => sum + record.timeOnTaskSeconds, 0) / 60
      ),
      averageQuizScore: average(
        subjectRecords
          .filter((record) => record.quizTotal > 0)
          .map((record) => record.quizScorePercent)
      ),
    }))
    .sort((a, b) => b.lessonsCompleted - a.lessonsCompleted);

  const conceptsToReinforce = subjectBreakdown
    .filter((subject) => subject.averageQuizScore > 0 && subject.averageQuizScore < 80)
    .map((subject) => subject.name);

  return {
    childUid,
    totalLessonsCompleted,
    totalTimeOnTaskSeconds,
    totalXpEarned,
    averageQuizScore,
    level: computeLevel(totalXpEarned),
    daily,
    subjectBreakdown,
    recentCompletions: records.slice(0, 5),
    conceptsToReinforce,
  };
}
