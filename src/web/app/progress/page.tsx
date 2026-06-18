"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Clock3, Sparkles, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { XPBar } from "@/components/shared/XPBar";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { NbButton } from "@/components/shared/NbButton";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { useAuthContext } from "@/lib/auth/auth-context";
import type {
  CourseRunSnapshot,
  ProgressSummary,
  StudentPersonalizedPlanRecord,
} from "@/lib/progress/types";
import { cn } from "@/lib/utils";

function xpToNextLevel(totalXp: number, level: number) {
  return Math.max(0, (level * 200) - totalXp);
}

function formatMinutes(totalSeconds: number) {
  return Math.max(1, Math.round(totalSeconds / 60));
}

function conceptLabel(value: string) {
  const labels: Record<string, string> = {
    arithmetic: "Số học",
    fractions: "Phân số",
    geometry: "Hình học",
    word_problems: "Toán có lời văn",
    logic: "Tư duy logic",
    mixed_exams: "Đề tổng hợp",
    decimals: "Số thập phân",
  };
  return labels[value] ?? value.replace(/[_-]+/g, " ");
}

function actionTitle(action: NonNullable<StudentPersonalizedPlanRecord["nextBestActions"]>[number]) {
  return action.title;
}

function masteryLabel(value?: string) {
  switch (value) {
    case "mastered":
      return "Đã vững";
    case "developing":
      return "Đang khá dần";
    case "in_progress":
      return "Cần luyện thêm";
    default:
      return "Chưa rõ";
  }
}

function difficultyLabel(rubricLevels: string[]) {
  if (rubricLevels.includes("van_dung_cao")) return "Mức vận dụng cao";
  if (rubricLevels.includes("van_dung")) return "Mức vận dụng";
  if (rubricLevels.includes("thong_hieu")) return "Mức thông hiểu";
  return "Mức nhận biết";
}

