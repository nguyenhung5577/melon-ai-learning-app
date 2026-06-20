"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Target, Trophy, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { where } from "firebase/firestore";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { userStore, type ChildProfile } from "@/lib/user/user-store";
import { collections } from "@/lib/db/firestore";
import { queryDocuments } from "@/lib/db/firestore-helpers";
import type { KidQuestionStats } from "@/lib/problems/types";
import type { ProgressSummary } from "@/lib/progress/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/auth/firebase";

const PIE_COLORS = ["#b497ff", "#38b6ff", "#ff914d", "#22c55e", "#ffde59"];

const goalLabels = {
  improve_math_score: "Cải thiện điểm Toán",
  specialized_school_exam: "Ôn thi trường chuyên",
  strengthen_current_grade: "Học chắc kiến thức hiện tại",
} as const;

const weakTopicLabels = {
  arithmetic: "Số học",
  fractions: "Phân số",
  geometry: "Hình học",
  word_problems: "Toán lời văn",
  logic: "Tư duy logic",
  mixed_exams: "Đề tổng hợp",
} as const;

export default function ParentDashboard() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleOpenBilling = async () => {
    setPortalLoading(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/v1/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Không thể mở trang thanh toán.");
        setPortalLoading(false);
      }
    } catch {
      toast.error("Lỗi kết nối máy chủ thanh toán.");
      setPortalLoading(false);
    }
  };
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [questionStats, setQuestionStats] = useState<KidQuestionStats[]>([]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  useEffect(() => {
    if (!user || user.role !== "parent") {
      return;
    }

    userStore.getChildrenForParent(user.uid)
      .then(async (kids) => {
        setChildren(kids);

        const child = kids[selectedChildIdx];
        const targetUid = child?.uid || "demo-child";
        const [progressRes, savedQuestionStats] = await Promise.all([
          fetch(`/api/v1/progress/${targetUid}`, { cache: "no-store" }),
          child
            ? queryDocuments(collections.kidQuestionStats, where("kidUid", "==", child.uid))
            : Promise.resolve([] as KidQuestionStats[]),
        ]);
        if (!progressRes.ok) throw new Error("Không tải được tóm tắt tiến độ.");
        const data = (await progressRes.json()) as { summary: ProgressSummary };

        setProgressSummary(data.summary);
        setQuestionStats(savedQuestionStats);
      })
      .catch(() => {
        setProgressSummary(null);
        setQuestionStats([]);
      });
  }, [user, selectedChildIdx]);

  const selectedChild = children[selectedChildIdx];
  const weeklyProgress = progressSummary?.daily ?? [];
  const subjectBreakdown = progressSummary?.subjectBreakdown ?? [];
  
  const metrics = {
    totalWatchMinutes: Math.round((progressSummary?.totalTimeOnTaskSeconds ?? 0) / 60),
    completedExperiences: progressSummary?.totalLessonsCompleted ?? 0,
    averageQuizScore: progressSummary?.averageQuizScore ?? 0,
    conceptsToReinforce: progressSummary?.conceptsToReinforce ?? [],
    xp: progressSummary?.totalXpEarned ?? 0,
  };
  const totalQuestionAttempts = questionStats.reduce((sum, item) => sum + item.attemptCount, 0);
  const totalCorrectAnswers = questionStats.reduce((sum, item) => sum + item.correctCount, 0);
  const questionAccuracy = totalQuestionAttempts > 0
    ? Math.round((totalCorrectAnswers / totalQuestionAttempts) * 100)
    : metrics.averageQuizScore;

  if (!user || user.role !== "parent") {
    return (
      <ParentShell>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Cần tài khoản phụ huynh</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>
              Đăng nhập phụ huynh
            </NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ParentShell>
    );
  }

  return (
    <ParentShell userName={user.displayName ?? undefined} onLogout={handleLogout}>
      <SectionContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <SectionHeader
            title="Bảng phụ huynh"
            subtitle={selectedChild ? `Theo dõi tiến độ của ${selectedChild.displayName}` : "Theo dõi tiến độ của con bằng dữ liệu mẫu"}
            badge={<NbPill color={selectedChild ? "green" : "blue"}>{selectedChild ? "Dữ liệu thật" : "Dữ liệu mẫu"}</NbPill>}
          />
          <NbButton 
            variant="secondary" 
            size="sm" 
            onClick={handleOpenBilling}
            loading={portalLoading}
          >
            <CreditCard className="w-4 h-4 mr-2" /> Quản lý Gói cước
          </NbButton>
        </div>

        {/* Child selector if multiple */}
        {children.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {children.map((child, idx) => (
              <button
                key={child.uid}
                onClick={() => setSelectedChildIdx(idx)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all",
                  "[border:var(--nb-border)]",
                  selectedChildIdx === idx 
                    ? "bg-nb-yellow [box-shadow:var(--nb-shadow-sm)] -translate-y-0.5" 
                    : "bg-white opacity-60 hover:opacity-100"
                )}
              >
                <span className="text-lg">{child.avatarEmoji}</span>
                {child.displayName}
              </button>
            ))}
          </div>
        )}

        {!selectedChild && (
          <div className="nb-card rounded-2xl p-4 mb-8 bg-nb-purple/10 border-nb-purple flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">👋</div>
                <p className="text-sm font-bold">Bạn chưa liên kết tài khoản con nào. Bên dưới đang hiển thị dữ liệu mẫu.</p>
            </div>
            <Link href="/family">
              <NbButton variant="secondary" size="sm">Liên kết tài khoản con</NbButton>
            </Link>
          </div>
        )}

        {selectedChild?.learningPreferences && (
          <div className="nb-card rounded-2xl p-5 mb-8 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-nb-green [border:var(--nb-border)] rounded-full flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm">Mục tiêu học tập</h3>
                <p className="text-xs font-semibold text-[#666]">Thiết lập phụ huynh đã chọn cho con</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-nb-bg rounded-xl [border:var(--nb-border-thin)] p-3">
                <div className="text-[0.65rem] font-black uppercase text-[#666] mb-1">Mục tiêu</div>
                <div className="text-sm font-bold">
                  {goalLabels[selectedChild.learningPreferences.primaryGoal]}
                </div>
              </div>
              <div className="bg-nb-bg rounded-xl [border:var(--nb-border-thin)] p-3">
                <div className="text-[0.65rem] font-black uppercase text-[#666] mb-1">Mục tiêu điểm</div>
                <div className="text-sm font-bold">
                  {selectedChild.learningPreferences.currentScore}/10 → {selectedChild.learningPreferences.targetScore}/10
                </div>
              </div>
              <div className="bg-nb-bg rounded-xl [border:var(--nb-border-thin)] p-3">
                <div className="text-[0.65rem] font-black uppercase text-[#666] mb-1">Lịch học</div>
                <div className="text-sm font-bold">
                  {selectedChild.learningPreferences.sessionMinutes} phút x {selectedChild.learningPreferences.sessionsPerWeek}/tuần
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedChild.learningPreferences.weakTopics.map((topic) => (
                <NbPill key={topic} color="orange">{weakTopicLabels[topic]}</NbPill>
              ))}
            </div>
          </div>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: <Clock className="w-5 h-5" />, value: `${metrics.totalWatchMinutes} phút`, label: "Thời gian học", color: "text-nb-blue" },
            { icon: <BookOpen className="w-5 h-5" />, value: questionStats.length || metrics.completedExperiences, label: questionStats.length ? "Câu đã làm" : "Bài đã học", color: "text-nb-green" },
            { icon: <Trophy className="w-5 h-5" />, value: `${questionAccuracy}%`, label: "Độ chính xác", color: "text-nb-orange" },
            { icon: <TrendingUp className="w-5 h-5" />, value: metrics.xp, label: "Tổng XP", color: "text-nb-purple" },
          ].map((s) => (
            <div key={s.label} className="nb-card rounded-2xl p-5 flex flex-col gap-1">
              <div className={cn("w-5 h-5", s.color)}>{s.icon}</div>
              <div className={cn("font-display text-2xl leading-none", s.color)}>{s.value}</div>
              <div className="text-xs font-bold uppercase text-[#666]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* XP chart */}
        <div className="nb-card rounded-2xl p-5 mb-8">
          <h3 className="font-display text-sm mb-4">XP mỗi ngày trong tuần</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyProgress} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff914d" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#ff914d" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  border: "4px solid #0e0e0e",
                  borderRadius: 0,
                  boxShadow: "4px 4px 0 #0e0e0e",
                  fontFamily: "Space Grotesk",
                  fontWeight: 700,
                }}
              />
              <Area
                type="monotone"
                dataKey="xpEarned"
                stroke="#ff914d"
                strokeWidth={3}
                fill="url(#xpGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Time + Subject split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minutes per day */}
          <div className="nb-card rounded-2xl p-5">
            <h3 className="font-display text-sm mb-4">Study Time (min/day)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyProgress} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    border: "4px solid #0e0e0e",
                    borderRadius: 0,
                    boxShadow: "4px 4px 0 #0e0e0e",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="timeOnTaskMinutes" fill="#38b6ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Subjects pie */}
          <div className="nb-card rounded-2xl p-5">
            <h3 className="font-display text-sm mb-4">Subjects Studied</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={subjectBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="lessonsCompleted"
                  stroke="#0e0e0e"
                  strokeWidth={2}
                >
                  {subjectBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "4px solid #0e0e0e",
                    borderRadius: 0,
                    boxShadow: "4px 4px 0 #0e0e0e",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                  }}
                />
                <Legend
                  formatter={(v) => (
                    <span className="font-bold text-xs uppercase">{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Concepts to reinforce */}
        {metrics.conceptsToReinforce.length > 0 && (
          <div className="nb-card rounded-2xl p-5 mt-8">
            <h3 className="font-display text-sm mb-4">
              💡 Concepts to Reinforce
            </h3>
            <div className="flex flex-wrap gap-2">
              {metrics.conceptsToReinforce.map((concept) => (
                <NbPill key={concept} color="orange">{concept}</NbPill>
              ))}
            </div>
          </div>
        )}

        {progressSummary && progressSummary.recentCompletions.length > 0 && (
          <div className="nb-card rounded-2xl p-5 mt-8">
            <h3 className="font-display text-sm mb-4">Recent Lesson Completions</h3>
            <div className="flex flex-col gap-3">
              {progressSummary.recentCompletions.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 sm:items-center bg-white [border:var(--nb-border-thin)] rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="font-bold text-sm">{item.lessonTitle}</div>
                    <div className="text-[0.65rem] font-bold uppercase text-[#666]">
                      {item.subject} - {new Date(item.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <NbPill color="orange">Quiz {item.quizScorePercent}%</NbPill>
                  <NbPill color="blue">{Math.round(item.timeOnTaskSeconds / 60)}m</NbPill>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionContainer>
    </ParentShell>
  );
}