export default function ProgressPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [plan, setPlan] = useState<StudentPersonalizedPlanRecord | null>(null);
  const [courseRuns, setCourseRuns] = useState<CourseRunSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [progressRes, runsRes] = await Promise.all([
          fetch(`/api/v1/progress/${uid}`, { cache: "no-store" }),
          fetch(`/api/v1/course-run/${uid}?status=all`, { cache: "no-store" }),
        ]);

        const progressData = await progressRes.json();
        const runsData = await runsRes.json();

        if (!progressRes.ok) {
          throw new Error(progressData.error ?? "Không tải được tiến độ.");
        }
        if (!runsRes.ok) {
          throw new Error(runsData.error ?? "Không tải được lộ trình học.");
        }

        if (!mounted) return;
        setSummary(progressData.summary as ProgressSummary);
        setPlan(progressData.plan as StudentPersonalizedPlanRecord);
        setCourseRuns((runsData.runs ?? []) as CourseRunSnapshot[]);
      } catch {
        if (!mounted) return;
        setSummary(null);
        setPlan(null);
        setCourseRuns([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const activeRuns = useMemo(
    () => courseRuns.filter((snapshot) => snapshot.run.status === "active"),
    [courseRuns]
  );
  const currentRun = useMemo(() => activeRuns[0] ?? null, [activeRuns]);
  const totalXp = summary?.totalXpEarned ?? 0;
  const level = summary?.level ?? 1;
  const nextActions = plan?.nextBestActions?.slice(0, 3) ?? [];
  const weaknessSummary = useMemo(() => plan?.weaknessSummary?.slice(0, 4) ?? [], [plan]);
  const activeRunsByConcept = useMemo(
    () => new Map(activeRuns.map((snapshot) => [snapshot.course.primaryConcept, snapshot] as const)),
    [activeRuns]
  );
  const attentionItems = useMemo(
    () =>
      weaknessSummary
        .filter((item) => item.needsAttention || item.accuracy < 85 || item.masteryState !== "mastered")
        .map((item) => ({
          ...item,
          run: activeRunsByConcept.get(item.concept) ?? null,
        })),
    [activeRunsByConcept, weaknessSummary]
  );

  if (!user) {
    return (
      <KidShell onLogin={() => setAuthOpen(true)}>
        <SectionContainer>
          <div className="py-12 text-center">
            <p className="mb-4 font-display text-lg">Đăng nhập để xem tiến độ của con</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>Đăng nhập</NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </KidShell>
    );
  }

  return (
    <KidShell
      userName={user.displayName ?? undefined}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <KidOnlyGuard>
        <section className="bg-gradient-to-br from-nb-purple via-nb-pink to-nb-yellow px-6 py-10 [border-bottom:var(--nb-border)]">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-nb-yellow text-4xl [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
              {user.displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-bold opacity-80">Tiến độ học tập của</p>
              <h1 className="font-display text-h1 text-nb-black">
                {user.displayName ?? "Learner"}
              </h1>
              {summary ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-nb-black px-2 py-0.5 font-display text-[0.7rem] uppercase text-nb-yellow">
                    Level {summary.level}
                  </span>
                  <NbPill color="yellow" icon={<Zap className="w-3 h-3" />}>
                    {summary.totalXpEarned.toLocaleString()} xp
                  </NbPill>
                </div>
              ) : null}
            </div>
          </div>

          {summary ? (
            <XPBar
              totalXp={totalXp}
              level={level}
              xpToNextLevel={xpToNextLevel(totalXp, level)}
            />
          ) : null}
        </section>

        {loading ? (
          <SectionContainer>
            <div className="rounded-2xl border-2 border-dashed border-nb-black/20 py-16 text-center">
              <p className="font-display text-sm text-[#666]">Đang tải tiến độ</p>
            </div>
          </SectionContainer>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-[4px] [background:var(--nb-black)] [border-bottom:var(--nb-border)] md:grid-cols-4">
              {[
                { icon: <BookOpen className="w-4 h-4" />, value: summary.totalLessonsCompleted, label: "Bài đã xong", color: "text-nb-green" },
                { icon: <Zap className="w-4 h-4" />, value: totalXp, label: "Tổng XP", color: "text-nb-orange" },
                { icon: <TrendingUp className="w-4 h-4" />, value: `${summary.averageQuizScore}%`, label: "Quiz trung bình", color: "text-nb-blue" },
                { icon: <Clock3 className="w-4 h-4" />, value: `${formatMinutes(summary.totalTimeOnTaskSeconds)}m`, label: "Thời gian học", color: "text-nb-yellow" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center justify-center gap-1 bg-white p-6">
                  <div className={cn("flex h-6 w-6 items-center justify-center", item.color)}>{item.icon}</div>
                  <div className={cn("font-display text-3xl leading-none", item.color)}>{item.value}</div>
                  <div className="text-center text-sm font-bold uppercase text-nb-black">{item.label}</div>
                </div>
              ))}
            </div>

            <SectionContainer>
              {currentRun ? (
                <div className="mb-8 rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <NbPill color="green" icon={<Target className="w-3 h-3" />}>Hiện tại</NbPill>
                        <NbPill color="orange">{currentRun.currentStage.title}</NbPill>
                      </div>
                      <h2 className="mt-3 font-display text-lg">{currentRun.course.title}</h2>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                        {currentRun.run.personalizedReason}
                      </p>
                    </div>
                    <Link
                      href={`/study?courseRunId=${encodeURIComponent(currentRun.run.id)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-nb-black px-5 py-3 font-display text-[0.8rem] text-white [box-shadow:4px_4px_0_var(--nb-orange)]"
                    >
                      Mở lộ trình
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ) : null}

              {nextActions.length > 0 || attentionItems.length > 0 ? (
                <div className={cn("grid grid-cols-1 gap-6", nextActions.length > 0 && attentionItems.length > 0 && "xl:grid-cols-[1.1fr_0.9fr]")}>
                  {nextActions.length > 0 ? (
                    <section className="rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
                      <SectionHeader
                        title="Melon đang ưu tiên gì?"
                        badge={<NbPill color="green" icon={<Sparkles className="w-3 h-3" />}>{nextActions.length} bước</NbPill>}
                      />
                      <div className="mt-4 flex flex-col gap-3">
                        {nextActions.map((action) => (
                          <div key={action.id} className="rounded-xl border-2 border-nb-black bg-[#fff9ed] p-4 [box-shadow:3px_3px_0_var(--nb-black)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <NbPill color="yellow">Ưu tiên {action.priority}</NbPill>
                              <NbPill color="blue">{difficultyLabel(action.rubricLevels)}</NbPill>
                              <NbPill color="green">{action.questionCount} câu</NbPill>
                              {action.concepts.slice(0, 2).map((concept) => (
                                <NbPill key={concept} color="orange">{conceptLabel(concept)}</NbPill>
                              ))}
                            </div>
                            <h3 className="mt-3 font-display text-sm">{actionTitle(action)}</h3>
                            <p className="mt-2 text-sm font-bold leading-relaxed text-nb-black">{action.reason}</p>
                            <div className="mt-3 text-sm font-semibold text-[#555]">
                              Dạng bài tiếp theo: <strong>{action.description}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {attentionItems.length > 0 ? (
                    <section className="rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
                      <SectionHeader
                        title="Các phần cần để ý"
                        badge={<NbPill color="orange">{attentionItems.length} mảng</NbPill>}
                      />
                      <div className="mt-4 flex flex-col gap-3">
                        {attentionItems.map((item) => (
                          <div key={item.concept} className="rounded-xl border-2 border-nb-black bg-white p-4 [box-shadow:3px_3px_0_var(--nb-black)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <NbPill color="orange">{conceptLabel(item.concept)}</NbPill>
                              <NbPill color="blue">{masteryLabel(item.masteryState)}</NbPill>
                              <NbPill color="yellow">{item.accuracy}% đúng</NbPill>
                              <NbPill color="green">{item.attempts} lượt</NbPill>
                            </div>
                            {item.run ? (
                              <div className="mt-3 rounded-xl border-2 border-nb-black bg-[#fff9ed] p-3">
                                <div className="text-[0.68rem] font-black uppercase text-[#666]">Khóa học</div>
                                <div className="mt-1 font-bold">{item.run.course.title}</div>
                                <div className="mt-1 text-sm font-semibold text-[#555]">
                                  Chặng hiện tại: {item.run.currentStage.title}
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm font-semibold text-[#555]">Chưa có khóa học.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}

              <section className="mt-8 rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
                <SectionHeader
                  title="Bài học gần đây"
                  badge={<NbPill color="yellow" icon={<Trophy className="w-3 h-3" />}>{summary.recentCompletions.length} bài</NbPill>}
                />
                <div className="mt-4 flex flex-col gap-3">
                  {summary.recentCompletions.length === 0 ? (
                    <p className="text-sm font-semibold text-[#666]">Chưa có bài hoàn thành nào để hiển thị.</p>
                  ) : summary.recentCompletions.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 rounded-xl bg-white px-4 py-3 [border:var(--nb-border-thin)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
                    >
                      <div>
                        <div className="font-bold text-sm">{item.lessonTitle}</div>
                        <div className="text-[0.65rem] font-bold uppercase text-[#666]">
                          {new Date(item.completedAt).toLocaleDateString("vi-VN")}
                        </div>
                      </div>
                      <NbPill color="orange">Quiz {item.quizScorePercent}%</NbPill>
                      <NbPill color="blue">{Math.round(item.timeOnTaskSeconds / 60)} phút</NbPill>
                    </div>
                  ))}
                </div>
              </section>
            </SectionContainer>
          </>
        ) : (
          <SectionContainer>
            <div className="rounded-2xl border-2 border-dashed border-nb-black/20 py-16 text-center">
              <p className="font-display text-sm text-[#666]">Chưa có tiến độ.</p>
            </div>
          </SectionContainer>
        )}
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
